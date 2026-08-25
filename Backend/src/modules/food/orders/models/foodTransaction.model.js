import mongoose from 'mongoose';

const foodTransactionSchema = new mongoose.Schema({
    // Identifiers
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodOrder', required: true, unique: true, index: true },

    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodUser', required: true, index: true },
    restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodRestaurant', required: true, index: true },
    deliveryPartnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodDeliveryPartner', index: true },

    // Core Payment Info
    paymentMethod: {
        type: String,
        enum: ['cash', 'razorpay', 'razorpay_qr', 'wallet', 'subscription'],
        required: false
    },
    status: {
        type: String,
        enum: ['pending', 'authorized', 'captured', 'failed', 'refunded'],
        default: 'pending',
        index: true
    },
    currency: { type: String, default: 'INR' },

    // Snapshot of order pricing at the time transaction was created
    pricing: {
        subtotal: { type: Number },
        tax: { type: Number },
        packagingFee: { type: Number },
        deliveryFee: { type: Number },
        platformFee: { type: Number },
        restaurantCommission: { type: Number },
        discount: { type: Number },
        total: { type: Number },
        currency: { type: String, trim: true },
    },

    // Snapshot of payment state at the time of transaction (source of truth for UI)
    payment: {
        method: { type: String, trim: true },
        status: { type: String, trim: true },
        amountDue: { type: Number },
        razorpay: {
            orderId: { type: String },
            paymentId: { type: String },
            signature: { type: String }
        },
        qr: {
            qrId: { type: String },
            imageUrl: { type: String },
            paymentLinkId: { type: String },
            shortUrl: { type: String },
            status: { type: String },
            expiresAt: { type: Date }
        }
    },

    // Financial Breakdown (The Split)
    amounts: {
        totalCustomerPaid: { type: Number, required: true },
        directCustomerPaidAmount: { type: Number },
        subscriptionAllocationAmount: { type: Number },
        subscriptionDeliveryFeeAmount: { type: Number },
        subscriptionPlatformFeeAmount: { type: Number },
        subscriptionGstAmount: { type: Number },
        subscriptionCouponDiscountAmount: { type: Number },
        subscriptionTotalAllocatedAmount: { type: Number },
        restaurantShare: { type: Number, required: true },
        restaurantCommission: { type: Number, required: true },
        gstOnItem: { type: Number },
        gstOnCommission: { type: Number },
        paymentGatewayFee: { type: Number },
        tcs: { type: Number },
        riderShare: { type: Number, required: true },
        platformNetProfit: { type: Number, required: true },
        taxAmount: { type: Number }
    },

    // Gateway / Provider Metadata
    gateway: {
        provider: { type: String },
        razorpayOrderId: String,
        razorpayPaymentId: String,
        razorpaySignature: String,
        qrUrl: String,
        qrExpiresAt: Date
    },

    // Settlement Tracking
    settlement: {
        isRestaurantSettled: { type: Boolean, default: false },
        restaurantSettledAt: Date,
        isRiderSettled: { type: Boolean, default: false },
        riderSettledAt: Date
    },

    // Audit History (Replacing FoodOrderPayment ledger)
    history: [{
        kind: { type: String, required: true }, // 'created', 'authorized', 'captured', 'refunded', 'settled'
        amount: Number,
        at: { type: Date, default: Date.now },
        note: String,
        recordedBy: {
            role: { type: String },
            id: { type: mongoose.Schema.Types.ObjectId }
        }
    }]
}, {
    collection: 'payment_food_transactions',
    timestamps: true
});

// Powerful indexes for Finance & Analytics
foodTransactionSchema.index({ createdAt: -1 });
foodTransactionSchema.index({ 'settlement.isRestaurantSettled': 1, restaurantId: 1 });
foodTransactionSchema.index({ 'status': 1, paymentMethod: 1 });

export const FoodTransaction = mongoose.model('FoodTransaction', foodTransactionSchema);
