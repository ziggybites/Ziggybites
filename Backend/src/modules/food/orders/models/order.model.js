import mongoose from 'mongoose';

// Delivery order:
// execution record created when a normal order or subscription meal is sent to delivery.
// This model owns dispatch, rider assignment, tracking, OTP, payment execution snapshot,
// and delivery lifecycle state.
const orderItemSchema = new mongoose.Schema(
    {
        itemId: { type: String, required: true, trim: true },
        name: { type: String, required: true, trim: true },
        variantId: { type: String, trim: true, default: '' },
        variantName: { type: String, trim: true, default: '' },
        variantPrice: { type: Number, min: 0, default: 0 },
        price: { type: Number, required: true, min: 0 },
        quantity: { type: Number, required: true, min: 1 },
        isVeg: { type: Boolean, default: true },
        image: { type: String, default: '' },
        notes: { type: String, default: '' }
    },
    { _id: false }
);

const deliveryAddressSchema = new mongoose.Schema(
    {
        label: { type: String, enum: ['Home', 'Office', 'Other'], default: 'Home' },
        name: { type: String, default: '', trim: true },
        fullName: { type: String, default: '', trim: true },
        street: { type: String, required: true, trim: true },
        additionalDetails: { type: String, default: '', trim: true },
        city: { type: String, required: true, trim: true },
        state: { type: String, required: true, trim: true },
        zipCode: { type: String, default: '', trim: true },
        phone: { type: String, default: '', trim: true },
        location: {
            type: { type: String, enum: ['Point'], default: 'Point' },
            coordinates: { type: [Number], default: undefined }
        }
    },
    { _id: false }
);

/* Legacy unused payment schema retained only as a commented block during cleanup.
const paymentSchema = new mongoose.Schema(
    {
        method: {
            type: String,
            enum: ['cash', 'razorpay', 'razorpay_qr', 'wallet', 'subscription'],
            required: true
        },
        status: {
            type: String,
            enum: [
                'cod_pending',
                'created',
                'authorized',
                'paid',
                'failed',
                'refunded',
                'pending_qr'
            ],
            default: 'cod_pending'
        },
        amountDue: { type: Number, min: 0 },
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
        },
        // ✅ NEW: Added refund object to track refund status without breaking existing flow
        refund: {
            status: { 
                type: String, 
                enum: ['none', 'pending', 'processed', 'failed'], 
                default: 'none' 
            },
            destination: {
                type: String,
                enum: ['source', 'wallet'],
                default: 'source'
            },
            amount: { type: Number, default: 0 },
            refundId: { type: String, default: '' },
            processedAt: { type: Date }
        }
    },
    { _id: false }
);
*/

const subscriptionUsageSchema = new mongoose.Schema(
    {
        subscriptionId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodSubscription', default: null },
        planId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodSubscriptionPlan', default: null },
        planTitle: { type: String, default: '', trim: true },
        creditPerOrder: { type: Number, default: 0, min: 0 },
        subscriptionCreditApplied: { type: Number, default: 0, min: 0 },
        walletCreditAmount: { type: Number, default: 0, min: 0 },
        payableTotal: { type: Number, default: 0, min: 0 },
        status: { type: String, enum: ['none', 'pending_payment', 'applied'], default: 'none' },
        appliedAt: { type: Date, default: null }
    },
    { _id: false }
);
const dispatchSchema = new mongoose.Schema(
    {
        modeAtCreation: { type: String, enum: ['auto'], default: 'auto' },
        status: {
            type: String,
            enum: ['unassigned', 'assigned', 'accepted', 'rejected', 'cancelled'],
            default: 'unassigned'
        },
        deliveryPartnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodDeliveryPartner', default: null },
        assignedAt: { type: Date },
        acceptedAt: { type: Date },
        /** List of partners who were offered this order (to avoid repeats and track timeouts) */
        offeredTo: [{
            partnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodDeliveryPartner' },
            at: { type: Date, default: Date.now },
            action: { type: String, enum: ['offered', 'rejected', 'timeout'], default: 'offered' },
            allowOverLimit: { type: Boolean, default: false },
            requiredCashForOrder: { type: Number, default: 0 }
        }],
        dispatchingAt: { type: Date },
        lastRequestedAt: { type: Date },
        phase3AlertedAt: { type: Date, default: null }
    },
    { _id: false }
);

