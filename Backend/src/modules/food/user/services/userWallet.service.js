import mongoose from 'mongoose';
import { ValidationError } from '../../../../core/auth/errors.js';
import { FoodUserWallet } from '../models/userWallet.model.js';
import { Transaction } from '../../../../core/payments/models/transaction.model.js';
import { creditWallet, debitWallet, getUserWalletForFrontend } from '../../../../core/payments/wallet.service.js';
import { createRazorpayOrder, getRazorpayKeyId, isRazorpayConfigured, verifyPaymentSignature } from '../../orders/helpers/razorpay.helper.js';

const ensureWallet = async (userId, options = {}) => {
    const id = String(userId || '');
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        throw new ValidationError('User not found');
    }
    const oid = new mongoose.Types.ObjectId(id);
    const session = options.session || null;
    const existing = await FoodUserWallet.findOne({ userId: oid }).session(session);
    if (existing) return existing;
    const [created] = await FoodUserWallet.create(
        [{ userId: oid, balance: 0, transactions: [] }],
        session ? { session } : undefined
    );
    return created;
};

export const creditReferralReward = async (userId, amountInr, metadata = {}) => {
    const amount = Number(amountInr);
    if (!Number.isFinite(amount) || amount <= 0) {
        return { wallet: await getUserWallet(userId) };
    }

    const wallet = await ensureWallet(userId);
    await creditWallet({
        entityType: 'user',
        entityId: String(userId),
        amount,
        description: 'Referral reward',
        category: 'referral_reward',
        metadata: { source: 'referral_reward', ...(metadata || {}) }
    });
    wallet.referralEarnings = Number(wallet.referralEarnings || 0) + amount;
    await wallet.save();

    return { wallet: await getUserWallet(userId) };
};

export const getUserWallet = async (userId) => {
    return getUserWalletForFrontend(userId);
};

export const createWalletTopupOrder = async (userId, amountInr) => {
    const amount = Number(amountInr);
    if (!Number.isFinite(amount) || amount <= 0) {
        throw new ValidationError('Amount must be greater than 0');
    }
    if (amount > 50000) {
        throw new ValidationError('Maximum amount is 50,000');
    }

    const amountPaise = Math.round(amount * 100);

    if (!isRazorpayConfigured()) {
        // Dev fallback: return a compatible shape without writing to DB.
        const orderId = `order_dev_${Date.now()}`;
        return {
            razorpay: {
                key: getRazorpayKeyId() || 'rzp_test_dummy',
                orderId,
                amount: amountPaise,
                currency: 'INR'
            }
        };
    }

    const receipt = `wallet_topup_${String(userId).slice(-8)}_${Date.now()}`;
    const order = await createRazorpayOrder(amountPaise, 'INR', receipt);

    return {
        razorpay: {
            key: getRazorpayKeyId(),
            orderId: String(order.id),
            amount: Number(order.amount) || amountPaise,
            currency: order.currency || 'INR'
        }
    };
};

export const verifyWalletTopupPayment = async (userId, payload) => {
    const orderId = String(payload?.razorpayOrderId || '').trim();
    const paymentId = String(payload?.razorpayPaymentId || '').trim();
    const signature = String(payload?.razorpaySignature || '').trim();
    const amount = Number(payload?.amount);

    if (!orderId) throw new ValidationError('razorpayOrderId is required');
    if (!paymentId) throw new ValidationError('razorpayPaymentId is required');
    if (!signature) throw new ValidationError('razorpaySignature is required');
    if (!Number.isFinite(amount) || amount <= 0) throw new ValidationError('amount is required');

    await ensureWallet(userId);
    const existing = await Transaction.findOne({
        entityType: 'user',
        entityId: new mongoose.Types.ObjectId(String(userId)),
        category: 'wallet_topup',
        'metadata.razorpayOrderId': orderId,
        status: 'completed'
    }).lean();
    if (existing && String(existing.status).toLowerCase() === 'completed') {
        return { wallet: await getUserWallet(userId) };
    }

    // If razorpay not configured (dev), accept and credit wallet.
    const ok = isRazorpayConfigured()
        ? verifyPaymentSignature(orderId, paymentId, signature)
        : true;
    if (!ok) {
        throw new ValidationError('Payment verification failed');
    }

    await creditWallet({
        entityType: 'user',
        entityId: String(userId),
        amount,
        description: isRazorpayConfigured() ? 'Wallet top-up' : 'Wallet top-up (dev)',
        category: 'wallet_topup',
        metadata: {
            source: 'wallet_topup',
            mode: isRazorpayConfigured() ? 'razorpay' : 'dev',
            razorpayOrderId: orderId,
            razorpayPaymentId: paymentId,
            razorpaySignature: signature
        }
    });

    return { wallet: await getUserWallet(userId) };
};

export const deductWalletBalance = async (userId, amountInr, description = 'Order payment', metadata = {}, options = {}) => {
    const amount = Number(amountInr);
    if (!Number.isFinite(amount) || amount <= 0) {
        throw new ValidationError('Invalid deduction amount');
    }

    const session = options.session || null;
    const wallet = await ensureWallet(userId, { session });
    if (Number(wallet.balance || 0) < amount) {
        throw new ValidationError('Insufficient wallet balance');
    }

    await debitWallet({
        entityType: 'user',
        entityId: String(userId),
        amount,
        description,
        category: 'wallet_debit',
        metadata: { source: 'order_payment', ...(metadata || {}) },
        session
    });

    return { wallet: await getUserWallet(userId) };
};

export const refundWalletBalance = async (userId, amountInr, description = 'Order refund', metadata = {}, options = {}) => {
    const amount = Number(amountInr);
    if (!Number.isFinite(amount) || amount <= 0) {
        return { wallet: await getUserWallet(userId) };
    }

    const session = options.session || null;
    await ensureWallet(userId, { session });
    await creditWallet({
        entityType: 'user',
        entityId: String(userId),
        amount,
        description,
        category: 'order_refund',
        metadata: { source: 'order_refund', ...(metadata || {}) },
        session
    });

    return { wallet: await getUserWallet(userId) };
};

export const topupUserWalletByAdmin = async (userId, amountInr, adminId, description = 'Admin Top-up') => {
    const amount = Number(amountInr);
    if (!Number.isFinite(amount) || amount <= 0) {
        throw new ValidationError('Invalid top-up amount');
    }

    await ensureWallet(userId);
    await creditWallet({
        entityType: 'user',
        entityId: String(userId),
        amount,
        description,
        category: 'adjustment',
        metadata: { source: 'admin_topup', adminId: String(adminId) }
    });

    return { wallet: await getUserWallet(userId) };
};
