import mongoose from 'mongoose';

const subscriptionPurchaseHistorySchema = new mongoose.Schema(
  {
    kind: {
      type: String,
      trim: true,
      default: 'created',
    },
    amount: {
      type: Number,
      default: 0,
      min: 0,
    },
    note: {
      type: String,
      trim: true,
      default: '',
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: undefined,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false },
);

const subscriptionPurchaseTransactionSchema = new mongoose.Schema(
  {
    subscriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FoodSubscription',
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FoodUser',
      required: true,
      index: true,
    },
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FoodRestaurant',
      required: true,
      index: true,
    },
    paymentMethod: {
      type: String,
      trim: true,
      default: 'razorpay',
    },
    status: {
      type: String,
      enum: ['created', 'pending', 'paid', 'failed', 'refunded'],
      default: 'created',
      index: true,
    },
    pricing: {
      foodSubtotal: { type: Number, default: 0, min: 0 },
      gstRate: { type: Number, default: 0, min: 0 },
      gstAmount: { type: Number, default: 0, min: 0 },
      deliveryFeePerDay: { type: Number, default: 0, min: 0 },
      deliveryCharges: { type: Number, default: 0, min: 0 },
      totalBeforeDiscount: { type: Number, default: 0, min: 0 },
      couponCode: { type: String, trim: true, uppercase: true, default: '' },
      couponDiscount: { type: Number, default: 0, min: 0 },
      totalAmount: { type: Number, default: 0, min: 0 },
      currency: { type: String, trim: true, default: 'INR' },
    },
    payment: {
      method: { type: String, trim: true, default: 'razorpay' },
      status: { type: String, trim: true, default: 'created' },
      amountDue: { type: Number, default: 0, min: 0 },
      amountPaid: { type: Number, default: 0, min: 0 },
      paidAt: { type: Date, default: null },
      razorpay: {
        orderId: { type: String, trim: true, default: '' },
        paymentId: { type: String, trim: true, default: '' },
        signature: { type: String, trim: true, default: '' },
      },
    },
    gateway: {
      razorpayOrderId: { type: String, trim: true, default: '' },
      razorpayPaymentId: { type: String, trim: true, default: '' },
      razorpaySignature: { type: String, trim: true, default: '' },
    },
    history: {
      type: [subscriptionPurchaseHistorySchema],
      default: [],
    },
  },
  {
    collection: 'payment_subscription_transactions',
    timestamps: true,
  },
);

export const PaymentSubscriptionTransaction = mongoose.model(
  'PaymentSubscriptionTransaction',
  subscriptionPurchaseTransactionSchema,
);
