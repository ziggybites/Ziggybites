import mongoose from 'mongoose';

const userWalletSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true, index: true },
        balance: { type: Number, default: 0 },
        referralEarnings: { type: Number, default: 0 }
    },
    { collection: 'payment_user_wallets', timestamps: true }
);

export const FoodUserWallet = mongoose.model('FoodUserWallet', userWalletSchema);

