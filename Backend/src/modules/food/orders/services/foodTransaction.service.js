import { FoodTransaction } from '../models/foodTransaction.model.js';
import { FoodRestaurantCommission } from '../../admin/models/restaurantCommission.model.js';
import { FoodFeeSettings } from '../../admin/models/feeSettings.model.js';
import mongoose from 'mongoose';
import { buildOrderPricingSnapshot } from './order.helpers.js';

const RESTAURANT_COMMISSION_CACHE_MS = 60 * 1000;
let restaurantCommissionRulesCache = null;
let restaurantCommissionRulesLoadedAt = 0;

async function getActiveRestaurantCommissionRules() {
  const now = Date.now();
  if (
    restaurantCommissionRulesCache &&
    now - restaurantCommissionRulesLoadedAt < RESTAURANT_COMMISSION_CACHE_MS
  ) {
    return restaurantCommissionRulesCache;
  }

  const list = await FoodRestaurantCommission.find({
    status: { $ne: false },
  }).lean();
  restaurantCommissionRulesCache = list || [];
  restaurantCommissionRulesLoadedAt = now;
  return restaurantCommissionRulesCache;
}

export function computeRestaurantCommissionAmount(baseAmount, rule) {
  const safeBase = Math.max(0, Number(baseAmount) || 0);
  if (!Number.isFinite(safeBase) || safeBase < 0) return 0;

  const commissionType = rule?.defaultCommission?.type || 'percentage';
  const commissionValue = Math.max(
    0,
    Number(rule?.defaultCommission?.value ?? 0) || 0
  );

  let commissionAmount = 0;
  if (commissionType === 'percentage') {
    commissionAmount = safeBase * (commissionValue / 100);
  } else if (commissionType === 'amount') {
    commissionAmount = commissionValue;
  }

  commissionAmount = Math.round((commissionAmount || 0) * 100) / 100;
  commissionAmount = Math.max(0, Math.min(commissionAmount, safeBase));

  return { commissionAmount, commissionType, commissionValue, baseAmount: safeBase };
}

export async function getRestaurantCommissionSnapshot(orderDoc) {
  const pricing = buildOrderPricingSnapshot(orderDoc);
  const baseAmount = Number(pricing.subtotal ?? 0) || 0;
  const isSubscriptionPrepaidOrder =
    String(orderDoc?.payment?.method || '').toLowerCase() === 'subscription' ||
    String(orderDoc?.subscriptionUsage?.billingMode || '').toLowerCase() === 'subscription_prepaid';
  const restaurantIdRaw =
    orderDoc?.restaurantId?._id ?? orderDoc?.restaurantId ?? null;

  if (!restaurantIdRaw) {
    return {
      commissionAmount: 0,
      commissionType: 'percentage',
      commissionValue: 0,
      baseAmount,
      gstOnItem: 0,
      gstOnCommission: 0,
      paymentGatewayFee: 0,
      tcs: 0,
    };
  }

  const rules = await getActiveRestaurantCommissionRules();
  let rule =
    rules.find((r) => String(r.restaurantId) === String(restaurantIdRaw)) ||
    rules.find((r) => String(r.restaurant || r.restaurant_id || '') === String(restaurantIdRaw)) ||
    null;

  if (!rule) {
    const globalSettings = await FoodFeeSettings.findOne({ isActive: true }).sort({ createdAt: -1 }).lean() || {};
    if (globalSettings.globalRestaurantCommission > 0) {
        rule = {
            defaultCommission: {
                type: 'percentage',
                value: globalSettings.globalRestaurantCommission
            }
        };
    }
  }

  const result = rule ? computeRestaurantCommissionAmount(baseAmount, rule) : {
      commissionAmount: 0,
      commissionType: 'percentage',
      commissionValue: 0,
      baseAmount,
  };

  if (isSubscriptionPrepaidOrder) {
    result.gstOnItem = 0;
    result.gstOnCommission = 0;
    result.paymentGatewayFee = 0;
    result.tcs = 0;
    return result;
  }

  const globalSettings = await FoodFeeSettings.findOne({ isActive: true }).sort({ createdAt: -1 }).lean() || {};
  const applyTaxes = globalSettings.applyGlobalTaxes !== false;
  const gstOnItemRate = applyTaxes ? (Number(globalSettings.globalGstOnItem) || 0) : 0;
  const gstOnCommission = applyTaxes ? (Number(globalSettings.globalGstOnCommission) || 0) : 0;
  const pgFee = applyTaxes ? (Number(globalSettings.globalPaymentGatewayFee) || 0) : 0;
  const tcs = applyTaxes ? (Number(globalSettings.globalTcs) || 0) : 0;

  const totalPaid = Number(pricing.total) || 0;

  result.gstOnItem = Math.round(baseAmount * (gstOnItemRate / 100) * 100) / 100;
  result.gstOnCommission = Math.round(result.commissionAmount * (gstOnCommission / 100) * 100) / 100;
  result.paymentGatewayFee = Math.round(totalPaid * (pgFee / 100) * 100) / 100;
  result.tcs = Math.round(baseAmount * (tcs / 100) * 100) / 100;

  return result;
}

