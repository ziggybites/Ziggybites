import mongoose from 'mongoose';
import { FoodOrder } from '../../orders/models/order.model.js';
import { FoodTransaction } from '../../orders/models/foodTransaction.model.js';
import { FoodRestaurant } from '../models/restaurant.model.js';
import { FoodRestaurantWithdrawal } from '../models/foodRestaurantWithdrawal.model.js';
import { FoodRestaurantWallet } from '../models/restaurantWallet.model.js';

function toTwoDigitYearString(dateObj) {
    const y = String(dateObj.getFullYear());
    return y.slice(-2);
}

function monthShort(monthIndex) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[monthIndex] || 'Jan';
}

function getFixedCurrentCycleWindow(now = new Date()) {
    const startDay = 15;
    
    let year = now.getFullYear();
    let month = now.getMonth();

    // If before start day, settlement belongs to previous month cycle.
    if (now.getDate() < startDay) {
        month = month - 1;
        if (month < 0) {
            month = 11;
            year -= 1;
        }
    }

    const start = new Date(year, month, startDay, 0, 0, 0, 0);
    // End should be either fixed 21 or now, let's make it more inclusive for "Current Cycle"
    // Users want to see their active earnings, so we extend it to 'now'
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    return {
        start,
        end,
        startMeta: { day: String(startDay), month: monthShort(month), year: toTwoDigitYearString(new Date(year, month, startDay)) },
        endMeta: { day: String(now.getDate()), month: monthShort(now.getMonth()), year: toTwoDigitYearString(now) }
    };
}

function parseISODateParam(v) {
    if (!v) return null;
    const s = String(v).trim();
    if (!s) return null;
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return null;
    d.setHours(0, 0, 0, 0);
    return d;
}

function parseISODateParamEnd(v) {
    if (!v) return null;
    const s = String(v).trim();
    if (!s) return null;
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return null;
    d.setHours(23, 59, 59, 999);
    return d;
}

