import mongoose from 'mongoose';
import { creditWallet } from '../../../../core/payments/wallet.service.js';
import { FoodTransaction } from '../models/foodTransaction.model.js';
import { FoodDeliveryWallet } from '../../delivery/models/deliveryWallet.model.js';
import { logger } from '../../../../utils/logger.js';

const DISTRIBUTION_HISTORY_KIND = 'wallet_distribution_completed';

function hasDistributionHistory(transactionDoc) {
    return Array.isArray(transactionDoc?.history)
        && transactionDoc.history.some((row) => row?.kind === DISTRIBUTION_HISTORY_KIND);
}

export async function distributeCompletedOrderFinance(orderId, details = {}) {
    const session = await mongoose.startSession();

    try {
        let result = null;

        await session.withTransaction(async () => {
            const transaction = await FoodTransaction.findOne({ orderId }).session(session);
            if (!transaction) {
                throw new Error(`FoodTransaction not found for order ${orderId}`);
            }

            if (hasDistributionHistory(transaction)) {
                result = {
                    alreadyDistributed: true,
                    transactionId: String(transaction._id),
                };
                return;
            }

            const restaurantShare = Math.max(0, Number(transaction.amounts?.restaurantShare || 0));
            const riderShare = Math.max(0, Number(transaction.amounts?.riderShare || 0));
            const platformProfit = Math.max(0, Number(transaction.amounts?.platformNetProfit || 0));
            const paymentMethod = String(transaction.paymentMethod || transaction.payment?.method || '');
            const orderMongoId = String(transaction.orderId);
            const orderDisplayId = String(details.orderDisplayId || transaction.orderId);

            if (transaction.restaurantId && restaurantShare > 0) {
                await creditWallet({
                    entityType: 'restaurant',
                    entityId: transaction.restaurantId,
                    amount: restaurantShare,
                    description: `Order ${orderDisplayId} - restaurant earning`,
                    category: 'restaurant_earning',
                    orderId: orderMongoId,
                    metadata: { paymentMethod, source: 'food_order_delivery_complete' },
                    session,
                });
            }

            if (transaction.deliveryPartnerId && riderShare > 0) {
                await creditWallet({
                    entityType: 'deliveryBoy',
                    entityId: transaction.deliveryPartnerId,
                    amount: riderShare,
                    description: `Order ${orderDisplayId} - delivery earning`,
                    category: 'delivery_earning',
                    orderId: orderMongoId,
                    metadata: { paymentMethod, source: 'food_order_delivery_complete' },
                    session,
                });

                await FoodDeliveryWallet.updateOne(
                    { deliveryPartnerId: transaction.deliveryPartnerId },
                    {
                        $inc: {
                            totalDeliveries: 1,
                            ...(paymentMethod === 'cash'
                                ? { cashInHand: Math.max(0, Number(transaction.amounts?.totalCustomerPaid || 0)) }
                                : {}),
                        },
                    },
                    { session, upsert: true }
                );
            }

            if (platformProfit > 0) {
                await creditWallet({
                    entityType: 'admin',
                    entityId: 'platform',
                    amount: platformProfit,
                    description: `Order ${orderDisplayId} - platform profit`,
                    category: 'platform_profit',
                    orderId: orderMongoId,
                    metadata: { paymentMethod, source: 'food_order_delivery_complete' },
                    session,
                });
            }

            transaction.settlement = {
                ...(transaction.settlement?.toObject?.() || transaction.settlement || {}),
                isRestaurantSettled: restaurantShare > 0,
                restaurantSettledAt: restaurantShare > 0 ? new Date() : transaction.settlement?.restaurantSettledAt,
                isRiderSettled: riderShare > 0,
                riderSettledAt: riderShare > 0 ? new Date() : transaction.settlement?.riderSettledAt,
            };

            transaction.history.push({
                kind: DISTRIBUTION_HISTORY_KIND,
                amount:
                    Number(transaction.amounts?.subscriptionAllocationAmount || 0) ||
                    Number(transaction.amounts?.totalCustomerPaid || 0) ||
                    0,
                at: new Date(),
                note: `Wallet distribution completed. Restaurant=${restaurantShare}, Rider=${riderShare}, Platform=${platformProfit}`,
                recordedBy: {
                    role: details.recordedByRole || 'SYSTEM',
                    id: details.recordedById,
                },
            });

            await transaction.save({ session });

            result = {
                alreadyDistributed: false,
                transactionId: String(transaction._id),
                restaurantShare,
                riderShare,
                platformProfit,
            };
        });

        return result;
    } catch (error) {
        logger.error(`distributeCompletedOrderFinance failed for ${orderId}: ${error.message}`);
        throw error;
    } finally {
        await session.endSession();
    }
}