function applyLegacyPricingToTopLevel(target = {}) {
    const pricing = target?.pricing || {};
    if (!pricing || typeof pricing !== 'object') return target;

    if (target.subtotal == null) target.subtotal = Number(pricing.subtotal || 0);
    if (target.tax == null) target.tax = Number(pricing.tax || 0);
    if (target.packagingFee == null) target.packagingFee = Number(pricing.packagingFee || 0);
    if (target.deliveryFee == null) target.deliveryFee = Number(pricing.deliveryFee || 0);
    if (target.platformFee == null) target.platformFee = Number(pricing.platformFee || 0);
    if (target.restaurantCommission == null) target.restaurantCommission = Number(pricing.restaurantCommission || 0);
    if (target.gstOnItem == null) target.gstOnItem = Number(pricing.gstOnItem || 0);
    if (target.gstOnCommission == null) target.gstOnCommission = Number(pricing.gstOnCommission || 0);
    if (target.paymentGatewayFee == null) target.paymentGatewayFee = Number(pricing.paymentGatewayFee || 0);
    if (target.tcs == null) target.tcs = Number(pricing.tcs || 0);
    if (target.discount == null) target.discount = Number(pricing.discount || 0);
    if (target.originalTotal == null) target.originalTotal = Number(pricing.originalTotal || 0);
    if (target.payableTotal == null) target.payableTotal = Number(pricing.payableTotal || 0);
    if (target.subscriptionCreditApplied == null) target.subscriptionCreditApplied = Number(pricing.subscriptionCreditApplied || 0);
    if (target.subscriptionWalletCredit == null) target.subscriptionWalletCredit = Number(pricing.subscriptionWalletCredit || 0);
    if (target.itemDiscount == null) target.itemDiscount = Number(pricing.itemDiscount || 0);
    if (target.couponDiscount == null) target.couponDiscount = Number(pricing.couponDiscount || 0);
    if (target.totalAmount == null) target.totalAmount = Number(pricing.total || 0);
    if (!target.currency) target.currency = String(pricing.currency || 'INR');
    if (!target.couponCode) target.couponCode = String(pricing.couponCode || '');

    return target;
}

const deliveryStateSchema = new mongoose.Schema(
    {
        currentPhase: {
            type: String,
            enum: [
                'en_route_to_pickup',
                'at_pickup',
                'en_route_to_delivery',
                'at_drop',
                'delivered',
                'completed'
            ],
            default: 'en_route_to_pickup'
        },
        status: { type: String, default: '' },
        reachedPickupAt: { type: Date, default: null },
        reachedDropAt: { type: Date, default: null },
        pickedUpAt: { type: Date, default: null },
        deliveredAt: { type: Date, default: null }
    },
    { _id: false }
);

const statusHistorySchema = new mongoose.Schema(
    {
        at: { type: Date, default: Date.now },
        byRole: { type: String, enum: ['USER', 'RESTAURANT', 'DELIVERY_PARTNER', 'ADMIN', 'SYSTEM'] },
        byId: { type: mongoose.Schema.Types.ObjectId },
        from: { type: String },
        to: { type: String },
        note: { type: String, default: '' }
    },
    { _id: false }
);

const orderEntityRatingSchema = new mongoose.Schema(
    {
        rating: { type: Number, min: 1, max: 5 },
        comment: { type: String, default: '', trim: true },
        ratedAt: { type: Date, default: Date.now }
    },
    { _id: false }
);

const orderRatingsSchema = new mongoose.Schema(
    {
        restaurant: { type: orderEntityRatingSchema, default: undefined },
        deliveryPartner: { type: orderEntityRatingSchema, default: undefined }
    },
    { _id: false }
);

const deliveryVerificationSchema = new mongoose.Schema(
    {
        dropOtp: {
            required: { type: Boolean, default: false },
            verified: { type: Boolean, default: false }
        },
        pickupOtp: {
            required: { type: Boolean, default: true },
            verified: { type: Boolean, default: false },
            requestedAt: { type: Date, default: null }
        }
    },
    { _id: false }
);