export async function createInitialTransaction(order) {
    const session = order?.__session || null;
    const existingTransaction = await FoodTransaction.findOne({ orderId: order._id }).session(session);
    if (existingTransaction) {
        return existingTransaction;
    }

    const pricing = buildOrderPricingSnapshot(order);
    const commissionSnapshot = await getRestaurantCommissionSnapshot(order);
    const isSubscriptionPrepaidOrder =
        String(order?.payment?.method || '').toLowerCase() === 'subscription' ||
        String(order?.subscriptionUsage?.billingMode || '').toLowerCase() === 'subscription_prepaid';
    const directCustomerPaidAmount = isSubscriptionPrepaidOrder
        ? Number(order?.subscriptionUsage?.directCustomerPaymentAmount ?? order?.payment?.amountDue ?? 0) || 0
        : Number(pricing.total || 0) || 0;
    const subscriptionAllocationAmount = isSubscriptionPrepaidOrder
        ? Number(
            order?.subscriptionUsage?.operationalOrderValue ??
            order?.subscriptionUsage?.subscriptionCreditApplied ??
            pricing.total ??
            0
        ) || 0
        : 0;
    const subscriptionDeliveryFeeAmount = isSubscriptionPrepaidOrder
        ? Number(order?.subscriptionUsage?.allocatedDeliveryFeeAmount ?? 0) || 0
        : 0;
    const subscriptionPlatformFeeAmount = isSubscriptionPrepaidOrder
        ? Number(order?.subscriptionUsage?.allocatedPlatformFeeAmount ?? 0) || 0
        : 0;
    const subscriptionGstAmount = isSubscriptionPrepaidOrder
        ? Number(order?.subscriptionUsage?.allocatedGstAmount ?? 0) || 0
        : 0;
    const subscriptionCouponDiscountAmount = isSubscriptionPrepaidOrder
        ? Number(order?.subscriptionUsage?.allocatedCouponDiscountAmount ?? 0) || 0
        : 0;
    const subscriptionTotalAllocatedAmount = isSubscriptionPrepaidOrder
        ? Number(
            order?.subscriptionUsage?.totalAllocatedRevenueAmount ??
            (
                subscriptionAllocationAmount +
                subscriptionDeliveryFeeAmount +
                subscriptionPlatformFeeAmount +
                subscriptionGstAmount -
                subscriptionCouponDiscountAmount
            )
        ) || 0
        : 0;
    const totalCustomerPaid = directCustomerPaidAmount;
    const riderShare = order.riderEarning || 0;

    const restaurantCommissionFromOrder = Number(pricing.restaurantCommission);
    const restaurantCommission =
        Number.isFinite(restaurantCommissionFromOrder) && restaurantCommissionFromOrder > 0
            ? restaurantCommissionFromOrder
            : (commissionSnapshot.commissionAmount || 0);

    const gstOnItemFromOrder = Number(pricing.gstOnItem);
    const gstOnItem = Number.isFinite(gstOnItemFromOrder)
        ? gstOnItemFromOrder
        : (commissionSnapshot.gstOnItem || 0);

    const gstOnCommission = commissionSnapshot.gstOnCommission || 0;
    const paymentGatewayFee = commissionSnapshot.paymentGatewayFee || 0;
    const tcs = commissionSnapshot.tcs || 0;

    const restaurantNet = (pricing.subtotal || 0) + (pricing.packagingFee || 0) - restaurantCommission - gstOnItem - gstOnCommission - paymentGatewayFee - tcs;

    const calculatedPlatformNetProfit = isSubscriptionPrepaidOrder
        ? restaurantCommission + subscriptionDeliveryFeeAmount + subscriptionPlatformFeeAmount - subscriptionCouponDiscountAmount - riderShare
        : (pricing.platformFee || 0) + (pricing.deliveryFee || 0) + restaurantCommission + gstOnItem + paymentGatewayFee + tcs - riderShare;
    const platformNetProfit = order.platformProfit !== undefined
        ? order.platformProfit
        : Math.max(0, calculatedPlatformNetProfit);

    const paymentSnapshot = isSubscriptionPrepaidOrder
        ? {
            status: String(order.payment?.status || 'paid'),
            amountDue: Number(order.payment?.amountDue ?? 0) || 0,
        }
        : {
            method: String(order.payment?.method || 'cash'),
            status: String(order.payment?.status || 'cod_pending'),
            amountDue: Number(order.payment?.amountDue ?? pricing.total ?? 0) || 0,
            razorpay: {
                orderId: String(order.payment?.razorpay?.orderId || ''),
                paymentId: String(order.payment?.razorpay?.paymentId || ''),
                signature: String(order.payment?.razorpay?.signature || ''),
            },
            qr: {
                qrId: String(order.payment?.qr?.qrId || ''),
                imageUrl: String(order.payment?.qr?.imageUrl || ''),
                paymentLinkId: String(order.payment?.qr?.paymentLinkId || ''),
                shortUrl: String(order.payment?.qr?.shortUrl || ''),
                status: String(order.payment?.qr?.status || ''),
                expiresAt: order.payment?.qr?.expiresAt || null,
            }
        };

    const pricingSnapshot = isSubscriptionPrepaidOrder
        ? {
            subtotal: Number(pricing.subtotal || 0) || 0,
            tax: subscriptionGstAmount,
            deliveryFee: subscriptionDeliveryFeeAmount,
            platformFee: subscriptionPlatformFeeAmount,
            restaurantCommission,
            discount: subscriptionCouponDiscountAmount,
            total: Number(pricing.total || 0) || 0,
            currency: String(pricing.currency || order.currency || 'INR'),
        }
        : {
            subtotal: Number(pricing.subtotal || 0) || 0,
            tax: Number(pricing.tax || 0) || 0,
            packagingFee: Number(pricing.packagingFee || 0) || 0,
            deliveryFee: Number(pricing.deliveryFee || 0) || 0,
            platformFee: Number(pricing.platformFee || 0) || 0,
            restaurantCommission,
            discount: Number(pricing.discount || 0) || 0,
            total: Number(pricing.total || 0) || 0,
            currency: String(pricing.currency || order.currency || 'INR'),
        };

    const amountSnapshot = {
        totalCustomerPaid,
        ...(isSubscriptionPrepaidOrder ? {} : { directCustomerPaidAmount }),
        ...(isSubscriptionPrepaidOrder ? { subscriptionAllocationAmount } : {}),
        ...(isSubscriptionPrepaidOrder ? { subscriptionDeliveryFeeAmount } : {}),
        ...(isSubscriptionPrepaidOrder ? { subscriptionPlatformFeeAmount } : {}),
        ...(isSubscriptionPrepaidOrder ? { subscriptionGstAmount } : {}),
        ...(isSubscriptionPrepaidOrder ? { subscriptionCouponDiscountAmount } : {}),
        ...(isSubscriptionPrepaidOrder ? { subscriptionTotalAllocatedAmount } : {}),
        restaurantShare: Math.max(0, restaurantNet),
        restaurantCommission,
        ...(isSubscriptionPrepaidOrder ? {} : { gstOnItem }),
        ...(isSubscriptionPrepaidOrder ? {} : { gstOnCommission }),
        ...(isSubscriptionPrepaidOrder ? {} : { paymentGatewayFee }),
        ...(isSubscriptionPrepaidOrder ? {} : { tcs }),
        riderShare,
        platformNetProfit,
        ...(isSubscriptionPrepaidOrder ? {} : { taxAmount: pricing.tax || 0 }),
    };

    const gatewaySnapshot = isSubscriptionPrepaidOrder
        ? undefined
        : {
            provider: 'razorpay',
            razorpayOrderId: order.payment?.razorpay?.orderId,
            qrUrl: order.payment?.qr?.imageUrl
        };

    const transaction = new FoodTransaction({
        orderId: order._id,
        userId: order.userId,
        restaurantId: order.restaurantId,
        deliveryPartnerId: order.dispatch?.deliveryPartnerId,
        ...(isSubscriptionPrepaidOrder ? {} : { paymentMethod: order.payment?.method || 'cash' }),
        status: order.payment?.status === 'paid' ? 'captured' : 'pending',
        payment: paymentSnapshot,
        pricing: pricingSnapshot,
        amounts: amountSnapshot,
        ...(gatewaySnapshot ? { gateway: gatewaySnapshot } : {}),
        history: [{
            kind: 'created',
            amount: subscriptionTotalAllocatedAmount || subscriptionAllocationAmount || totalCustomerPaid,
            note: 'Initial transaction created with order'
        }]
    });

    try {
        await transaction.save({ session });
    } catch (error) {
        if (error?.code === 11000) {
            return await FoodTransaction.findOne({ orderId: order._id }).session(session);
        }
        throw error;
    }

    try {
        await mongoose.model('FoodOrder').updateOne(
            { _id: order._id },
            { $set: { transactionId: transaction._id } },
            session ? { session } : undefined
        );
    } catch (_err) {
    }

    return transaction;
}

