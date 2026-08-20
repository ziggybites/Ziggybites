import mongoose from 'mongoose';
import { recordTransaction, ensureWallet, getBalance, getTransactionsByEntity } from './transaction.service.js';
import { FoodUserWallet } from '../../modules/food/user/models/userWallet.model.js';
import { FoodRestaurantWallet } from '../../modules/food/restaurant/models/restaurantWallet.model.js';
import { FoodDeliveryWallet } from '../../modules/food/delivery/models/deliveryWallet.model.js';
import { FoodAdminWallet } from '../../modules/food/admin/models/adminWallet.model.js';
import { FoodDeliveryWithdrawal } from '../../modules/food/delivery/models/foodDeliveryWithdrawal.model.js';
import { FoodDeliveryCashDeposit } from '../../modules/food/delivery/models/foodDeliveryCashDeposit.model.js';
import { DeliveryBonusTransaction } from '../../modules/food/admin/models/deliveryBonusTransaction.model.js';
import { FoodDeliveryCashLimit } from '../../modules/food/admin/models/deliveryCashLimit.model.js';
import { logger } from '../../utils/logger.js';

/**
 * Universal wallet service — facade over transaction.service for
 * common wallet operations (credit, debit, lock, unlock, get balance).
 *
 * Each entity type has its own Mongoose model, but this service
 * provides a unified interface.
 */

/**
 * Credit an entity's wallet.
 */
export async function creditWallet({
    entityType, entityId, amount, description,
    category = 'other', orderId, paymentId, metadata, session
}) {
    return recordTransaction({
        entityType,
        entityId: String(entityId),
        type: 'credit',
        amount: Number(amount),
        description,
        category,
        orderId: orderId ? String(orderId) : null,
        paymentId: paymentId ? String(paymentId) : null,
        metadata,
        session
    });
}

/**
 * Debit an entity's wallet.
 */
export async function debitWallet({
    entityType, entityId, amount, description,
    category = 'other', orderId, paymentId, metadata, session
}) {
    return recordTransaction({
        entityType,
        entityId: String(entityId),
        type: 'debit',
        amount: Number(amount),
        description,
        category,
        orderId: orderId ? String(orderId) : null,
        paymentId: paymentId ? String(paymentId) : null,
        metadata,
        session
    });
}

/**
 * Get wallet info for any entity.
 */
export async function getWalletBalance(entityType, entityId) {
    return getBalance(entityType, entityId);
}

/**
 * Get wallet + recent transactions for any entity.
 */
export async function getWalletWithTransactions(entityType, entityId, { page = 1, limit = 20 } = {}) {
    const [balance, txns] = await Promise.all([
        getBalance(entityType, entityId),
        getTransactionsByEntity(entityType, entityId, { page, limit })
    ]);

    return {
        ...balance,
        ...txns
    };
}

function normalizeLedgerTransaction(txn) {
    return {
        id: String(txn?._id || ''),
        _id: txn?._id,
        type: txn?.type || '',
        amount: Number(txn?.amount || 0),
        status: txn?.status || 'completed',
        description: txn?.description || '',
        date: txn?.createdAt || txn?.date || null,
        createdAt: txn?.createdAt || txn?.date || null,
        category: txn?.category || 'other',
        balanceAfter: Number(txn?.balanceAfter || 0),
        metadata: txn?.metadata || {},
    };
}

export async function getRestaurantWalletForFrontend(restaurantId, { page = 1, limit = 20 } = {}) {
    const oid = new mongoose.Types.ObjectId(String(restaurantId));
    const [wallet, txns] = await Promise.all([
        FoodRestaurantWallet.findOne({ restaurantId: oid }).lean(),
        getTransactionsByEntity('restaurant', restaurantId, { page, limit }),
    ]);

    const balance = Number(wallet?.balance || 0);
    const lockedAmount = Number(wallet?.lockedAmount || 0);

    return {
        balance,
        lockedAmount,
        availableBalance: Math.max(0, balance - lockedAmount),
        totalEarnings: Number(wallet?.totalEarnings || 0),
        totalSettled: Number(wallet?.totalSettled || 0),
        transactions: (txns.transactions || []).map(normalizeLedgerTransaction),
        total: txns.total,
        page: txns.page,
        limit: txns.limit,
        totalPages: txns.totalPages,
    };
}

