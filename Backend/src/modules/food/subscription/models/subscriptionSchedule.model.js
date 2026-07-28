import mongoose from 'mongoose';

const subscriptionScheduleSchema = new mongoose.Schema(
  {
    subscriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FoodSubscription',
      required: true,
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
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FoodSubscriptionPlan',
      default: null,
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
    mealName: {
      type: String,
      required: true,
      trim: true,
    },
    serviceDate: {
      type: Date,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['scheduled', 'sent_to_delivery', 'skipped', 'cancelled'],
      default: 'scheduled',
      index: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FoodOrder',
      default: null,
      index: true,
    },
    dishChange: {
      originalDishId: { type: String, trim: true, default: '' },
      originalDishName: { type: String, trim: true, default: '' },
      oldPrice: { type: Number, default: 0 },
      newPrice: { type: Number, default: 0 },
      priceDifference: { type: Number, default: 0 },
      walletCreditAmount: { type: Number, default: 0 },
      paidAmount: { type: Number, default: 0 },
      changedAt: { type: Date, default: null },
      razorpayOrderId: { type: String, trim: true, default: '' },
      razorpayPaymentId: { type: String, trim: true, default: '' },
    },
    pendingDishChange: {
      dishId: { type: String, trim: true, default: '' },
      dishName: { type: String, trim: true, default: '' },
      oldPrice: { type: Number, default: 0 },
      newPrice: { type: Number, default: 0 },
      priceDifference: { type: Number, default: 0 },
      razorpayOrderId: { type: String, trim: true, default: '' },
      createdAt: { type: Date, default: null },
    },
    sentAt: {
      type: Date,
      default: null,
    },
    dishChangeReminderSentAt: {
      type: Date,
      default: null,
    },
    addressChangeReminderSentAt: {
      type: Date,
      default: null,
    },
    skippedAt: {
      type: Date,
      default: null,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
  },
  {
    collection: 'food_subscription_schedules',
    timestamps: true,
  },
);

subscriptionScheduleSchema.index(
  { subscriptionId: 1, serviceDate: 1, mealName: 1 },
  { unique: true },
);
subscriptionScheduleSchema.index({ restaurantId: 1, serviceDate: 1, status: 1 });

export const FoodSubscriptionSchedule = mongoose.model(
  'FoodSubscriptionSchedule',
  subscriptionScheduleSchema,
);
