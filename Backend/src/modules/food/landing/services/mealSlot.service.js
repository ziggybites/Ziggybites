import { v2 as cloudinary } from 'cloudinary';
import { FoodMealSlot } from '../models/mealSlot.model.js';

const CLOUDINARY_FOLDER = 'food/meal-slots';

const defaultSlots = [
    {
        title: 'Breakfast',
        timeLabel: '7:00 AM - 10:00 AM',
        icon: 'breakfast',
        accentColor: '#f59e0b',
        backgroundColor: '#fff7e6',
        sortOrder: 0
    },
    {
        title: 'Lunch',
        timeLabel: '1:00 PM - 3:00 PM',
        icon: 'lunch',
        accentColor: '#ef4444',
        backgroundColor: '#fff1f2',
        sortOrder: 1
    },
    {
        title: 'Evening Snacks',
        timeLabel: '5:00 PM - 7:00 PM',
        icon: 'snacks',
        accentColor: '#7c3aed',
        backgroundColor: '#f5f3ff',
        sortOrder: 2
    },
    {
        title: 'Dinner',
        timeLabel: '8:00 PM - 10:00 PM',
        icon: 'dinner',
        accentColor: '#2563eb',
        backgroundColor: '#eff6ff',
        sortOrder: 3
    }
];

const uploadImageToCloudinary = (buffer) => {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { folder: CLOUDINARY_FOLDER, resource_type: 'image' },
            (err, result) => {
                if (err) return reject(err);
                resolve({ secure_url: result.secure_url, public_id: result.public_id });
            }
        );
        stream.end(buffer);
    });
};

const ensureDefaultMealSlots = async () => {
    const count = await FoodMealSlot.countDocuments();
    if (count > 0) return;
    await FoodMealSlot.insertMany(defaultSlots.map((slot) => ({ ...slot, isActive: true })));
};

export const listMealSlots = async ({ publicOnly = false } = {}) => {
    await ensureDefaultMealSlots();
    const filter = publicOnly ? { isActive: true } : {};
    return FoodMealSlot.find(filter).sort({ sortOrder: 1, createdAt: 1 }).lean();
};

const getNextSortOrder = async () => {
    const last = await FoodMealSlot.findOne().sort({ sortOrder: -1 }).select('sortOrder').lean();
    return (last?.sortOrder ?? -1) + 1;
};

const normalizeSlotPayload = (payload = {}) => {
    const title = String(payload.title || '').trim();
    const timeLabel = String(payload.timeLabel || '').trim();
    const icon = ['breakfast', 'lunch', 'snacks', 'dinner', 'meal'].includes(String(payload.icon || ''))
        ? String(payload.icon)
        : 'meal';

    return {
        title,
        timeLabel,
        description: String(payload.description || '').trim(),
        icon,
        accentColor: String(payload.accentColor || '#ef2b24').trim(),
        backgroundColor: String(payload.backgroundColor || '#fff7ed').trim()
    };
};

export const createMealSlot = async ({ file, ...payload }) => {
    const data = normalizeSlotPayload(payload);
    if (!data.title) throw new Error('Meal title is required');
    if (!data.timeLabel) throw new Error('Meal time is required');

    if (file?.buffer) {
        const uploaded = await uploadImageToCloudinary(file.buffer);
        data.imageUrl = uploaded.secure_url;
        data.publicId = uploaded.public_id;
    }

    data.sortOrder = await getNextSortOrder();
    data.isActive = true;

    const doc = await FoodMealSlot.create(data);
    return doc.toObject();
};

export const updateMealSlot = async (id, { file, ...payload }) => {
    const doc = await FoodMealSlot.findById(id);
    if (!doc) return null;

    const updates = {};
    const data = normalizeSlotPayload(payload);

    if (payload.title !== undefined) updates.title = data.title;
    if (payload.timeLabel !== undefined) updates.timeLabel = data.timeLabel;
    if (payload.description !== undefined) updates.description = data.description;
    if (payload.icon !== undefined) updates.icon = data.icon;
    if (payload.accentColor !== undefined) updates.accentColor = data.accentColor;
    if (payload.backgroundColor !== undefined) updates.backgroundColor = data.backgroundColor;

    if (file?.buffer) {
        if (doc.publicId) {
            await cloudinary.uploader.destroy(doc.publicId).catch(() => {});
        }
        const uploaded = await uploadImageToCloudinary(file.buffer);
        updates.imageUrl = uploaded.secure_url;
        updates.publicId = uploaded.public_id;
    }

    if (Object.keys(updates).length === 0) return doc.toObject();

    return FoodMealSlot.findByIdAndUpdate(id, updates, { new: true }).lean();
};

export const deleteMealSlot = async (id) => {
    const doc = await FoodMealSlot.findById(id);
    if (!doc) return { deleted: false };
    if (doc.publicId) {
        await cloudinary.uploader.destroy(doc.publicId).catch(() => {});
    }
    await doc.deleteOne();
    return { deleted: true };
};

export const toggleMealSlotStatus = async (id) => {
    const doc = await FoodMealSlot.findById(id);
    if (!doc) return null;
    return FoodMealSlot.findByIdAndUpdate(id, { isActive: !doc.isActive }, { new: true }).lean();
};

export const updateMealSlotOrder = async (id, sortOrder) => {
    const nextOrder = Number(sortOrder);
    if (Number.isNaN(nextOrder)) return null;
    return FoodMealSlot.findByIdAndUpdate(id, { sortOrder: nextOrder }, { new: true }).lean();
};