export async function updateTransactionStatus(orderId, kind, details = {}) {
    const session = details.session || null;
    const query = { orderId };
    const transaction = await FoodTransaction.findOne(query).session(session);
    if (!transaction) return null;

    if (!transaction.payment) {
        transaction.payment = {};
    }
    if (!transaction.gateway) {
        transaction.gateway = {};
    }

    if (details.status) {
        transaction.status = details.status;
        if (details.status === 'captured') transaction.payment.status = 'paid';
        if (details.status === 'failed') transaction.payment.status = 'failed';
        if (details.status === 'refunded') transaction.payment.status = 'refunded';
    }
    if (details.razorpayPaymentId) {
        transaction.gateway.razorpayPaymentId = details.razorpayPaymentId;
        transaction.payment.razorpay.paymentId = details.razorpayPaymentId;
    }
    if (details.razorpaySignature) {
        transaction.gateway.razorpaySignature = details.razorpaySignature;
        transaction.payment.razorpay.signature = details.razorpaySignature;
    }

    if (details.paymentMethod) {
        transaction.paymentMethod = details.paymentMethod;
        transaction.payment.method = details.paymentMethod;
    }
    if (details.amountDue != null) {
        transaction.payment.amountDue = Number(details.amountDue || 0);
    }
    if (details.refund) {
        transaction.payment.refund = {
            ...(transaction.payment.refund?.toObject?.() || transaction.payment.refund || {}),
            ...details.refund,
        };
    }

    const effectivePaymentMethod = String(
        details.paymentMethod ||
        transaction.paymentMethod ||
        transaction.payment?.method ||
        ''
    ).toLowerCase();

    if (effectivePaymentMethod === 'subscription') {
        transaction.paymentMethod = undefined;
        transaction.payment = {
            status: transaction.payment?.status || 'paid',
            amountDue: Number(transaction.payment?.amountDue ?? 0) || 0,
        };
        transaction.pricing = {
            subtotal: Number(transaction.pricing?.subtotal || 0) || 0,
            tax: Number(transaction.pricing?.tax || 0) || 0,
            deliveryFee: Number(transaction.pricing?.deliveryFee || 0) || 0,
            platformFee: Number(transaction.pricing?.platformFee || 0) || 0,
            restaurantCommission: Number(transaction.pricing?.restaurantCommission || 0) || 0,
            discount: Number(transaction.pricing?.discount || 0) || 0,
            total: Number(transaction.pricing?.total || 0) || 0,
            currency: String(transaction.pricing?.currency || transaction.currency || 'INR'),
        };
        transaction.amounts = {
            totalCustomerPaid: Number(transaction.amounts?.totalCustomerPaid || 0) || 0,
            subscriptionAllocationAmount: Number(transaction.amounts?.subscriptionAllocationAmount || 0) || 0,
            subscriptionDeliveryFeeAmount: Number(transaction.amounts?.subscriptionDeliveryFeeAmount || 0) || 0,
            subscriptionPlatformFeeAmount: Number(transaction.amounts?.subscriptionPlatformFeeAmount || 0) || 0,
            subscriptionGstAmount: Number(transaction.amounts?.subscriptionGstAmount || 0) || 0,
            subscriptionCouponDiscountAmount: Number(transaction.amounts?.subscriptionCouponDiscountAmount || 0) || 0,
            subscriptionTotalAllocatedAmount: Number(transaction.amounts?.subscriptionTotalAllocatedAmount || 0) || 0,
            restaurantShare: Number(transaction.amounts?.restaurantShare || 0) || 0,
            restaurantCommission: Number(transaction.amounts?.restaurantCommission || 0) || 0,
            riderShare: Number(transaction.amounts?.riderShare || 0) || 0,
            platformNetProfit: Number(transaction.amounts?.platformNetProfit || 0) || 0,
        };
        transaction.gateway = undefined;
    }

    transaction.history.push({
        kind,
        amount:
            transaction.amounts.subscriptionTotalAllocatedAmount ||
            transaction.amounts.subscriptionAllocationAmount ||
            transaction.amounts.totalCustomerPaid,
        at: new Date(),
        note: details.note || `Transaction updated: ${kind}`,
        recordedBy: { role: details.recordedByRole || 'SYSTEM', id: details.recordedById }
    });

    await transaction.save({ session });

    return transaction;
}

export async function updateTransactionRider(orderId, riderId) {
    const query = { orderId };
    return await FoodTransaction.findOneAndUpdate(
        query,
        { $set: { deliveryPartnerId: riderId } },
        { new: true }
    );
}

export async function settleRestaurant(orderId, adminId) {
    return await updateTransactionStatus(orderId, 'settled', {
        status: 'captured',
        note: 'Restaurant payout settled by admin',
        recordedByRole: 'ADMIN',
        recordedById: adminId
    });
}
