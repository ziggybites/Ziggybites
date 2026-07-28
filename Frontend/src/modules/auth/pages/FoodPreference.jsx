import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { ArrowRight, Info, Leaf, UtensilsCrossed } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { getCachedSettings, loadBusinessSettings } from "@food/utils/businessSettings"

const FOOD_PREFERENCE_KEY = "userHomeFoodPreference"

const OPTIONS = [
  {
    id: "healthy",
    title: "Healthy Food",
    description:
      "Choose meals that are light, nutritious and made with wholesome ingredients.",
    note: "Best for a balanced and healthy lifestyle",
    icon: Leaf,
    accent: "green",
  },
  {
    id: "all",
    title: "All Food Items",
    description:
      "Explore the full range of home-style meals from all partner kitchens.",
    note: "Best for variety and complete choice",
    icon: UtensilsCrossed,
    accent: "orange",
  },
]

export default function FoodPreference() {
  const navigate = useNavigate()
  const [selected, setSelected] = useState(() => {
    const saved = localStorage.getItem(FOOD_PREFERENCE_KEY)
    return saved === "healthy" || saved === "all" ? saved : "healthy"
  })
  const [brand, setBrand] = useState(() => {
    const cached = getCachedSettings()
    return {
      logoUrl: cached?.logo?.url || null,
      companyName: cached?.companyName || "ZiggyBites",
    }
  })

  useEffect(() => {
    let cancelled = false

    const applySettings = (settings) => {
      if (!settings || cancelled) return
      setBrand({
        logoUrl: settings.logo?.url || null,
        companyName: settings.companyName || "ZiggyBites",
      })
    }

    applySettings(getCachedSettings())

    loadBusinessSettings()
      .then(applySettings)
      .catch(() => {})

    const handleSettingsUpdate = () => {
      applySettings(getCachedSettings())
    }

    window.addEventListener("businessSettingsUpdated", handleSettingsUpdate)
    return () => {
      cancelled = true
      window.removeEventListener("businessSettingsUpdated", handleSettingsUpdate)
    }
  }, [])

  const savePreference = (preference = selected) => {
    localStorage.setItem(FOOD_PREFERENCE_KEY, preference)
    localStorage.setItem("userVegMode", String(preference === "healthy"))
    window.dispatchEvent(new CustomEvent("userFoodPreferenceChanged", { detail: { preference } }))
    navigate("/food/user", { replace: true })
  }

  return (
    <div className="min-h-screen bg-[#fffaf6] dark:bg-[#0a0a0a] flex items-center justify-center px-4 py-6 font-['Poppins']">
      <main className="w-full max-w-md">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="bg-white dark:bg-[#111111] border border-orange-100 dark:border-white/10 rounded-[2rem] shadow-xl shadow-orange-100/60 dark:shadow-none px-5 py-6"
        >
          {brand.logoUrl ? (
            <img
              src={brand.logoUrl}
              alt={brand.companyName || "Company"}
              className="h-10 w-10 object-contain mb-6"
              onError={() => setBrand((prev) => ({ ...prev, logoUrl: null }))}
            />
          ) : (
            <div className="h-10 w-10 rounded-full bg-[#7e3866]/10 text-[#7e3866] flex items-center justify-center font-black mb-6">
              {(brand.companyName || "Z").trim().charAt(0).toUpperCase()}
            </div>
          )}

          <h1 className="text-3xl font-black leading-tight text-gray-950 dark:text-white tracking-tight">
            Help us serve you better
          </h1>
          <p className="mt-2 text-sm font-medium leading-relaxed text-gray-500 dark:text-gray-400">
            Choose what you'd like to see first. We'll personalize your meal experience accordingly.
          </p>

          <div className="mt-6 space-y-4">
            {OPTIONS.map((option) => {
              const Icon = option.icon
              const isSelected = selected === option.id
              const isHealthy = option.accent === "green"
              const selectedClasses = isHealthy
                ? "border-green-500 bg-green-50/70 dark:bg-green-950/20"
                : "border-orange-500 bg-orange-50/70 dark:bg-orange-950/20"
              const iconClasses = isHealthy
                ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
                : "bg-orange-100 text-orange-600 dark:bg-orange-950 dark:text-orange-300"

              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    setSelected(option.id)
                    savePreference(option.id)
                  }}
                  className={`w-full text-left rounded-2xl border p-4 transition-all active:scale-[0.99] ${
                    isSelected
                      ? selectedClasses
                      : "border-gray-200 bg-white hover:border-orange-200 dark:border-white/10 dark:bg-[#181818]"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <span className={`h-14 w-14 rounded-full flex items-center justify-center shrink-0 ${iconClasses}`}>
                      <Icon className="h-7 w-7" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-3">
                        <span className="text-lg font-black text-gray-950 dark:text-white">
                          {option.title}
                        </span>
                        <span
                          className={`h-6 w-6 rounded-full border-2 flex items-center justify-center shrink-0 ${
                            isSelected
                              ? isHealthy
                                ? "border-green-600"
                                : "border-orange-500"
                              : "border-gray-300 dark:border-gray-600"
                          }`}
                        >
                          {isSelected && (
                            <span
                              className={`h-3 w-3 rounded-full ${
                                isHealthy ? "bg-green-600" : "bg-orange-500"
                              }`}
                            />
                          )}
                        </span>
                      </span>
                      <span className="mt-2 block text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                        {option.description}
                      </span>
                      <span
                        className={`mt-4 block text-[11px] font-black uppercase tracking-[0.22em] ${
                          isHealthy ? "text-green-700" : "text-orange-500"
                        }`}
                      >
                        {option.note}
                      </span>
                    </span>
                  </div>
                </button>
              )
            })}
          </div>

          <div className="mt-7 border-t border-gray-100 dark:border-white/10 pt-4 flex items-start gap-3">
            <span className="h-8 w-8 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
              <Info className="h-4 w-4" />
            </span>
            <p className="text-xs font-medium leading-relaxed text-gray-500 dark:text-gray-400">
              You can change this anytime from the Home page filters.
            </p>
          </div>

          <button
            type="button"
            onClick={() => savePreference()}
            className="mt-5 h-12 w-full rounded-2xl bg-gradient-to-r from-[#ff4b1f] to-[#ff7a00] text-white font-black flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20 active:scale-[0.98]"
          >
            Save and continue
            <ArrowRight className="h-5 w-5" />
          </button>
        </motion.div>
      </main>
    </div>
  )
}
