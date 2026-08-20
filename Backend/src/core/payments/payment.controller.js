import { sendResponse } from '../../utils/response.js';
import { getPaymentsByOrder } from './payment.service.js';
import { getTransactionsByOrder } from './transaction.service.js';
import { getWalletBalance, getWalletWithTransactions, getUserWalletForFrontend, getRestaurantWalletForFrontend, getDeliveryWalletForFrontend, getAdminWalletForFrontend } from './wallet.service.js';
import { getRefundsByOrder, listRefunds } from './refund.service.js';
import { createSettlement, processSettlement, listSettlements } from './settlement.service.js';
import { logger } from '../../utils/logger.js';

// ─── User Endpoints ───

export const getPaymentHistoryController = async (req, res, next) => {
    try {
        const { orderId } = req.params;
        const payments = await getPaymentsByOrder(orderId);
        return sendResponse(res, 200, 'Payment history fetched', { payments });
    } catch (err) {
        next(err);
    }
};

export const getOrderTransactionsController = async (req, res, next) => {
    try {
        const { orderId } = req.params;
        const transactions = await getTransactionsByOrder(orderId);
        return sendResponse(res, 200, 'Transactions fetched', { transactions });
    } catch (err) {
        next(err);
    }
};

export const getUserWalletBalanceController = async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        const data = await getWalletBalance('user', userId);
        return sendResponse(res, 200, 'Balance fetched', data);
    } catch (err) {
        next(err);
    }
};

export const getUserWalletTransactionsController = async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        const data = await getUserWalletForFrontend(userId);
        return sendResponse(res, 200, 'Wallet transactions fetched', data);
    } catch (err) {
        next(err);
    }
};

// ─── Restaurant Endpoints ───

export const getRestaurantWalletController = async (req, res, next) => {
    try {
        const restaurantId = req.user?.restaurantId || req.params.restaurantId;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const data = await getRestaurantWalletForFrontend(restaurantId, { page, limit });
        return sendResponse(res, 200, 'Restaurant wallet fetched', data);
    } catch (err) {
        next(err);
    }
};

// ─── Delivery Partner Endpoints ───

export const getDeliveryWalletController = async (req, res, next) => {
    try {
        const deliveryPartnerId = req.user?.deliveryPartnerId || req.params.deliveryPartnerId;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const data = await getDeliveryWalletForFrontend(deliveryPartnerId, { page, limit });
        return sendResponse(res, 200, 'Delivery wallet fetched', data);
    } catch (err) {
        next(err);
    }
};

// ─── Admin Endpoints ───

export const getAdminWalletController = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const data = await getAdminWalletForFrontend({ page, limit });
        return sendResponse(res, 200, 'Admin wallet fetched', data);
    } catch (err) {
        next(err);
    }
};

export const getAdminFinanceSummaryController = async (req, res, next) => {
    try {
        const { FoodAdminWallet } = await import('../../modules/food/admin/models/adminWallet.model.js');
        const { FoodRestaurantWallet } = await import('../../modules/food/restaurant/models/restaurantWallet.model.js');
        const { FoodDeliveryWallet } = await import('../../modules/food/delivery/models/deliveryWallet.model.js');
        const { FoodTransaction } = await import('../../modules/food/orders/models/foodTransaction.model.js');
        const adminWallet = await FoodAdminWallet.findOne({ key: 'platform' }).lean();
        const [pendingSettlements, pendingRefunds, restaurantWalletAgg, deliveryWalletAgg, financeSeries] = await Promise.all([
            listSettlements({ status: 'pending', limit: 100 }),
            listRefunds({ status: 'pending', limit: 100 }),
            FoodRestaurantWallet.aggregate([{ $group: { _id: null, total: { $sum: { $ifNull: ['$balance', 0] } } } }]),
            FoodDeliveryWallet.aggregate([{ $group: { _id: null, total: { $sum: { $ifNull: ['$balance', 0] } } } }]),
            FoodTransaction.aggregate([
                {
                    $match: {
                        createdAt: {
                            $gte: new Date(Date.now() - (14 * 24 * 60 * 60 * 1000)),
                        },
                    },
                },
                {
                    $group: {
                        _id: {
                            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
                        },
                        grossSales: { $sum: { $ifNull: ['$amounts.totalCustomerPaid', 0] } },
                        restaurantEarnings: { $sum: { $ifNull: ['$amounts.restaurantShare', 0] } },
                        riderEarnings: { $sum: { $ifNull: ['$amounts.riderShare', 0] } },
                        platformProfit: { $sum: { $ifNull: ['$amounts.platformNetProfit', 0] } },
                        orders: { $sum: 1 },
                    },
                },
                { $sort: { _id: 1 } },
            ]),
        ]);

        return sendResponse(res, 200, 'Finance summary', {
            platform: {
                balance: adminWallet?.balance || 0,
                totalRevenue: adminWallet?.totalRevenue || 0,
                totalPayouts: adminWallet?.totalPayouts || 0,
                totalRefunds: adminWallet?.totalRefunds || 0
            },
            liabilities: {
                restaurantWalletBalance: restaurantWalletAgg?.[0]?.total || 0,
                deliveryWalletBalance: deliveryWalletAgg?.[0]?.total || 0,
            },
            pendingSettlements: {
                count: pendingSettlements.total,
                totalAmount: pendingSettlements.settlements.reduce((s, v) => s + (v.amount || 0), 0)
            },
            pendingRefunds: {
                count: pendingRefunds.total,
                totalAmount: pendingRefunds.refunds.reduce((s, v) => s + (v.amount || 0), 0)
            },
            graphs: {
                dailyFinance: financeSeries.map((row) => ({
                    date: row._id,
                    orders: row.orders || 0,
                    grossSales: row.grossSales || 0,
                    restaurantEarnings: row.restaurantEarnings || 0,
                    riderEarnings: row.riderEarnings || 0,
                    platformProfit: row.platformProfit || 0,
                })),
            },
        });
    } catch (err) {
        next(err);
    }
};

export const listSettlementsController = async (req, res, next) => {
    try {
        const { entityType, entityId, status } = req.query;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const data = await listSettlements({ entityType, entityId, status, page, limit });
        return sendResponse(res, 200, 'Settlements fetched', data);
    } catch (err) {
        next(err);
    }
};

export const createSettlementController = async (req, res, next) => {
    try {
        const { entityType, entityId, amount, notes, periodStart, periodEnd } = req.body;
        const settlement = await createSettlement({ entityType, entityId, amount, notes, periodStart, periodEnd });
        return sendResponse(res, 201, 'Settlement created', { settlement });
    } catch (err) {
        next(err);
    }
};

export const processSettlementController = async (req, res, next) => {
    try {
        const { id } = req.params;
        const adminId = req.user?.userId;
        const { payoutRef } = req.body;
        const settlement = await processSettlement(id, { processedBy: adminId, payoutRef });
        return sendResponse(res, 200, 'Settlement processed', { settlement });
    } catch (err) {
        next(err);
    }
};

export const listRefundsController = async (req, res, next) => {
    try {
        const { status } = req.query;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const data = await listRefunds({ status, page, limit });
        return sendResponse(res, 200, 'Refunds fetched', data);
    } catch (err) {
        next(err);
    }
};

export const getRefundsByOrderController = async (req, res, next) => {
    try {
        const { orderId } = req.params;
        const refunds = await getRefundsByOrder(orderId);
        return sendResponse(res, 200, 'Refunds fetched', { refunds });
    } catch (err) {
        next(err);
    }
};
