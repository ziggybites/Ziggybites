import { useEffect, useState } from "react"
import { Bell, Loader2, MapPin, Save, Send, TestTube2, Timer, Utensils } from "lucide-react"
import { Button } from "@food/components/ui/button"
import { adminAPI } from "@food/api"
import { toast } from "sonner"

const DEFAULT_SETTINGS = {
  normalOrderFlowEnabled: true,
  subscriptionFlowEnabled: true,
  diningFlowEnabled: true,
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
    devModeAllowAnytimeChanges: false,
  },
}

function NumberField({ icon: Icon, title, description, value, onChange }) {
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <div className="mb-4 flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
      </div>
      <div className="flex max-w-xs items-center gap-3">
        <input
          type="number"
          min="1"
          max="168"
          step="1"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-11 w-28 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-900 outline-none focus:border-[#7e3866] focus:ring-2 focus:ring-[#7e3866]/15"
        />
        <span className="text-sm font-medium text-slate-600">hours before order time</span>
      </div>
    </div>
  )
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

export default function TimeManagement() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState("")

  useEffect(() => {
    let mounted = true
    const loadSettings = async () => {
      try {
        setLoading(true)
        const response = await adminAPI.getAppCustomization()
        const data = response?.data?.data?.settings
        if (mounted && data) {
          setSettings({
            ...DEFAULT_SETTINGS,
            ...data,
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
          })
        }
      } catch (error) {
        toast.error(error?.response?.data?.message || "Failed to load time management")
      } finally {
        if (mounted) setLoading(false)
      }
    }
    loadSettings()
    return () => {
      mounted = false
    }
  }, [])

  const updateTime = (field, value) => {
    const next = Math.max(1, Math.min(168, Number(value) || 1))
    setSettings((prev) => ({
      ...prev,
      timeManagement: {
        ...prev.timeManagement,
        [field]: next,
      },
    }))
  }

  const updateDevMode = (value) => {
    setSettings((prev) => ({
      ...prev,
      timeManagement: {
        ...prev.timeManagement,
        devModeAllowAnytimeChanges: Boolean(value),
      },
    }))
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      const response = await adminAPI.updateAppCustomization({
        timeManagement: {
          dishChangeLeadHours: Number(settings.timeManagement.dishChangeLeadHours),
          addressChangeLeadHours: Number(settings.timeManagement.addressChangeLeadHours),
          devModeAllowAnytimeChanges: Boolean(settings.timeManagement.devModeAllowAnytimeChanges),
        },
      })
      const saved = response?.data?.data?.settings
      if (saved) {
        setSettings({
          ...DEFAULT_SETTINGS,
          ...saved,
          subscriptionOrders: {
            ...DEFAULT_SETTINGS.subscriptionOrders,
            ...(saved.subscriptionOrders || {}),
          },
          scheduledOrders: {
            ...DEFAULT_SETTINGS.scheduledOrders,
            ...(saved.scheduledOrders || {}),
          },
          timeManagement: {
            ...DEFAULT_SETTINGS.timeManagement,
            ...(saved.timeManagement || {}),
          },
        })
      }
      toast.success("Time management saved")
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to save time management")
    } finally {
      setSaving(false)
    }
  }

  const handleTestNotification = async (type) => {
    try {
      setTesting(type)
      console.log("[Admin Push Test] Sending timing test notification:", type)
      const response = await adminAPI.sendAppCustomizationTestNotification(type)
      console.log("[Admin Push Test] Backend response:", response?.data)
      const result = response?.data?.data || {}
      if (Number(result.successCount || 0) < 1) {
        const firstError = Array.isArray(result.results)
          ? result.results.flatMap((item) => item?.results || []).find((item) => item?.error)?.error
          : ""
        console.error("[Admin Push Test] Firebase rejected timing notification:", result)
        throw new Error(firstError || "No user device accepted the test notification")
      }
      toast.success(type === "address" ? "Address test notification sent" : "Food change test notification sent")
    } catch (error) {
      console.error("[Admin Push Test] Failed:", error)
      toast.error(error?.response?.data?.message || error?.message || "Failed to send test notification")
    } finally {
      setTesting("")
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 lg:p-6">
      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#7e3866] text-white">
              <Timer className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Time Management</h1>
              <p className="mt-1 text-sm text-slate-600">
                Manage subscription dish-change and address-change notification windows.
              </p>
            </div>
          </div>
          <Button onClick={handleSave} disabled={loading || saving} className="bg-[#7e3866] text-white hover:bg-[#55254b]">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Time
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-[#7e3866]" />
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <NumberField
              icon={Utensils}
              title="Dish change window"
              description="Users can change the dish only before this many hours from the next subscription meal."
              value={settings.timeManagement.dishChangeLeadHours}
              onChange={(value) => updateTime("dishChangeLeadHours", value)}
            />
            <NumberField
              icon={Bell}
              title="Address change reminder"
              description="Users receive the address-change reminder this many hours before the order time."
              value={settings.timeManagement.addressChangeLeadHours}
              onChange={(value) => updateTime("addressChangeLeadHours", value)}
            />
            <div className="rounded-lg border border-slate-200 p-4">
              <div className="mb-4 flex items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                  <TestTube2 className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Dev mode</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Let users change subscription food and address any time while testing.
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between gap-4 rounded-lg bg-slate-50 p-4">
                <span>
                  <span className="block text-sm font-semibold text-slate-900">Allow anytime changes</span>
                  <span className="mt-1 block text-sm text-slate-500">
                    Save after turning this on so user-side checks use it.
                  </span>
                </span>
                <ToggleSwitch
                  checked={settings.timeManagement.devModeAllowAnytimeChanges}
                  onChange={updateDevMode}
                  ariaLabel="Allow anytime changes"
                />
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 p-4">
              <div className="mb-4 flex items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                  <Send className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Test notifications</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Send a test reminder to the next scheduled subscription user.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  variant="outline"
                  disabled={Boolean(testing)}
                  onClick={() => handleTestNotification("dish")}
                  className="border-[#7e3866] text-[#7e3866] hover:bg-[#7e3866]/10"
                >
                  {testing === "dish" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Utensils className="mr-2 h-4 w-4" />}
                  Test food item
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={Boolean(testing)}
                  onClick={() => handleTestNotification("address")}
                  className="border-[#7e3866] text-[#7e3866] hover:bg-[#7e3866]/10"
                >
                  {testing === "address" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MapPin className="mr-2 h-4 w-4" />}
                  Test address
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