const orderSchema = new mongoose.Schema(
    {
        order_id: {
            type: String,
            unique: true,
            sparse: true,
            index: true
        },
        /** Compatibility alias: satisfies rogue unique index 'orderId_1' found in legacy deployments. */
        orderId: {
            type: String,
            unique: true,
            sparse: true,
            index: true
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'FoodUser',
            required: true
        },
        restaurantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'FoodRestaurant',
            required: true
        },
        zoneId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'FoodZone',
            index: true
        },
        transactionId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'FoodTransaction',
            index: true
        },
        items: {
            type: [orderItemSchema],
            required: true,
            validate: (v) => Array.isArray(v) && v.length > 0
        },
        deliveryAddress: {
            type: deliveryAddressSchema,
            required: true
        },
        customerName: { type: String, default: '', trim: true },
        customerPhone: { type: String, default: '', trim: true },
        subtotal: { type: Number, default: 0, min: 0 },
        tax: { type: Number, default: 0, min: 0 },
        packagingFee: { type: Number, default: 0, min: 0 },
        deliveryFee: { type: Number, default: 0, min: 0 },
        platformFee: { type: Number, default: 0, min: 0 },
        restaurantCommission: { type: Number, default: 0, min: 0 },
        gstOnItem: { type: Number, default: 0, min: 0 },
        gstOnCommission: { type: Number, default: 0, min: 0 },
        paymentGatewayFee: { type: Number, default: 0, min: 0 },
        tcs: { type: Number, default: 0, min: 0 },
        discount: { type: Number, default: 0, min: 0 },
        originalTotal: { type: Number, default: 0, min: 0 },
        payableTotal: { type: Number, default: 0, min: 0 },
        subscriptionCreditApplied: { type: Number, default: 0, min: 0 },
        subscriptionWalletCredit: { type: Number, default: 0, min: 0 },
        itemDiscount: { type: Number, default: 0, min: 0 },
        couponDiscount: { type: Number, default: 0, min: 0 },
        totalAmount: { type: Number, default: 0, min: 0 },
        currency: { type: String, default: 'INR', trim: true },
        couponCode: { type: String, default: '', trim: true },
        subscriptionUsage: {
            type: subscriptionUsageSchema,
            required: false
        },
        orderStatus: {
            type: String,
            enum: [
                'created',
                'confirmed',
                'preparing',
                'ready_for_pickup',
                'reached_pickup',
                'picked_up',
                'reached_drop',
                'delivered',
                'cancelled_by_user',
                'cancelled_by_restaurant',
                'cancelled_by_admin',
                'dead'
            ],
            default: 'created'
        },
        dispatch: {
            type: dispatchSchema,
            default: () => ({})
        },
        deliveryState: {
            type: deliveryStateSchema,
            default: () => ({})
        },
        statusHistory: {
            type: [statusHistorySchema],
            default: []
        },
        ratings: {
            type: orderRatingsSchema,
            default: () => ({})
        },
        restaurantNote: { type: String, default: '', trim: true },
        note: { type: String, default: '', trim: true },
        sendCutlery: { type: Boolean, default: true },
        deliveryFleet: { type: String, default: 'standard', trim: true },
        scheduledAt: { type: Date, default: null },
        riderEarning: { type: Number, default: 0, min: 0 },
        deliveryBonusAmount: { type: Number, default: 0, min: 0 },
        platformProfit: { type: Number, default: 0, min: 0 },
        /** Plain 4-digit OTP for pickup at restaurant. */
        pickupOtp: { type: String, default: '', select: false },
        /** Plain 4-digit OTP for handover; cleared after successful verify (never expose to partner in API responses). */
        deliveryOtp: { type: String, default: '', select: false },
        deliveryVerification: {
            type: deliveryVerificationSchema,
            default: () => ({})
        },
        /** Latest rider location for this specific order (GeoJSON Point) */
        lastRiderLocation: {
            type: { type: String, enum: ['Point'] },
            coordinates: { type: [Number] }
        },
    },
    {
        collection: 'food_orders',
        timestamps: true,
        toJSON: { virtuals: false },
        toObject: { virtuals: false }
    }
);

