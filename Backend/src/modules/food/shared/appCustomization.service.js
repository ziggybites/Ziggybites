import { ValidationError } from '../../../core/auth/errors.js';
import { FoodSettings } from '../orders/models/order.model.js';
import { setLoggerEnabled } from '../../../utils/logger.js';

export const DEFAULT_APP_CUSTOMIZATION_SETTINGS = {
  normalOrderFlowEnabled: true,
  subscriptionFlowEnabled: true,
  diningFlowEnabled: true,
  loggingEnabled: true,
  directPaymentTestMode: false,
  theme: {
    primaryColor: '#e92823',
  },
  subscriptionOrders: {
    startFrom: 'tomorrow',
    devModePlaceNow: false,
  },
  scheduledOrders: {
    enabled: true,
    allowToday: true,
    allowTomorrow: true,
    minLeadTimeMinutes: 60,
  },
  timeManagement: {
    dishChangeLeadHours: 24,
    addressChangeLeadHours: 3,
    devModeAllowAnytimeChanges: false,
  },
};

function normalizeScheduledOrderSettings(settings = {}) {
  return {
    enabled: settings.enabled !== false,
    allowToday: settings.allowToday !== false,
    allowTomorrow: settings.allowTomorrow !== false,
    minLeadTimeMinutes: Math.max(
      0,
      Number.isFinite(Number(settings.minLeadTimeMinutes))
        ? Number(settings.minLeadTimeMinutes)
        : DEFAULT_APP_CUSTOMIZATION_SETTINGS.scheduledOrders.minLeadTimeMinutes,
    ),
  };
}

function normalizeAppCustomizationSettings(settings = {}) {
  const startFrom = String(settings.subscriptionOrders?.startFrom || settings.subscriptionStartFrom || 'tomorrow').toLowerCase();
  const dishChangeLeadHours = Number(settings.timeManagement?.dishChangeLeadHours);
  const addressChangeLeadHours = Number(settings.timeManagement?.addressChangeLeadHours);
  const primaryColor = String(settings.theme?.primaryColor || settings.primaryColor || DEFAULT_APP_CUSTOMIZATION_SETTINGS.theme.primaryColor).trim();
  const normalizedPrimaryColor = /^#[0-9a-f]{6}$/i.test(primaryColor)
    ? primaryColor.toLowerCase()
    : DEFAULT_APP_CUSTOMIZATION_SETTINGS.theme.primaryColor;
  return {
    normalOrderFlowEnabled: settings.normalOrderFlowEnabled !== false,
    subscriptionFlowEnabled: settings.subscriptionFlowEnabled !== false,
    diningFlowEnabled: settings.diningFlowEnabled !== false,
    loggingEnabled: settings.loggingEnabled !== false,
    directPaymentTestMode: settings.directPaymentTestMode === true,
    theme: {
      primaryColor: normalizedPrimaryColor,
    },
    subscriptionOrders: {
      startFrom: startFrom === 'today' ? 'today' : 'tomorrow',
      devModePlaceNow: Boolean(settings.subscriptionOrders?.devModePlaceNow),
    },
    scheduledOrders: normalizeScheduledOrderSettings(settings.scheduledOrders),
    timeManagement: {
      dishChangeLeadHours:
        Number.isFinite(dishChangeLeadHours) && dishChangeLeadHours >= 1
          ? Math.min(168, Math.round(dishChangeLeadHours))
          : DEFAULT_APP_CUSTOMIZATION_SETTINGS.timeManagement.dishChangeLeadHours,
      addressChangeLeadHours:
        Number.isFinite(addressChangeLeadHours) && addressChangeLeadHours >= 1
          ? Math.min(168, Math.round(addressChangeLeadHours))
          : DEFAULT_APP_CUSTOMIZATION_SETTINGS.timeManagement.addressChangeLeadHours,
      devModeAllowAnytimeChanges: Boolean(settings.timeManagement?.devModeAllowAnytimeChanges),
    },
  };
}

