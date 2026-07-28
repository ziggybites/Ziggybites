import { sendResponse } from '../../../../utils/response.js';
import { ValidationError } from '../../../../core/auth/errors.js';
import {
    createMealSlot,
    deleteMealSlot,
    listMealSlots,
    toggleMealSlotStatus,
    updateMealSlot,
    updateMealSlotOrder
} from '../services/mealSlot.service.js';

const toItem = (slot) => {
    if (!slot) return slot;
    const { sortOrder, ...rest } = slot;
    return { ...rest, order: sortOrder };
};

export const listMealSlotsAdminController = async (_req, res, next) => {
    try {
        const slots = await listMealSlots();
        return sendResponse(res, 200, 'Meal slots fetched successfully', { slots: slots.map(toItem) });
    } catch (error) {
        next(error);
    }
};

export const listMealSlotsPublicController = async (_req, res, next) => {
    try {
        const slots = await listMealSlots({ publicOnly: true });
        return sendResponse(res, 200, 'Meal slots fetched successfully', { slots: slots.map(toItem) });
    } catch (error) {
        next(error);
    }
};

export const createMealSlotController = async (req, res, next) => {
    try {
        const created = await createMealSlot({ ...req.body, file: req.file });
        return sendResponse(res, 201, 'Meal slot created successfully', { slot: toItem(created) });
    } catch (error) {
        next(error);
    }
};

export const updateMealSlotController = async (req, res, next) => {
    try {
        if (!req.params.id) throw new ValidationError('Meal slot id is required');
        const updated = await updateMealSlot(req.params.id, { ...req.body, file: req.file });
        if (!updated) return sendResponse(res, 404, 'Meal slot not found', null);
        return sendResponse(res, 200, 'Meal slot updated successfully', { slot: toItem(updated) });
    } catch (error) {
        next(error);
    }
};

export const deleteMealSlotController = async (req, res, next) => {
    try {
        if (!req.params.id) throw new ValidationError('Meal slot id is required');
        const result = await deleteMealSlot(req.params.id);
        return sendResponse(res, 200, result.deleted ? 'Meal slot deleted' : 'Meal slot not found', result);
    } catch (error) {
        next(error);
    }
};

export const toggleMealSlotStatusController = async (req, res, next) => {
    try {
        if (!req.params.id) throw new ValidationError('Meal slot id is required');
        const updated = await toggleMealSlotStatus(req.params.id);
        if (!updated) return sendResponse(res, 404, 'Meal slot not found', null);
        return sendResponse(res, 200, 'Meal slot status updated', { slot: toItem(updated) });
    } catch (error) {
        next(error);
    }
};

export const updateMealSlotOrderController = async (req, res, next) => {
    try {
        if (!req.params.id) throw new ValidationError('Meal slot id is required');
        if (req.body?.order === undefined) throw new ValidationError('order is required');
        const updated = await updateMealSlotOrder(req.params.id, req.body.order);
        if (!updated) return sendResponse(res, 404, 'Meal slot not found', null);
        return sendResponse(res, 200, 'Meal slot order updated', { slot: toItem(updated) });
    } catch (error) {
        next(error);
    }
};