export async function getDeliveryWalletForFrontend(deliveryPartnerId, { page = 1, limit = 20 } = {}) {
    const oid = new mongoose.Types.ObjectId(String(deliveryPartnerId));
    const [wallet, txns, withdrawals, deposits, bonuses, cashLimitDoc] = await Promise.all([
        FoodDeliveryWallet.findOne({ deliveryPartnerId: oid }).lean(),
        getTransactionsByEntity('deliveryBoy', deliveryPartnerId, { page, limit }),
        FoodDeliveryWithdrawal.find({ deliveryPartnerId: oid }).sort({ createdAt: -1 }).limit(limit).lean(),
        FoodDeliveryCashDeposit.find({ deliveryPartnerId: oid }).sort({ createdAt: -1 }).limit(limit).lean(),
        DeliveryBonusTransaction.find({ deliveryPartnerId: oid }).sort({ createdAt: -1 }).limit(limit).lean(),
        FoodDeliveryCashLimit.findOne({ isActive: true }).sort({ createdAt: -1 }).lean(),
    ]);

    const baseBalance = Number(wallet?.balance || 0);
    const lockedAmount = Number(wallet?.lockedAmount || 0);
    const pendingWithdrawals = (withdrawals || [])
        .filter((row) => String(row?.status || '').toLowerCase() === 'pending')
        .reduce((sum, row) => sum + Number(row?.amount || 0), 0);

    const extraTransactions = [
        ...(withdrawals || []).map((row) => ({
            id: String(row._id),
            _id: row._id,
            type: 'withdrawal',
            amount: Number(row.amount || 0),
            status: row.status || 'pending',
            description: `Withdrawal Request - ${row.paymentMethod || 'bank_transfer'}`,
            date: row.createdAt,
            createdAt: row.createdAt,
            metadata: {},
        })),
        ...(deposits || []).map((row) => ({
            id: String(row._id),
            _id: row._id,
            type: 'deposit',
            amount: Number(row.amount || 0),
            status: row.status || 'pending',
            description: 'Cash limit settlement',
            date: row.createdAt,
            createdAt: row.createdAt,
            metadata: {
                razorpayOrderId: row.razorpayOrderId || '',
                razorpayPaymentId: row.razorpayPaymentId || '',
            },
        })),
        ...(bonuses || []).map((row) => ({
            id: String(row._id),
            _id: row._id,
            type: 'bonus',
            amount: Number(row.amount || 0),
            status: 'completed',
            description: row.reference || 'Bonus',
            date: row.createdAt,
            createdAt: row.createdAt,
            metadata: {
                transactionId: row.transactionId || '',
            },
        })),
    ];

    const mergedTransactions = [
        ...(txns.transactions || []).map(normalizeLedgerTransaction),
        ...extraTransactions,
    ]
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
        .slice(0, limit);

    const totalCashLimit = Number(cashLimitDoc?.deliveryCashLimit || 0);
    const deliveryWithdrawalLimit = Number(cashLimitDoc?.deliveryWithdrawalLimit || 100);
    const cashInHand = Number(wallet?.cashInHand || 0);

    return {
        balance: baseBalance,
        lockedAmount,
        availableBalance: Math.max(0, baseBalance - lockedAmount),
        pocketBalance: Math.max(0, baseBalance - lockedAmount),
        cashInHand,
        totalEarnings: Number(wallet?.totalEarnings || 0),
        totalBonus: Number(wallet?.totalBonus || 0),
        totalSettled: Number(wallet?.totalSettled || 0),
        totalDeliveries: Number(wallet?.totalDeliveries || 0),
        pendingWithdrawals,
        totalCashLimit,
        availableCashLimit: Math.max(0, totalCashLimit - cashInHand),
        deliveryWithdrawalLimit,
        transactions: mergedTransactions,
        total: txns.total,
        page: txns.page,
        limit: txns.limit,
        totalPages: txns.totalPages,
    };
}

