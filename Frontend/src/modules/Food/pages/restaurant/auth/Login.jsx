import { useEffect, useRef, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowRight, Loader2, Phone } from "lucide-react"
import { toast } from "sonner"
import { restaurantAPI } from "@food/api"
import { getCachedSettings, loadBusinessSettings, normalizeKitchenAppName } from "@food/utils/businessSettings"

const DEFAULT_COUNTRY_CODE = "+91"

export default function RestaurantLogin() {
  const navigate = useNavigate()
  const [phone, setPhone] = useState(() => sessionStorage.getItem("restaurantLoginPhone") || "")
  const [loading, setLoading] = useState(false)
  const [brand, setBrand] = useState(() => {
    const cached = getCachedSettings()
    return {
      logoUrl: cached?.restaurantLogo?.url || cached?.logo?.url || null,
      companyName: normalizeKitchenAppName(cached?.companyName) || "ZiggyBites",
    }
  })
  const submitting = useRef(false)

  useEffect(() => {
    let cancelled = false

    const applySettings = (settings) => {
      if (!settings || cancelled) return
      setBrand({
        logoUrl: settings.restaurantLogo?.url || settings.logo?.url || null,
        companyName: normalizeKitchenAppName(settings.companyName) || "ZiggyBites",
      })
    }

    applySettings(getCachedSettings())
    loadBusinessSettings().then(applySettings).catch(() => {})

    const handleSettingsUpdate = () => applySettings(getCachedSettings())
    window.addEventListener("businessSettingsUpdated", handleSettingsUpdate)
    return () => {
      cancelled = true
      window.removeEventListener("businessSettingsUpdated", handleSettingsUpdate)
    }
  }, [])

  const validatePhone = (num) => {
    const digits = num.replace(/\D/g, "")
    return digits.length === 10 && ["6", "7", "8", "9"].includes(digits[0])
  }

  const handleSendOTP = async (e) => {
    if (e) e.preventDefault()
    if (!validatePhone(phone)) {
      toast.error("Please enter a valid 10-digit mobile number")
      return
    }
    if (submitting.current) return
    submitting.current = true
    setLoading(true)

    const fullPhone = `${DEFAULT_COUNTRY_CODE} ${phone}`.trim()

    try {
      await restaurantAPI.sendOTP(fullPhone, "login")
      sessionStorage.setItem("restaurantAuthData", JSON.stringify({
        method: "phone",
        phone: fullPhone,
        isSignUp: false,
        module: "restaurant",
      }))
      sessionStorage.setItem("restaurantLoginPhone", phone)
      toast.success("Verification code sent!")
      navigate("/food/restaurant/otp")
    } catch (apiErr) {
      toast.error(apiErr?.response?.data?.message || apiErr?.message || "Failed to send OTP.")
    } finally {
      setLoading(false)
      submitting.current = false
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col relative overflow-hidden font-['Poppins'] text-[#202030]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-8 top-14 h-8 w-8 rounded-full border border-red-100 opacity-70" />
        <div className="absolute right-10 top-24 h-5 w-5 rotate-12 rounded border border-red-100 opacity-60" />
        <div className="absolute left-6 top-44 h-4 w-4 rotate-45 rounded-sm border border-red-100 opacity-60" />
        <div className="absolute bottom-0 left-0 right-0 h-28 bg-red-50" style={{ clipPath: "polygon(0 60%, 18% 78%, 38% 67%, 58% 84%, 78% 62%, 100% 48%, 100% 100%, 0 100%)" }} />
        <div className="absolute bottom-0 left-0 right-0 h-20 bg-[#ff1f1f]" style={{ clipPath: "polygon(0 82%, 22% 70%, 46% 84%, 70% 64%, 100% 42%, 100% 100%, 0 100%)" }} />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-sm flex-col px-7 pb-24 pt-10">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="w-full"
        >
          <div className="text-center">
            <div className="relative mx-auto mb-2 flex h-36 w-36 items-center justify-center rounded-full bg-[#fff7f2]">
              {brand.logoUrl ? (
                <img
                  src={brand.logoUrl}
                  alt={`${brand.companyName || "Company"} Restaurant Logo`}
                  className="h-32 w-32 object-contain"
                  onError={() => setBrand((prev) => ({ ...prev, logoUrl: null }))}
                />
              ) : (
                <div className="flex h-28 w-28 items-center justify-center rounded-full bg-red-50 text-5xl font-black text-[#ff1f1f]">
                  {(brand.companyName || "Z").trim().charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <h1 className="text-4xl font-black italic tracking-tight text-[#ff1f1f] drop-shadow-sm">
              {brand.companyName || "ZiggyBites"}
            </h1>
            <div className="mx-auto mt-2 h-1 w-16 rounded-full bg-[#ff1f1f]" />
          </div>

          <div className="mt-8">
            <motion.form
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              onSubmit={handleSendOTP}
              className="space-y-4"
            >
              <div className="relative rounded-xl bg-white shadow-[0_8px_28px_rgba(15,23,42,0.08)] ring-1 ring-gray-100">
                <div className="absolute inset-y-0 left-4 flex items-center">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-[#ff1f1f]">
                    <Phone className="h-4 w-4" />
                  </span>
                </div>
                <span className="absolute left-16 top-[33px] -translate-y-1/2 text-sm font-black leading-none text-[#202030]">
                  +91
                </span>
                <input
                  type="tel"
                  required
                  autoFocus
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  maxLength={10}
                  className="block h-14 w-full rounded-xl bg-transparent pl-[92px] pr-4 pt-4 text-sm font-black leading-none text-[#202030] outline-none placeholder:text-gray-300"
                  placeholder="98765 43210"
                />
                <div className="pointer-events-none absolute left-16 top-2 text-[9px] font-semibold text-gray-400">
                  Enter restaurant phone number
                </div>
              </div>

              <label className="flex items-center gap-2 text-[10px] font-semibold text-[#5f5f6f]">
                <input type="checkbox" defaultChecked className="h-3.5 w-3.5 rounded border-red-200 accent-[#ff2727]" />
                Remember me for faster sign-in
              </label>

              <button
                type="submit"
                disabled={loading || phone.length < 10}
                className="relative flex h-12 w-full items-center justify-center rounded-xl bg-gradient-to-r from-[#ef1f1f] to-[#ff641f] text-sm font-black text-white shadow-[0_12px_24px_rgba(255,49,31,0.25)] transition active:scale-[0.98] disabled:opacity-60"
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Continue"}
                {!loading && <ArrowRight className="absolute right-5 h-4 w-4" />}
              </button>
            </motion.form>
          </div>

          <p className="mx-auto mt-5 max-w-[260px] text-center text-[9px] font-semibold leading-4 text-gray-400">
            By continuing, you agree to our<br />
            <Link to="/food/restaurant/profile/terms" className="font-black text-[#ff2727] underline">Terms of Service</Link>
            <span> - </span>
            <Link to="/food/restaurant/profile/privacy" className="font-black text-[#ff2727] underline">Privacy Policy</Link>
          </p>
        </motion.div>
      </div>
    </div>
  )
}
