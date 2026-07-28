import mongoose from 'mongoose';

const subscriptionDeliveryAddressSchema = new mongoose.Schema(
  {
    label: { type: String, default: 'Home', trim: true },
    name: { type: String, default: '', trim: true },
    fullName: { type: String, default: '', trim: true },
    street: { type: String, default: '', trim: true },
    additionalDetails: { type: String, default: '', trim: true },
    city: { type: String, default: '', trim: true },
    state: { type: String, default: '', trim: true },
    zipCode: { type: String, default: '', trim: true },
    phone: { type: String, default: '', trim: true },
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: undefined },
    },
  },
  { _id: false },
);

const foodSubscriptionSchema = new mongoose.Schema(
  {
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
    dishId: {
      type: String,
      required: true,
      trim: true,
    },
    dishName: {
      type: String,
      required: true,
      trim: true,
    },
    restaurantName: {
      type: String,
      trim: true,
      default: '',
    },
    meals: {
      type: [String],
      default: [],
    },
    customerName: {
      type: String,
      trim: true,
      default: '',
    },
    customerPhone: {
      type: String,
      trim: true,
      default: '',
    },
    deliveryAddress: {
      type: subscriptionDeliveryAddressSchema,
      default: null,
    },
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FoodSubscriptionPlan',
      default: null,
      index: true,
    },
    planTitle: {
      type: String,
      trim: true,
      default: '',
    },
    planDays: {
      type: Number,
      required: true,
      min: 1,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 1,
    },
    creditPerOrder: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalCredits: {
      type: Number,
      default: 0,
      min: 0,
    },
    usedCredits: {
      type: Number,
      default: 0,
      min: 0,
    },
    currency: {
      type: String,
      trim: true,
      default: 'INR',
    },
    status: {
      type: String,
      enum: ['pending_payment', 'active', 'payment_failed', 'cancelled'],
      default: 'pending_payment',
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: ['created', 'authenticated', 'paid', 'failed'],
      default: 'created',
      index: true,
    },
    razorpayPlanId: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    razorpaySubscriptionId: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    razorpayOrderId: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    razorpayPaymentId: {
      type: String,
      trim: true,
      default: '',
    },
    razorpaySignature: {
      type: String,
      trim: true,
      default: '',
    },
    startDate: {
      type: Date,
      default: null,
    },
    endDate: {
      type: Date,
      default: null,
    },
  },
  {
    collection: 'food_subscriptions',
    timestamps: true,
  },
);

foodSubscriptionSchema.index({ userId: 1, status: 1, createdAt: -1 });

export const FoodSubscription = mongoose.model(
  'FoodSubscription',
  foodSubscriptionSchema,
);
