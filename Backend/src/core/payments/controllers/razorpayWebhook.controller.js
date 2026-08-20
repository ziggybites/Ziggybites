import crypto from 'crypto';
import mongoose from 'mongoose';
import { FoodOrder } from '../../../modules/food/orders/models/order.model.js';
import * as foodTransactionService from '../../../modules/food/orders/services/foodTransaction.service.js';
import { notifyOwnersSafely, notifyRestaurantNewOrder } from '../../../modules/food/orders/services/order.helpers.js';
import { config } from '../../../config/env.js';
import { logger } from '../../../utils/logger.js';
import { PaymentWebhookEvent } from '../models/webhookEvent.model.js';

/**
 * ? NEW: Centralized Razorpay Webhook Handler (Core Layer)
 * Manages atomic updates for order payments and refunds across all modules.
 */
export const handleRazorpayWebhook = async (req, res) => {
    const signature = req.headers['x-razorpay-signature'];
    const secret = config.razorpayWebhookSecret;

    // 1. Verify Signature using raw body buffer
    if (!signature || !secret || !req.rawBody) {
        logger.warn('Razorpay Webhook: Missing signature or rawBody buffer.');
        return res.status(400).send('Invalid signature');
    }

    const expected = crypto
        .createHmac('sha256', secret)
        .update(req.rawBody)
        .digest('hex');

    if (expected !== signature) {
        logger.warn('Razorpay Webhook: Signature verification failed.');
        return res.status(400).send('Invalid signature');
    }

    const { event, payload } = req.body;
    const payloadHash = crypto.createHash('sha256').update(JSON.stringify(req.body || {})).digest('hex');
    const fingerprint = crypto.createHash('sha256').update(req.rawBody).digest('hex');
    const resourceId =
        String(
            payload?.payment?.entity?.id ||
            payload?.payment?.entity?.order_id ||
            payload?.refund?.entity?.id ||
            payload?.refund?.entity?.payment_id ||
            ''
        );

    try {
        await PaymentWebhookEvent.create({
            provider: 'razorpay',
            eventType: String(event || 'unknown'),
            fingerprint,
            resourceId,
            payloadHash,
            status: 'processing',
            metadata: {
                signature,
            },
        });
    } catch (error) {
        if (error?.code === 11000) {
            logger.info(`Razorpay Webhook Duplicate Ignored: ${event} ${resourceId || fingerprint}`);
            return res.status(200).json({ status: 'duplicate_ignored' });
        }
        logger.error(`Razorpay Webhook Event Persist Error: ${error.message}`);
        return res.status(500).json({ message: 'Failed to persist webhook event' });
    }

    logger.info(`Razorpay Webhook Received: ${event}`);

    const session = await mongoose.startSession();
    const postCommitActions = [];
    try {
        await session.withTransaction(async () => {
            if (event === 'payment.captured') {
                const paymentObj = payload.payment.entity;
                const rzOrderId = paymentObj.order_id;
                const rzPaymentId = paymentObj.id;

                const order = await FoodOrder.findOneAndUpdate(
                    {
                        'payment.razorpay.orderId': rzOrderId,
                        'payment.status': { $ne: 'paid' }
                    },
                    {
                        $set: {
                            'payment.status': 'paid',
                            'payment.razorpay.paymentId': rzPaymentId
                        }
                    },
                    { new: true, session }
                );

                if (order) {
                    await foodTransactionService.updateTransactionStatus(order._id, 'captured', {
                        status: 'captured',
                        razorpayPaymentId: rzPaymentId,
                        note: 'Payment status synced via Webhook (payment.captured)',
                        session,
                    });

                    postCommitActions.push(async () => {
                        await notifyRestaurantNewOrder(order);
                    });
                    postCommitActions.push(async () => {
                        await notifyOwnersSafely([{ ownerType: 'USER', ownerId: order.userId }], {
                            title: 'Payment Successful',
                            body: `We have received your payment of Rs.${order.payment.amountDue} for Order #${order.order_id || order._id}.`,
                            data: {
                                type: 'payment_success',
                                orderId: String(order._id),
                                orderMongoId: String(order._id),
                            },
                        });
                    });

                    logger.info(`Webhook [payment.captured]: Synced Order ${order.orderId} (Status=paid)`);
                } else {
                    logger.warn(`Webhook [payment.captured]: Order not found or already paid for RZ-Order: ${rzOrderId}`);
                }
            }

            if (event === 'payment.failed') {
                const paymentObj = payload.payment.entity;
                const rzOrderId = paymentObj.order_id;
                const rzPaymentId = paymentObj.id;
                const failureReason =
                    paymentObj.error_description ||
                    paymentObj.error_reason ||
                    paymentObj.error_source ||
                    'Payment failed at gateway';

                const order = await FoodOrder.findOneAndUpdate(
                    {
                        'payment.razorpay.orderId': rzOrderId,
                        'payment.status': { $in: ['created', 'authorized'] },
                        orderStatus: 'created',
                    },
                    {
                        $set: {
                            'payment.status': 'failed',
                            'payment.razorpay.paymentId': rzPaymentId || '',
                            orderStatus: 'cancelled_by_user',
                        },
                        $push: {
                            statusHistory: {
                                at: new Date(),
                                byRole: 'SYSTEM',
                                from: 'created',
                                to: 'cancelled_by_user',
                                note: `Payment failed via webhook: ${failureReason}`,
                            },
                        },
                    },
                    { new: true, session }
                );

                if (order) {
                    await foodTransactionService.updateTransactionStatus(order._id, 'failed', {
                        status: 'failed',
                        razorpayPaymentId: rzPaymentId,
                        note: `Payment failed via Webhook (${failureReason})`,
                        session,
                    });

                    postCommitActions.push(async () => {
                        await notifyOwnersSafely([{ ownerType: 'USER', ownerId: order.userId }], {
                            title: 'Payment Failed',
                            body: `Your payment for Order #${order.order_id || order._id} failed. Please place the order again.`,
                            data: {
                                type: 'payment_failed',
                                orderId: String(order._id),
                                orderMongoId: String(order._id),
                            },
                        });
                    });

                    logger.info(`Webhook [payment.failed]: Synced Order ${order.orderId} (Status=failed)`);
                } else {
                    logger.warn(`Webhook [payment.failed]: Order not found or already resolved for RZ-Order: ${rzOrderId}`);
                }
            }

            if (event === 'refund.processed') {
                const refundObj = payload.refund.entity;
                const rzPaymentId = refundObj.payment_id;
                const rzRefundId = refundObj.id;
                const refundAmount = refundObj.amount / 100;

                const order = await FoodOrder.findOneAndUpdate(
                    {
                        'payment.razorpay.paymentId': rzPaymentId,
                        'payment.refund.status': { $ne: 'processed' }
                    },
                    {
                        $set: {
                            'payment.status': 'refunded',
                            'payment.refund': {
                                status: 'processed',
                                amount: refundAmount,
                                refundId: rzRefundId,
                                processedAt: new Date()
                            }
                        }
                    },
                    { new: true, session }
                );

                if (order) {
                    await foodTransactionService.updateTransactionStatus(order._id, 'refunded', {
                        status: 'refunded',
                        razorpayPaymentId: rzPaymentId,
                        note: `Refund synced via Webhook (refund.processed: ${rzRefundId})`,
                        session,
                    });

                    logger.info(`Webhook [refund.processed]: Synced Order ${order.orderId} (Refunded)`);
                } else {
                    logger.warn(`Webhook [refund.processed]: Order not found or already refunded for RZ-Payment: ${rzPaymentId}`);
                }
            }

            await PaymentWebhookEvent.updateOne(
                { provider: 'razorpay', fingerprint },
                {
                    $set: {
                        status: 'processed',
                        processedAt: new Date(),
                        metadata: {
                            signature,
                            resourceId,
                        },
                    },
                },
                { session }
            );
        });

        for (const action of postCommitActions) {
            try {
                await action();
            } catch (notifyErr) {
                logger.warn(`Razorpay Webhook Post-Commit Action Error: ${notifyErr.message}`);
            }
        }

        res.status(200).json({ status: 'ok' });
    } catch (err) {
        try {
            await PaymentWebhookEvent.updateOne(
                { provider: 'razorpay', fingerprint },
                {
                    $set: {
                        status: 'failed',
                        metadata: {
                            signature,
                            resourceId,
                            error: err.message,
                        },
                    },
                }
            );
        } catch (_updateErr) {
        }
        logger.error(`Razorpay Webhook Logic Error: ${err.message}`);
        res.status(500).json({ message: 'Internal Server Error' });
    } finally {
        await session.endSession();
    }
};

