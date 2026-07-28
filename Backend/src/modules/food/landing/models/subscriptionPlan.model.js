import mongoose from 'mongoose';

const subscriptionPlanSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true
        },
        durationDays: {
            type: Number,
            required: true,
            min: 1
        },
        subtitle: {
            type: String,
            trim: true,
            default: ''
        },
        description: {
            type: String,
            trim: true,
            default: ''
        },
        badge: {
            type: String,
            trim: true,
            default: ''
        },
        currency: {
            type: String,
            trim: true,
            uppercase: true,
            default: 'INR'
        },
        features: {
            type: [String],
            default: []
        },
        sortOrder: {
            type: Number,
            default: 0,
            index: true
        },
        isActive: {
            type: Boolean,
            default: true,
            index: true
        },
    },
    {
        collection: 'food_subscription_plans',
        timestamps: true
    }
);

subscriptionPlanSchema.index({ isActive: 1, sortOrder: 1 });

export const FoodSubscriptionPlan = mongoose.model('FoodSubscriptionPlan', subscriptionPlanSchema);
