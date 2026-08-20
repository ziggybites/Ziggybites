import { logger } from '../../utils/logger.js';
import { createPayment, markPaymentSuccess } from '../../core/payments/payment.service.js';
import { initiateRefund } from '../../core/payments/refund.service.js';
import { checkEarningAddonCompletions } from '../../modules/food/admin/services/admin.service.js';
import { distributeCompletedOrderFinance } from '../../modules/food/orders/services/orderFinanceDistribution.service.js';

/**
 * Post-delivery financial settlement processor.
 * Called by BullMQ when a delivery_completed event fires.
 *
 * Splits the order total into:
 * 1. Restaurant commission credit
 * 2. Delivery partner earning credit
 * 3. Platform profit credit (admin wallet)
 *
 * Also handles refunds on order cancellation.
 *
 * @param {import('bullmq').Job} job
 */
export const processPaymentJob = async (job) => {
    const { action, orderMongoId, orderId } = job.data || {};
    logger.info(`[PaymentProcessor] Processing ${action} for order ${orderId || orderMongoId} (job ${job.id})`);

    try {
        switch (action) {
            case 'delivery_completed':
                await handleDeliveryCompleted(job.data);
                break;

            case 'order_cancelled':
                await handleOrderCancelled(job.data);
                break;

            case 'payment_verified':
                await handlePaymentVerified(job.data);
                break;

            default:
                logger.info(`[PaymentProcessor] No handler for action: ${action}`);
        }
    } catch (err) {
        logger.error(`[PaymentProcessor] Error processing ${action}: ${err.message}`);
        throw err; // Let BullMQ retry
    }

    return { processed: true, action, jobId: job.id };
};

/**
 * After delivery is completed and payment is confirmed:
 * Split money to all parties.
 */
async function handleDeliveryCompleted(data) {
    const { orderMongoId, orderId, deliveryPartnerId } = data;

    await distributeCompletedOrderFinance(orderMongoId, {
        orderDisplayId: orderId,
        recordedByRole: 'SYSTEM',
        recordedById: deliveryPartnerId || undefined,
    });

    if (deliveryPartnerId) {
        try {
            await checkEarningAddonCompletions(deliveryPartnerId, false, true);
        } catch (addonErr) {
            logger.error(`[PaymentProcessor] Error checking earning addons for ${deliveryPartnerId}: ${addonErr.message}`);
        }
    }
}

/**
 * Handle order cancellation — trigger refund if payment was made.
 */
async function handleOrderCancelled(data) {
    const { orderMongoId, paymentId, paymentMethod, paymentStatus, userId, amount, reason } = data;

    if (!paymentId || paymentStatus !== 'success') {
        logger.info(`[PaymentProcessor] No refund needed for order ${orderMongoId} (status: ${paymentStatus})`);
        return;
    }

    try {
        await initiateRefund({
            paymentId,
            orderId: orderMongoId,
            userId,
            amount,
            reason: reason || 'Order cancelled',
            refundTo: paymentMethod === 'wallet' ? 'wallet' : 'wallet' // Default to wallet refund
        });
        logger.info(`[PaymentProcessor] Refund initiated for order ${orderMongoId}`);
    } catch (err) {
        logger.error(`[PaymentProcessor] Refund failed for order ${orderMongoId}: ${err.message}`);
    }
}

/**
 * Handle payment verified — create a Payment record in the new system.
 */
async function handlePaymentVerified(data) {
    const { orderMongoId, orderId, userId, paymentMethod, paymentStatus, amount, gatewayPaymentId } = data;

    try {
        const payment = await createPayment({
            orderId: orderMongoId,
            userId,
            amount,
            method: paymentMethod,
            gateway: paymentMethod === 'razorpay' ? 'razorpay' : 'none',
            gatewayOrderId: data.razorpayOrderId || '',
            metadata: { orderId, source: 'payment_verified_event' }
        });

        if (paymentStatus === 'paid' && gatewayPaymentId) {
            await markPaymentSuccess(payment._id, { gatewayPaymentId });
        }

        logger.info(`[PaymentProcessor] Payment record created for order ${orderId}: ${payment._id}`);
    } catch (err) {
        logger.error(`[PaymentProcessor] Failed to create payment record: ${err.message}`);
    }
}
