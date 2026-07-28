import mongoose from 'mongoose';

const mealSlotSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true
        },
        timeLabel: {
            type: String,
            required: true,
            trim: true
        },
        description: {
            type: String,
            trim: true,
            default: ''
        },
        icon: {
            type: String,
            enum: ['breakfast', 'lunch', 'snacks', 'dinner', 'meal'],
            default: 'meal'
        },
        accentColor: {
            type: String,
            trim: true,
            default: '#ef2b24'
        },
        backgroundColor: {
            type: String,
            trim: true,
            default: '#fff7ed'
        },
        imageUrl: {
            type: String,
            trim: true,
            default: ''
        },
        publicId: {
            type: String,
            trim: true,
            default: ''
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
        }
    },
    {
        collection: 'food_meal_slots',
        timestamps: true
    }
);

mealSlotSchema.index({ isActive: 1, sortOrder: 1 });

export const FoodMealSlot = mongoose.model('FoodMealSlot', mealSlotSchema);