export async function getRestaurantFinance(restaurantId, query = {}) {
    if (!restaurantId || !mongoose.Types.ObjectId.isValid(restaurantId)) return null;
    const rid = new mongoose.Types.ObjectId(restaurantId);

    // Fetch restaurant profile for header display.
    const restaurant = await FoodRestaurant.findById(rid)
        .select('restaurantName location')
        .lean();

    const address =
        restaurant?.location?.formattedAddress ||
        restaurant?.location?.address ||
        [
            restaurant?.location?.addressLine1,
            restaurant?.location?.addressLine2,
            restaurant?.location?.area,
            restaurant?.location?.city,
            restaurant?.location?.state,
            restaurant?.location?.pincode
        ].filter(Boolean).join(', ');

    const nowWindow = getFixedCurrentCycleWindow(new Date());

    // Current cycle: sum ledger payouts in the fixed window.
    const currentTransactions = await FoodTransaction.find({
        restaurantId: rid,
        status: { $in: ['captured', 'authorized'] },
        createdAt: { $gte: nowWindow.start, $lte: nowWindow.end }
    })
        .populate('orderId', 'orderId createdAt items subtotal totalAmount currency deliveryState orderStatus')
        .sort({ createdAt: -1 })
        .lean();

    const currentCycleOrders = currentTransactions.map((tx) => {
        const order = tx.orderId || {};
        const items = Array.isArray(order.items) ? order.items : [];
        const foodNames = items.map((it) => it?.name).filter(Boolean).join(', ');
        const orderTotalExclTax = Math.max(0, Number(order?.subtotal || order?.totalAmount || 0) || 0);
        return {
            orderId: order?.orderId || tx.orderReadableId,
            createdAt: tx.createdAt,
            items,
            foodNames,
            orderTotal: orderTotalExclTax,
            totalAmount:
                tx.amounts?.subscriptionAllocationAmount ||
                tx.amounts?.totalCustomerPaid ||
                order?.totalAmount ||
                0,
            payout: tx.amounts?.restaurantShare || 0,
            commission: tx.amounts?.restaurantCommission || 0,
            paymentMethod: tx.paymentMethod || order?.payment?.method,
            orderStatus: order?.orderStatus || order?.deliveryState?.currentPhase || order?.deliveryState?.status,
            status: tx.status
        };
    });

    const currentCycleEstimatedPayout = currentCycleOrders.reduce(
        (sum, o) => sum + (Number(o.payout) || 0),
        0
    );

    // Calculate global estimated payout (all unsettled transactions)
    const allUnsettledTransactions = await FoodTransaction.find({
        restaurantId: rid,
        status: { $in: ['captured', 'authorized'] },
        'settlement.isRestaurantSettled': { $ne: true }
    }).select('amounts.restaurantShare').lean();

    const globalEstimatedPayout = allUnsettledTransactions.reduce(
        (sum, tx) => sum + (Number(tx.amounts?.restaurantShare) || 0),
        0
    );

    const walletDoc = await FoodRestaurantWallet.findOne({ restaurantId: rid })
        .select('balance lockedAmount totalEarnings totalSettled')
        .lean();

    const walletBalance = Number(walletDoc?.balance || 0);
    const walletLockedAmount = Number(walletDoc?.lockedAmount || 0);
    const walletAvailableBalance = Math.max(0, walletBalance - walletLockedAmount);

    // Deduct all effective withdrawals from unsettled payout visibility only.
    // Both pending and approved reduce in-flight payout visibility; rejected should not.
    const effectiveWithdrawalsAgg = await FoodRestaurantWithdrawal.aggregate([
        {
            $match: {
                restaurantId: rid,
                $expr: {
                    $in: [
                        { $toLower: { $trim: { input: '$status' } } },
                        ['pending', 'approved']
                    ]
                }
            }
        },
        { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const totalEffectiveWithdrawals = Number(effectiveWithdrawalsAgg?.[0]?.total || 0);
    const pendingPayoutBalance = Math.max(0, globalEstimatedPayout - totalEffectiveWithdrawals);

    const currentCycle = {
        start: { ...nowWindow.startMeta },
        end: { ...nowWindow.endMeta },
        totalEarnings: currentCycleEstimatedPayout, // We still show current cycle earnings label
        totalWithdrawn: totalEffectiveWithdrawals,
        estimatedPayout: walletAvailableBalance, // Withdrawable wallet balance
        pendingPayout: pendingPayoutBalance, // Unsettled order earnings not yet credited to wallet
        walletBalance,
        walletLockedAmount,
        totalOrders: currentCycleOrders.length,
        payoutDate: null,
        grossAmount: currentCycleOrders.reduce((sum, order) => sum + (Number(order.totalAmount) || 0), 0),
        commissionAmount: currentCycleOrders.reduce((sum, order) => sum + (Number(order.commission) || 0), 0),
        orders: currentCycleOrders
    };

    // Invoice Summary (derived from current cycle or broader if needed)
    const invoiceSummary = {
        count: currentCycleOrders.length,
        subtotal: currentCycleOrders.reduce((sum, o) => sum + (Number(o.orderTotal) || 0), 0),
        taxes: currentCycleOrders.reduce((sum, o) => sum + Math.max(0, (Number(o.totalAmount) || 0) - (Number(o.orderTotal) || 0)), 0),
        gross: currentCycleOrders.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0),
        earnings: currentCycleOrders.reduce((sum, o) => sum + (Number(o.payout) || 0), 0),
        commission: currentCycleOrders.reduce((sum, o) => sum + (Number(o.commission) || 0), 0)
    };

    // Past cycles: build from provided startDate/endDate query.
    const startDate = parseISODateParam(query.startDate);
    const endDate = parseISODateParamEnd(query.endDate);

    let pastCyclesResult = { orders: [], totalOrders: 0 };
    if (startDate && endDate) {
        const pastTransactions = await FoodTransaction.find({
            restaurantId: rid,
            status: { $in: ['captured', 'authorized'] },
            createdAt: { $gte: startDate, $lte: endDate }
        })
            .populate('orderId', 'orderId createdAt items subtotal totalAmount currency deliveryState orderStatus')
            .sort({ createdAt: -1 })
            .lean();

        const pastCycleOrders = pastTransactions.map((tx) => {
            const order = tx.orderId || {};
            const items = Array.isArray(order.items) ? order.items : [];
            const foodNames = items.map((it) => it?.name).filter(Boolean).join(', ');
            const orderTotalExclTax = Math.max(0, Number(order?.subtotal || order?.totalAmount || 0) || 0);

            return {
                orderId: order?.orderId || tx.orderReadableId,
                createdAt: tx.createdAt,
                items,
                foodNames,
                orderTotal: orderTotalExclTax,
                totalAmount:
                    tx.amounts?.subscriptionAllocationAmount ||
                    tx.amounts?.totalCustomerPaid ||
                    order?.totalAmount ||
                    0,
                payout: tx.amounts?.restaurantShare || 0,
                commission: tx.amounts?.restaurantCommission || 0,
                paymentMethod: tx.paymentMethod || order?.payment?.method,
                orderStatus: order?.orderStatus || order?.deliveryState?.currentPhase || order?.deliveryState?.status,
                status: tx.status
            };
        });

        pastCyclesResult = {
            orders: pastCycleOrders,
            totalOrders: pastCycleOrders.length,
            grossAmount: pastCycleOrders.reduce((sum, order) => sum + (Number(order.totalAmount) || 0), 0),
            earnings: pastCycleOrders.reduce((sum, order) => sum + (Number(order.payout) || 0), 0),
            commission: pastCycleOrders.reduce((sum, order) => sum + (Number(order.commission) || 0), 0)
        };
    }

    return {
        restaurant: {
            name: restaurant?.restaurantName || '',
            restaurantId: restaurant?._id ? `REST${restaurant._id.toString().slice(-6).padStart(6, '0')}` : 'N/A',
            address
        },
        wallet: {
            balance: walletBalance,
            lockedAmount: walletLockedAmount,
            availableBalance: walletAvailableBalance,
            totalEarnings: Number(walletDoc?.totalEarnings || 0),
            totalSettled: Number(walletDoc?.totalSettled || 0),
        },
        currentCycle,
        invoiceSummary,
        pastCycles: pastCyclesResult
    };
}


