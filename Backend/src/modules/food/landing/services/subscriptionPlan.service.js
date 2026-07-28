import { FoodSubscriptionPlan } from '../models/subscriptionPlan.model.js';

const defaultPlans = [
    {
        title: '7 Days',
        durationDays: 7,
        subtitle: 'Valid for 1 week',
        description: 'Short trial plan for a flexible start.',
        badge: 'Starter',
        sortOrder: 0
    },
    {
        title: '15 Days',
        durationDays: 15,
        subtitle: 'Valid for half month',
        description: 'Balanced plan for consistent weekday meals.',
        badge: 'Recommended',
        sortOrder: 1
    },
    {
        title: '30 Days',
        durationDays: 30,
        subtitle: 'Valid for 1 month',
        description: 'Standard month-long consistency plan.',
        badge: 'Most Popular',
        sortOrder: 2
    }
];

const defaultFeatures = [
    '24-hour prior delivery notification',
    'Modify, skip, or confirm each delivery',
    'No refunds on cancellation'
];

const ensureDefaultPlans = async () => {
    const count = await FoodSubscriptionPlan.countDocuments();
    if (count > 0) return;
    await FoodSubscriptionPlan.insertMany(
        defaultPlans.map((plan) => ({
            ...plan,
            features: defaultFeatures,
            isActive: true
        }))
    );
};

export const listSubscriptionPlans = async ({ publicOnly = false } = {}) => {
    await ensureDefaultPlans();
    const filter = publicOnly ? { isActive: true } : {};
    return FoodSubscriptionPlan.find(filter).sort({ sortOrder: 1, durationDays: 1 }).lean();
};

const getNextSortOrder = async () => {
    const last = await FoodSubscriptionPlan.findOne().sort({ sortOrder: -1 }).select('sortOrder').lean();
    return (last?.sortOrder ?? -1) + 1;
};

const normalizePlanPayload = (payload = {}) => {
    const features = Array.isArray(payload.features)
        ? payload.features
        : String(payload.features || '')
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean);

    return {
        title: String(payload.title || '').trim(),
        durationDays: Number(payload.durationDays),
        subtitle: String(payload.subtitle || '').trim(),
        description: String(payload.description || '').trim(),
        badge: String(payload.badge || '').trim(),
        currency: 'INR',
        features
    };
};

export const createSubscriptionPlan = async (payload) => {
    const data = normalizePlanPayload(payload);
    if (!data.title) throw new Error('Plan title is required');
    if (!Number.isFinite(data.durationDays) || data.durationDays <= 0) {
        throw new Error('Duration days must be greater than 0');
    }
    data.sortOrder = await getNextSortOrder();
    data.isActive = true;
    const doc = await FoodSubscriptionPlan.create(data);
    return doc.toObject();
};

export const updateSubscriptionPlan = async (id, payload) => {
    const doc = await FoodSubscriptionPlan.findById(id);
    if (!doc) return null;
    const data = normalizePlanPayload(payload);
    const updates = {};

    if (payload.title !== undefined) updates.title = data.title;
    if (payload.durationDays !== undefined) updates.durationDays = data.durationDays;
    if (payload.subtitle !== undefined) updates.subtitle = data.subtitle;
    if (payload.description !== undefined) updates.description = data.description;
    if (payload.badge !== undefined) updates.badge = data.badge;
    updates.currency = 'INR';
    if (payload.features !== undefined) updates.features = data.features;

    if (Object.keys(updates).length === 0) return doc.toObject();
    Object.assign(doc, updates);
    await doc.save();
    return doc.toObject();
};

export const deleteSubscriptionPlan = async (id) => {
    const doc = await FoodSubscriptionPlan.findById(id);
    if (!doc) return { deleted: false };
    await doc.deleteOne();
    return { deleted: true };
};

export const toggleSubscriptionPlanStatus = async (id) => {
    const doc = await FoodSubscriptionPlan.findById(id);
    if (!doc) return null;
    return FoodSubscriptionPlan.findByIdAndUpdate(id, { isActive: !doc.isActive }, { new: true }).lean();
};

export const updateSubscriptionPlanOrder = async (id, sortOrder) => {
    const nextOrder = Number(sortOrder);
    if (Number.isNaN(nextOrder)) return null;
    return FoodSubscriptionPlan.findByIdAndUpdate(id, { sortOrder: nextOrder }, { new: true }).lean();
};
