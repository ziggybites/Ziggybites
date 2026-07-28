import { useEffect, useState } from "react"
import { CalendarClock, CheckCircle2, FileText, Loader2, Palette, Save, Settings2, ShoppingCart, Utensils, UtensilsCrossed } from "lucide-react"
import { Button } from "@food/components/ui/button"
import { adminAPI } from "@food/api"
import { toast } from "sonner"
import { applyAppTheme, normalizeThemeColor } from "@food/utils/appCustomization"

const DEFAULT_SETTINGS = {
  normalOrderFlowEnabled: true,
  subscriptionFlowEnabled: true,
  diningFlowEnabled: true,
  loggingEnabled: true,
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
  timeManagement: {
    dishChangeLeadHours: 24,
    addressChangeLeadHours: 3,
  },
}

function mergeSettings(data) {
  return {
    ...DEFAULT_SETTINGS,
    ...data,
    theme: {
      ...DEFAULT_SETTINGS.theme,
      ...(data.theme || {}),
      primaryColor: normalizeThemeColor(data.theme?.primaryColor || data.primaryColor),
    },
    subscriptionOrders: {
      ...DEFAULT_SETTINGS.subscriptionOrders,
      ...(data.subscriptionOrders || {}),
    },
    scheduledOrders: {
      ...DEFAULT_SETTINGS.scheduledOrders,
      ...(data.scheduledOrders || {}),
    },
    timeManagement: {
      ...DEFAULT_SETTINGS.timeManagement,
      ...(data.timeManagement || {}),
    },
  }
}

function ToggleSwitch({ checked, onChange, ariaLabel }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
        checked ? "bg-[#7e3866]" : "bg-slate-300"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  )
}

function ToggleRow({ icon: Icon, title, description, checked, onChange }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 p-4">
      <span className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
          <Icon className="h-4 w-4" />
        </span>
        <span>
          <span className="block text-sm font-semibold text-slate-900">{title}</span>
          <span className="mt-1 block text-sm text-slate-500">{description}</span>
        </span>
      </span>
      <ToggleSwitch checked={checked} onChange={onChange} ariaLabel={title} />
    </div>
  )
}

