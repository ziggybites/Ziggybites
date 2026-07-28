import mongoose from 'mongoose';

export const DEFAULT_FOOD_NUTRITION = {
    calories: 520,
    protein: 24,
    fiber: 18,
    carbohydrates: null,
    fat: null,
    weightPerServing: null,
    allergens: ''
};

const foodVariantSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        price: { type: Number, required: true, min: 0 }
    },
    { _id: true }
);

const nutritionSchema = new mongoose.Schema(
    {
        calories: { type: Number, default: null, min: 0 },
        protein: { type: Number, default: null, min: 0 },
        fiber: { type: Number, default: null, min: 0 },
        carbohydrates: { type: Number, default: null, min: 0 },
        fat: { type: Number, default: null, min: 0 },
        weightPerServing: { type: Number, default: null, min: 0 },
        allergens: { type: String, trim: true, default: '' }
    },
    { _id: false }
);

const foodSchema = new mongoose.Schema(
    {
        restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodRestaurant', required: true, index: true },
        categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodCategory', index: true },
        categoryName: { type: String, trim: true, default: '' },
        name: { type: String, required: true, trim: true, index: true },
        description: { type: String, trim: true, default: '' },
        price: { type: Number, required: true, min: 0 },
        priceOnOtherPlatforms: { type: Number, default: null, min: 0 },
        otherPlatformGst: { type: Number, default: null, min: 0, max: 100 },
        variants: { type: [foodVariantSchema], default: [] },
        image: { type: String, trim: true, default: '' },
        foodType: { type: String, enum: ['Veg', 'Non-Veg'], default: 'Non-Veg' },
        tag: { type: String, enum: ['Healthy', 'Normal'], default: 'Normal', index: true },
        nutrition: { type: nutritionSchema, default: () => ({ ...DEFAULT_FOOD_NUTRITION }) },
        isAvailable: { type: Boolean, default: true, index: true },
        preparationTime: { type: String, trim: true, default: '' },
        approvalStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'approved', index: true },
        rejectionReason: { type: String, trim: true, default: '' },
        requestedAt: { type: Date },
        approvedAt: { type: Date },
        rejectedAt: { type: Date }
    },
    {
        collection: 'food_items',
        timestamps: true
    }
);

foodSchema.index({ restaurantId: 1, createdAt: -1 });
foodSchema.index({ approvalStatus: 1, createdAt: -1 });
foodSchema.index({ approvalStatus: 1, requestedAt: -1 });
foodSchema.index({ restaurantId: 1, approvalStatus: 1, createdAt: -1 });
foodSchema.index({ tag: 1, categoryId: 1, approvalStatus: 1 });

export const FoodItem = mongoose.model('FoodItem', foodSchema);