function localDateKey(date) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function getAppCustomizationSettings() {
  const doc = await FoodSettings.findOne({ key: "app-customization" }).lean();
  const settings = normalizeAppCustomizationSettings(doc || DEFAULT_APP_CUSTOMIZATION_SETTINGS);
  setLoggerEnabled(settings.loggingEnabled);
  return settings;
}

export async function updateAppCustomizationSettings(payload = {}, adminId) {
  const current = await getAppCustomizationSettings();
  const next = normalizeAppCustomizationSettings({
    ...current,
    ...payload,
    subscriptionOrders: {
      ...current.subscriptionOrders,
      ...(payload.subscriptionOrders || {}),
    },
    scheduledOrders: {
      ...current.scheduledOrders,
      ...(payload.scheduledOrders || {}),
    },
    theme: {
      ...current.theme,
      ...(payload.theme || {}),
    },
    timeManagement: {
      ...current.timeManagement,
      ...(payload.timeManagement || {}),
    },
  });

  if (
    next.scheduledOrders.enabled &&
    !next.scheduledOrders.allowToday &&
    !next.scheduledOrders.allowTomorrow
  ) {
    throw new ValidationError("Enable at least Today or Tomorrow for scheduled orders");
  }

  const doc = await FoodSettings.findOneAndUpdate(
    { key: "app-customization" },
    {
      $set: {
        normalOrderFlowEnabled: next.normalOrderFlowEnabled,
        subscriptionFlowEnabled: next.subscriptionFlowEnabled,
        diningFlowEnabled: next.diningFlowEnabled,
        loggingEnabled: next.loggingEnabled,
        directPaymentTestMode: next.directPaymentTestMode,
        subscriptionOrders: next.subscriptionOrders,
        scheduledOrders: next.scheduledOrders,
        theme: next.theme,
        timeManagement: next.timeManagement,
        updatedBy: { role: "ADMIN", adminId, at: new Date() },
      },
    },
    { upsert: true, new: true },
  ).lean();

  const settings = normalizeAppCustomizationSettings(doc || next);
  setLoggerEnabled(settings.loggingEnabled);
  return settings;
}

export function assertNormalOrderFlowAllowed(settings) {
  if (settings?.normalOrderFlowEnabled === false) {
    throw new ValidationError("Normal order flow is currently disabled");
  }
}

export function assertSubscriptionFlowAllowed(settings) {
  if (settings?.subscriptionFlowEnabled === false) {
    throw new ValidationError("Subscription flow is currently disabled");
  }
}

export function assertDiningFlowAllowed(settings) {
  if (settings?.diningFlowEnabled === false) {
    throw new ValidationError("Dining flow is currently disabled");
  }
}

export function assertScheduledAtAllowed(scheduledAt, settings) {
  if (!scheduledAt) return;

  const scheduledDate = new Date(scheduledAt);
  if (Number.isNaN(scheduledDate.getTime())) {
    throw new ValidationError("Scheduled time is invalid");
  }

  const scheduledSettings = normalizeScheduledOrderSettings(settings?.scheduledOrders || settings);

  if (!scheduledSettings.enabled) {
    throw new ValidationError("Scheduled orders are currently disabled");
  }

  const now = new Date();
  const minimumDate = new Date(
    now.getTime() + Math.max(0, Number(scheduledSettings.minLeadTimeMinutes || 0)) * 60000,
  );
  if (scheduledDate < minimumDate) {
    throw new ValidationError(
      `Scheduled time must be at least ${scheduledSettings.minLeadTimeMinutes} minutes from now`,
    );
  }

  const todayKey = localDateKey(now);
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const tomorrowKey = localDateKey(tomorrow);
  const scheduledKey = localDateKey(scheduledDate);

  if (scheduledKey === todayKey && scheduledSettings.allowToday) return;
  if (scheduledKey === tomorrowKey && scheduledSettings.allowTomorrow) return;

  throw new ValidationError("Scheduled orders are allowed only for the enabled dates");
}