export default function AppCustomization() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activePanel, setActivePanel] = useState("flows")
  const themeColorValid = /^#[0-9a-f]{6}$/i.test(settings.theme.primaryColor)

  useEffect(() => {
    let mounted = true
    const loadSettings = async () => {
      try {
        setLoading(true)
        const response = await adminAPI.getAppCustomization()
        const data = response?.data?.data?.settings
        if (mounted && data) {
          const merged = mergeSettings(data)
          setSettings(merged)
          applyAppTheme(merged)
        }
      } catch (error) {
        toast.error(error?.response?.data?.message || "Failed to load app customization")
      } finally {
        if (mounted) setLoading(false)
      }
    }

    loadSettings()
    return () => {
      mounted = false
    }
  }, [])

  const updateRoot = (field, value) => {
    setSettings((prev) => ({ ...prev, [field]: value }))
  }

  const updateSubscriptionOrders = (field, value) => {
    setSettings((prev) => ({
      ...prev,
      subscriptionOrders: { ...prev.subscriptionOrders, [field]: value },
    }))
  }

  const updateThemeColor = (value) => {
    setSettings((prev) => {
      const next = {
        ...prev,
        theme: {
          ...prev.theme,
          primaryColor: value,
        },
      }
      if (/^#[0-9a-f]{6}$/i.test(value)) applyAppTheme(next)
      return next
    })
  }

  const handleSave = async () => {
    if (!/^#[0-9a-f]{6}$/i.test(settings.theme.primaryColor)) {
      toast.error("Enter a valid 6-digit theme color")
      return
    }

    try {
      setSaving(true)
      const response = await adminAPI.updateAppCustomization({
        normalOrderFlowEnabled: Boolean(settings.normalOrderFlowEnabled),
        subscriptionFlowEnabled: Boolean(settings.subscriptionFlowEnabled),
        diningFlowEnabled: Boolean(settings.diningFlowEnabled),
        loggingEnabled: Boolean(settings.loggingEnabled),
        directPaymentTestMode: Boolean(settings.directPaymentTestMode),
        theme: {
          primaryColor: normalizeThemeColor(settings.theme.primaryColor),
        },
        subscriptionOrders: {
          startFrom: settings.subscriptionOrders.startFrom,
          devModePlaceNow: Boolean(settings.subscriptionOrders.devModePlaceNow),
        },
      })
      const saved = response?.data?.data?.settings
      if (saved) {
        const merged = mergeSettings(saved)
        setSettings(merged)
        applyAppTheme(merged)
      }
      toast.success("App customization saved")
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to save app customization")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 lg:p-6">
      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#7e3866] text-white">
              <Settings2 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">App Customization</h1>
              <p className="mt-1 text-sm text-slate-600">
                Control user-to-restaurant order flows without affecting unrelated modules.
              </p>
            </div>
          </div>
          <Button onClick={handleSave} disabled={loading || saving || !themeColorValid} className="bg-[#7e3866] text-white hover:bg-[#55254b]">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Settings
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-[#7e3866]" />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-wrap gap-2 rounded-lg bg-slate-100 p-1">
              {[
                { id: "flows", label: "Flows", icon: Settings2 },
                { id: "theme", label: "Theme", icon: Palette },
              ].map((panel) => {
                const Icon = panel.icon
                const isActive = activePanel === panel.id
                return (
                  <button
                    key={panel.id}
                    type="button"
                    onClick={() => setActivePanel(panel.id)}
                    className={`inline-flex h-10 items-center gap-2 rounded-md px-4 text-sm font-bold transition-colors ${
                      isActive ? "bg-white text-[#7e3866] shadow-sm" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {panel.label}
                  </button>
                )
              })}
            </div>

            {activePanel === "flows" ? (
              <>
                <ToggleRow
                  icon={ShoppingCart}
                  title="Normal order flow"
                  description="When off, cart access is hidden and users cannot place regular restaurant orders."
                  checked={settings.normalOrderFlowEnabled}
                  onChange={(value) => updateRoot("normalOrderFlowEnabled", value)}
                />

                <ToggleRow
                  icon={Utensils}
                  title="Subscription flow"
                  description="When off, users cannot open meal time, subscription plan, or subscription checkout flows."
                  checked={settings.subscriptionFlowEnabled}
                  onChange={(value) => updateRoot("subscriptionFlowEnabled", value)}
                />

                <ToggleRow
                  icon={UtensilsCrossed}
                  title="Dining flow"
                  description="When off, dining pages, dining navigation, and user dining booking APIs are disabled."
                  checked={settings.diningFlowEnabled}
                  onChange={(value) => updateRoot("diningFlowEnabled", value)}
                />

                <ToggleRow
                  icon={FileText}
                  title="Application logging"
                  description="Turn backend Winston logging on or off for runtime request and service logs."
                  checked={settings.loggingEnabled}
                  onChange={(value) => updateRoot("loggingEnabled", value)}
                />

                <ToggleRow
                  icon={CheckCircle2}
                  title="Test mode: direct payment"
                  description="For testing only. When on, online checkout verifies directly and skips opening Razorpay."
                  checked={settings.directPaymentTestMode}
                  onChange={(value) => updateRoot("directPaymentTestMode", value)}
                />

                <div className="rounded-lg border border-slate-200 p-4">
                  <div className="mb-4 flex items-start gap-3">
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                      <CalendarClock className="h-4 w-4" />
                    </span>
                    <div>
                      <h2 className="text-sm font-semibold text-slate-900">Subscription order start</h2>
                      <p className="mt-1 text-sm text-slate-500">
                        Choose whether newly paid subscriptions start from today or tomorrow.
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {["today", "tomorrow"].map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => updateSubscriptionOrders("startFrom", value)}
                        className={`rounded-lg border px-4 py-3 text-left text-sm font-semibold capitalize transition-colors ${
                          settings.subscriptionOrders.startFrom === value
                            ? "border-[#7e3866] bg-[#7e3866]/10 text-[#7e3866]"
                            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                        }`}
                      >
                        {value}
                      </button>
                    ))}
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-4 rounded-lg bg-slate-50 p-4">
                    <span>
                      <span className="block text-sm font-semibold text-slate-900">Dev mode: place subscription meals now</span>
                      <span className="mt-1 block text-sm text-slate-500">
                        Only applies outside production; first subscription schedule starts immediately for testing.
                      </span>
                    </span>
                    <ToggleSwitch
                      checked={settings.subscriptionOrders.devModePlaceNow}
                      onChange={(value) => updateSubscriptionOrders("devModePlaceNow", value)}
                      ariaLabel="Dev mode: place subscription meals now"
                    />
                  </div>

                  <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    Logging toggle affects the backend logger only. Click Save Settings after changing it.
                  </p>
                </div>
              </>
            ) : (
              <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
                <div className="rounded-lg border border-slate-200 p-4">
                  <div className="mb-5 flex items-start gap-3">
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                      <Palette className="h-4 w-4" />
                    </span>
                    <div>
                      <h2 className="text-sm font-semibold text-slate-900">Theme color</h2>
                      <p className="mt-1 text-sm text-slate-500">
                        This color is applied to primary buttons, active states, rings, and theme accents across the application.
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-[96px_1fr] sm:items-end">
                    <label className="block">
                      <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">Pick color</span>
                      <input
                        type="color"
                        value={normalizeThemeColor(settings.theme.primaryColor)}
                        onChange={(event) => updateThemeColor(event.target.value)}
                        className="h-12 w-24 cursor-pointer rounded-lg border border-slate-200 bg-white p-1"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">Hex value</span>
                      <input
                        type="text"
                        value={settings.theme.primaryColor}
                        onChange={(event) => updateThemeColor(event.target.value)}
                        placeholder="#e92823"
                        className="h-12 w-full rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-900 outline-none transition-colors focus:border-[#7e3866] focus:ring-4 focus:ring-[#7e3866]/10"
                      />
                    </label>
                  </div>

                  {!themeColorValid && (
                    <p className="mt-3 text-sm font-medium text-red-600">Enter a valid 6-digit hex color, for example #e92823.</p>
                  )}
                </div>

                <div className="rounded-lg border border-slate-200 p-4">
                  <p className="mb-4 text-xs font-bold uppercase tracking-wide text-slate-500">Preview</p>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <span
                        className="h-12 w-12 rounded-lg shadow-sm"
                        style={{ backgroundColor: normalizeThemeColor(settings.theme.primaryColor) }}
                      />
                      <div>
                        <p className="text-sm font-bold text-slate-900">{normalizeThemeColor(settings.theme.primaryColor)}</p>
                        <p className="text-xs text-slate-500">Primary app theme</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="h-11 w-full rounded-lg text-sm font-bold text-white shadow-sm"
                      style={{ backgroundColor: normalizeThemeColor(settings.theme.primaryColor) }}
                    >
                      Primary Button
                    </button>
                    <div
                      className="rounded-lg border p-3 text-sm font-semibold"
                      style={{
                        borderColor: normalizeThemeColor(settings.theme.primaryColor),
                        color: normalizeThemeColor(settings.theme.primaryColor),
                        backgroundColor: `${normalizeThemeColor(settings.theme.primaryColor)}14`,
                      }}
                    >
                      Active selection state
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
