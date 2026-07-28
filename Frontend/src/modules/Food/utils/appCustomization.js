import { publicGetOnce } from "@food/api"

export const DEFAULT_APP_CUSTOMIZATION = {
  normalOrderFlowEnabled: true,
  subscriptionFlowEnabled: true,
  diningFlowEnabled: true,
  directPaymentTestMode: false,
  theme: {
    primaryColor: "#e92823",
  },
  subscriptionOrders: {
    startFrom: "tomorrow",
    devModePlaceNow: false,
  },
  scheduledOrders: {
    enabled: true,
    allowToday: true,
    allowTomorrow: true,
    minLeadTimeMinutes: 60,
  },
}

export function normalizeThemeColor(value, fallback = DEFAULT_APP_CUSTOMIZATION.theme.primaryColor) {
  const color = String(value || "").trim()
  return /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : fallback
}

export function applyAppTheme(settings = {}) {
  if (typeof document === "undefined") return

  const primaryColor = normalizeThemeColor(settings.theme?.primaryColor || settings.primaryColor)
  const root = document.documentElement
  root.style.setProperty("--app-theme-primary", primaryColor)
  root.style.setProperty("--primary", primaryColor)
  root.style.setProperty("--ring", primaryColor)
  root.style.setProperty("--sidebar-primary", primaryColor)
  root.style.setProperty("--sidebar-ring", primaryColor)
  root.style.setProperty("--color-primary-orange", primaryColor)
}

export async function loadAppCustomization() {
  const response = await publicGetOnce("/food/app-customization/public")
  const settings = response?.data?.data?.settings || response?.data?.data || response?.data || {}
  const normalized = {
    ...DEFAULT_APP_CUSTOMIZATION,
    ...settings,
    theme: {
      ...DEFAULT_APP_CUSTOMIZATION.theme,
      ...(settings.theme || {}),
      primaryColor: normalizeThemeColor(settings.theme?.primaryColor || settings.primaryColor),
    },
    subscriptionOrders: {
      ...DEFAULT_APP_CUSTOMIZATION.subscriptionOrders,
      ...(settings.subscriptionOrders || {}),
    },
    scheduledOrders: {
      ...DEFAULT_APP_CUSTOMIZATION.scheduledOrders,
      ...(settings.scheduledOrders || {}),
    },
  }
  applyAppTheme(normalized)
  return normalized
}


