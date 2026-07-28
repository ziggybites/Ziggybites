import { sendResponse } from '../../../utils/response.js';
import { ValidationError } from '../../../core/auth/errors.js';
import {
  getAppCustomizationSettings,
  updateAppCustomizationSettings,
} from './appCustomization.service.js';
import { sendTestSubscriptionReminder } from '../subscription/services/subscription.service.js';

function validateAppCustomizationPayload(body = {}) {
  const payload = {};

  if (body.normalOrderFlowEnabled !== undefined) {
    payload.normalOrderFlowEnabled = Boolean(body.normalOrderFlowEnabled);
  }

  if (body.subscriptionFlowEnabled !== undefined) {
    payload.subscriptionFlowEnabled = Boolean(body.subscriptionFlowEnabled);
  }

  if (body.diningFlowEnabled !== undefined) {
    payload.diningFlowEnabled = Boolean(body.diningFlowEnabled);
  }

  if (body.loggingEnabled !== undefined) {
    payload.loggingEnabled = Boolean(body.loggingEnabled);
  }

  if (body.directPaymentTestMode !== undefined) {
    payload.directPaymentTestMode = Boolean(body.directPaymentTestMode);
  }

  if (body.theme !== undefined) {
    const primaryColor = String(body.theme?.primaryColor || '').trim();
    if (primaryColor && !/^#[0-9a-f]{6}$/i.test(primaryColor)) {
      throw new ValidationError('Theme color must be a valid hex color');
    }
    payload.theme = {};
    if (primaryColor) payload.theme.primaryColor = primaryColor.toLowerCase();
  }

  if (body.subscriptionOrders !== undefined) {
    const startFrom = String(body.subscriptionOrders?.startFrom || '').toLowerCase();
    if (startFrom && !['today', 'tomorrow'].includes(startFrom)) {
      throw new ValidationError('Subscription start must be today or tomorrow');
    }
    payload.subscriptionOrders = {};
    if (startFrom) payload.subscriptionOrders.startFrom = startFrom;
    if (body.subscriptionOrders?.devModePlaceNow !== undefined) {
      payload.subscriptionOrders.devModePlaceNow = Boolean(body.subscriptionOrders.devModePlaceNow);
    }
  }

  if (body.scheduledOrders !== undefined) {
    payload.scheduledOrders = {};
    if (body.scheduledOrders?.enabled !== undefined) {
      payload.scheduledOrders.enabled = Boolean(body.scheduledOrders.enabled);
    }
    if (body.scheduledOrders?.allowToday !== undefined) {
      payload.scheduledOrders.allowToday = Boolean(body.scheduledOrders.allowToday);
    }
    if (body.scheduledOrders?.allowTomorrow !== undefined) {
      payload.scheduledOrders.allowTomorrow = Boolean(body.scheduledOrders.allowTomorrow);
    }
    if (body.scheduledOrders?.minLeadTimeMinutes !== undefined) {
      payload.scheduledOrders.minLeadTimeMinutes = Number(body.scheduledOrders.minLeadTimeMinutes);
    }

    if (
      payload.scheduledOrders.minLeadTimeMinutes !== undefined &&
      (!Number.isInteger(payload.scheduledOrders.minLeadTimeMinutes) ||
        payload.scheduledOrders.minLeadTimeMinutes < 0 ||
        payload.scheduledOrders.minLeadTimeMinutes > 1440)
    ) {
      throw new ValidationError('Minimum lead time must be between 0 and 1440 minutes');
    }
  }

  if (body.timeManagement !== undefined) {
    payload.timeManagement = {};
    if (body.timeManagement?.dishChangeLeadHours !== undefined) {
      payload.timeManagement.dishChangeLeadHours = Number(body.timeManagement.dishChangeLeadHours);
    }
    if (body.timeManagement?.addressChangeLeadHours !== undefined) {
      payload.timeManagement.addressChangeLeadHours = Number(body.timeManagement.addressChangeLeadHours);
    }
    if (body.timeManagement?.devModeAllowAnytimeChanges !== undefined) {
      payload.timeManagement.devModeAllowAnytimeChanges = Boolean(body.timeManagement.devModeAllowAnytimeChanges);
    }

    for (const [field, value] of Object.entries(payload.timeManagement)) {
      if (typeof value === 'boolean') continue;
      if (!Number.isInteger(value) || value < 1 || value > 168) {
        throw new ValidationError(`${field} must be between 1 and 168 hours`);
      }
    }
  }

  return payload;
}

export async function getAppCustomizationController(_req, res, next) {
  try {
    const settings = await getAppCustomizationSettings();
    return sendResponse(res, 200, 'App customization settings retrieved', { settings });
  } catch (err) {
    next(err);
  }
}

export async function updateAppCustomizationController(req, res, next) {
  try {
    const adminId = req.user?.userId;
    const payload = validateAppCustomizationPayload(req.body || {});
    const settings = await updateAppCustomizationSettings(payload, adminId);
    return sendResponse(res, 200, 'App customization settings updated', { settings });
  } catch (err) {
    next(err);
  }
}

export async function sendAppCustomizationTestNotificationController(req, res, next) {
  try {
    const result = await sendTestSubscriptionReminder(req.body?.type);
    return sendResponse(res, 200, 'Test notification sent', result);
  } catch (err) {
    next(err);
  }
}