orderSchema.virtual('pricing')
    .get(function () {
        return {
            subtotal: Number(this.subtotal || 0),
            tax: Number(this.tax || 0),
            packagingFee: Number(this.packagingFee || 0),
            deliveryFee: Number(this.deliveryFee || 0),
            platformFee: Number(this.platformFee || 0),
            restaurantCommission: Number(this.restaurantCommission || 0),
            gstOnItem: Number(this.gstOnItem || 0),
            gstOnCommission: Number(this.gstOnCommission || 0),
            paymentGatewayFee: Number(this.paymentGatewayFee || 0),
            tcs: Number(this.tcs || 0),
            discount: Number(this.discount || 0),
            originalTotal: Number(this.originalTotal || 0),
            payableTotal: Number(this.payableTotal || 0),
            subscriptionCreditApplied: Number(this.subscriptionCreditApplied || 0),
            subscriptionWalletCredit: Number(this.subscriptionWalletCredit || 0),
            itemDiscount: Number(this.itemDiscount || 0),
            couponDiscount: Number(this.couponDiscount || 0),
            total: Number(this.totalAmount || 0),
            currency: String(this.currency || 'INR'),
            couponCode: this.couponCode || '',
        };
    })
    .set(function (value) {
        const pricing = value || {};
        this.subtotal = Number(pricing.subtotal || 0);
        this.tax = Number(pricing.tax || 0);
        this.packagingFee = Number(pricing.packagingFee || 0);
        this.deliveryFee = Number(pricing.deliveryFee || 0);
        this.platformFee = Number(pricing.platformFee || 0);
        this.restaurantCommission = Number(pricing.restaurantCommission || 0);
        this.gstOnItem = Number(pricing.gstOnItem || 0);
        this.gstOnCommission = Number(pricing.gstOnCommission || 0);
        this.paymentGatewayFee = Number(pricing.paymentGatewayFee || 0);
        this.tcs = Number(pricing.tcs || 0);
        this.discount = Number(pricing.discount || 0);
        this.originalTotal = Number(pricing.originalTotal || 0);
        this.payableTotal = Number(pricing.payableTotal || 0);
        this.subscriptionCreditApplied = Number(pricing.subscriptionCreditApplied || 0);
        this.subscriptionWalletCredit = Number(pricing.subscriptionWalletCredit || 0);
        this.itemDiscount = Number(pricing.itemDiscount || 0);
        this.couponDiscount = Number(pricing.couponDiscount || 0);
        this.totalAmount = Number(pricing.total || 0);
        this.currency = String(pricing.currency || 'INR');
        this.couponCode = String(pricing.couponCode || '');
    });

orderSchema.index({ 'deliveryAddress.location': '2dsphere' });
orderSchema.index({ lastRiderLocation: '2dsphere' });
orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ restaurantId: 1, orderStatus: 1, createdAt: -1 });
orderSchema.index({ 'dispatch.deliveryPartnerId': 1, orderStatus: 1 });
orderSchema.index({ 'dispatch.status': 1, orderStatus: 1 });
orderSchema.index({ 'dispatch.status': 1, orderStatus: 1, updatedAt: -1 });
orderSchema.index({ 'dispatch.deliveryPartnerId': 1, 'dispatch.status': 1, updatedAt: -1 });

orderSchema.pre('init', function (data) {
    applyLegacyPricingToTopLevel(data);
});

orderSchema.pre('save', async function (next) {
    if (!this.order_id) {
        const timestamp = Date.now().toString().slice(-4);
        const random = Math.floor(100 + Math.random() * 900);
        this.order_id = `FOD-${timestamp}${random}`;
    }
    // Synchronize camelCase alias to satisfy unique index 'orderId_1'
    if (this.order_id) {
        this.orderId = this.order_id;
    }
    next();
});

export const FoodOrder = mongoose.model('FoodOrder', orderSchema);

const settingsSchema = new mongoose.Schema(
    {
        key: { type: String, required: true, unique: true, trim: true },
        dispatchMode: { type: String, enum: ['auto'], default: 'auto' },
        updatedBy: {
            role: { type: String },
            adminId: { type: mongoose.Schema.Types.ObjectId },
            at: { type: Date }
        }
    },
    { collection: 'food_settings', timestamps: true }
);

export const FoodSettings = mongoose.model('FoodSettings', settingsSchema);

