import { sendResponse, sendError } from '../../../../utils/response.js';
import { FoodRestaurantWithdrawal } from '../models/foodRestaurantWithdrawal.model.js';
import { FoodRestaurantWallet } from '../models/restaurantWallet.model.js';

export const createWithdrawalRequestController = async (req, res, next) => {
    try {
        const restaurantId = req.user?.userId;
        const { amount, bankDetails } = req.body;
        const withdrawalAmount = Number(amount);

        if (!restaurantId) return sendError(res, 401, 'Restaurant authentication required');
        if (!Number.isFinite(withdrawalAmount) || withdrawalAmount <= 0) {
            return sendError(res, 400, 'Invalid withdrawal amount');
        }

        const reservedWallet = await FoodRestaurantWallet.findOneAndUpdate(
            {
                restaurantId,
                $expr: {
                    $gte: [
                        { $subtract: [{ $ifNull: ['$balance', 0] }, { $ifNull: ['$lockedAmount', 0] }] },
                        withdrawalAmount
                    ]
                }
            },
            { $inc: { lockedAmount: withdrawalAmount } },
            { new: true }
        ).lean();

        if (!reservedWallet) {
            const wallet = await FoodRestaurantWallet.findOne({ restaurantId })
                .select('balance lockedAmount')
                .lean();
            const availableBalance = Math.max(0, Number(wallet?.balance || 0) - Number(wallet?.lockedAmount || 0));
            return sendError(res, 400, `Insufficient balance. Available: ₹${availableBalance.toFixed(2)}`);
        }

        const withdrawal = new FoodRestaurantWithdrawal({
            restaurantId,
            amount: withdrawalAmount,
            bankDetails,
            status: 'pending'
        });

        try {
            await withdrawal.save();
        } catch (error) {
            await FoodRestaurantWallet.updateOne(
                { restaurantId },
                { $inc: { lockedAmount: -withdrawalAmount } }
            );
            throw error;
        }

        return sendResponse(res, 201, 'Withdrawal request submitted successfully', withdrawal);
    } catch (error) {
        next(error);
    }
};

export const listMyWithdrawalsController = async (req, res, next) => {
    try {
        const restaurantId = req.user?.userId;
        if (!restaurantId) return sendError(res, 401, 'Restaurant authentication required');

        const withdrawals = await FoodRestaurantWithdrawal.find({ restaurantId })
            .sort({ createdAt: -1 })
            .lean();

        return sendResponse(res, 200, 'Withdrawals fetched successfully', withdrawals);
    } catch (error) {
        next(error);
    }
};