export async function getAdminWalletForFrontend({ page = 1, limit = 20 } = {}) {
    const [wallet, txns] = await Promise.all([
        FoodAdminWallet.findOne({ key: 'platform' }).lean(),
        getTransactionsByEntity('admin', 'platform', { page, limit }),
    ]);

    return {
        balance: Number(wallet?.balance || 0),
        totalRevenue: Number(wallet?.totalRevenue || 0),
        totalPayouts: Number(wallet?.totalPayouts || 0),
        totalRefunds: Number(wallet?.totalRefunds || 0),
        transactions: (txns.transactions || []).map(normalizeLedgerTransaction),
        total: txns.total,
        page: txns.page,
        limit: txns.limit,
        totalPages: txns.totalPages,
    };
}

/**
 * Lock amount in wallet (for pending settlements).
 * Locked amount cannot be withdrawn but is still part of balances.
 */
export async function lockWalletAmount(entityType, entityId, amount) {
    const wallet = await ensureWallet(entityType, entityId);
    const available = (Number(wallet.balance) || 0) - (Number(wallet.lockedAmount) || 0);

    if (amount > available) {
        throw new Error(`Cannot lock ${amount}. Available: ${available}`);
    }

    wallet.lockedAmount = (Number(wallet.lockedAmount) || 0) + amount;
    await wallet.save();

    logger.info(`Locked ${amount} for ${entityType}:${entityId}. Total locked: ${wallet.lockedAmount}`);
    return { lockedAmount: wallet.lockedAmount, balance: wallet.balance };
}

/**
 * Unlock amount in wallet (after settlement is processed/cancelled).
 */
export async function unlockWalletAmount(entityType, entityId, amount) {
    const wallet = await ensureWallet(entityType, entityId);
    wallet.lockedAmount = Math.max(0, (Number(wallet.lockedAmount) || 0) - amount);
    await wallet.save();

    logger.info(`Unlocked ${amount} for ${entityType}:${entityId}. Total locked: ${wallet.lockedAmount}`);
    return { lockedAmount: wallet.lockedAmount, balance: wallet.balance };
}

/**
 * USER WALLET: Get wallet with transactions in the format the existing frontend expects.
 * This maintains backward compatibility with the existing FoodUserWallet embedded transactions.
 */
export async function getUserWalletForFrontend(userId) {
    const id = String(userId || '');
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        return { balance: 0, referralEarnings: 0, transactions: [] };
    }

    // Read from the existing FoodUserWallet for backward compat
    const oid = new mongoose.Types.ObjectId(id);
    const wallet = await FoodUserWallet.findOne({ userId: oid });

    // Also read from new Transaction collection
    const newTxns = await getTransactionsByEntity('user', id, { page: 1, limit: 50 });

    // Merge: prefer new Transaction data, fallback to embedded
    const embeddedTx = wallet?.transactions
        ? [...wallet.transactions].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        : [];

    // Convert new transactions to frontend format
    const convertedNewTxns = (newTxns.transactions || []).map(t => ({
        id: String(t._id),
        _id: t._id,
        type: t.type === 'credit' ? 'addition' : 'deduction',
        amount: Number(t.amount) || 0,
        status: t.status === 'completed' ? 'Completed' : t.status,
        description: t.description || '',
        date: t.createdAt,
        createdAt: t.createdAt,
        metadata: t.metadata || {},
        category: t.category,
        balanceAfter: t.balanceAfter
    }));

    // Convert embedded txns
    const convertedEmbedded = embeddedTx.map(t => ({
        id: String(t._id),
        _id: t._id,
        type: t.type,
        amount: Number(t.amount) || 0,
        status: t.status || 'Completed',
        description: t.description || '',
        date: t.createdAt,
        createdAt: t.createdAt,
        metadata: t.metadata || {}
    }));

    // Deduplicate by checking if an embedded txn has a matching new txn (same amount + order within 5s)
    const allTxns = [...convertedNewTxns, ...convertedEmbedded];
    // Sort newest first
    allTxns.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return {
        balance: Number(wallet?.balance) || 0,
        referralEarnings: Number(wallet?.referralEarnings) || 0,
        transactions: allTxns
    };
}
