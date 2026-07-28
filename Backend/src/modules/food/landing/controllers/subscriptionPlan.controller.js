import { sendResponse } from '../../../../utils/response.js';
import { ValidationError } from '../../../../core/auth/errors.js';
import {
    createSubscriptionPlan,
    deleteSubscriptionPlan,
    listSubscriptionPlans,
    toggleSubscriptionPlanStatus,
    updateSubscriptionPlan,
    updateSubscriptionPlanOrder
} from '../services/subscriptionPlan.service.js';

const toItem = (plan) => {
    if (!plan) return plan;
    const item = { ...plan };
    delete item.sortOrder;
    delete item.amount;
    delete item.priceLabel;
    delete item.razorpayPlans;
    delete item.razorpayPlanId;
    delete item.razorpayPlanAmountPaise;
    delete item.razorpayPlanPeriod;
    delete item.razorpayPlanInterval;
    return {
        ...item,
        order: plan.sortOrder,
    };
};

export const listSubscriptionPlansAdminController = async (_req, res, next) => {
    try {
        const plans = await listSubscriptionPlans();
        return sendResponse(res, 200, 'Subscription plans fetched successfully', { plans: plans.map(toItem) });
    } catch (error) {
        next(error);
    }
};

export const listSubscriptionPlansPublicController = async (_req, res, next) => {
    try {
        const plans = await listSubscriptionPlans({ publicOnly: true });
        return sendResponse(res, 200, 'Subscription plans fetched successfully', { plans: plans.map(toItem) });
    } catch (error) {
        next(error);
    }
};

export const createSubscriptionPlanController = async (req, res, next) => {
    try {
        const created = await createSubscriptionPlan(req.body || {});
        return sendResponse(res, 201, 'Subscription plan created successfully', { plan: toItem(created) });
    } catch (error) {
        next(error);
    }
};

export const updateSubscriptionPlanController = async (req, res, next) => {
    try {
        if (!req.params.id) throw new ValidationError('Subscription plan id is required');
        const updated = await updateSubscriptionPlan(req.params.id, req.body || {});
        if (!updated) return sendResponse(res, 404, 'Subscription plan not found', null);
        return sendResponse(res, 200, 'Subscription plan updated successfully', { plan: toItem(updated) });
    } catch (error) {
        next(error);
    }
};

export const deleteSubscriptionPlanController = async (req, res, next) => {
    try {
        if (!req.params.id) throw new ValidationError('Subscription plan id is required');
        const result = await deleteSubscriptionPlan(req.params.id);
        return sendResponse(res, 200, result.deleted ? 'Subscription plan deleted' : 'Subscription plan not found', result);
    } catch (error) {
        next(error);
    }
};

export const toggleSubscriptionPlanStatusController = async (req, res, next) => {
    try {
        if (!req.params.id) throw new ValidationError('Subscription plan id is required');
        const updated = await toggleSubscriptionPlanStatus(req.params.id);
        if (!updated) return sendResponse(res, 404, 'Subscription plan not found', null);
        return sendResponse(res, 200, 'Subscription plan status updated', { plan: toItem(updated) });
    } catch (error) {
        next(error);
    }
};

export const updateSubscriptionPlanOrderController = async (req, res, next) => {
    try {
        if (!req.params.id) throw new ValidationError('Subscription plan id is required');
        if (req.body?.order === undefined) throw new ValidationError('order is required');
        const updated = await updateSubscriptionPlanOrder(req.params.id, req.body.order);
        if (!updated) return sendResponse(res, 404, 'Subscription plan not found', null);
        return sendResponse(res, 200, 'Subscription plan order updated', { plan: toItem(updated) });
    } catch (error) {
        next(error);
    }
};
