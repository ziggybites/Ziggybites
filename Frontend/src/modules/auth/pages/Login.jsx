import React, { useEffect, useState, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Link, useNavigate } from "react-router-dom"
import { Phone, ArrowRight, Loader2, ShieldCheck, Heart, ShieldQuestion } from "lucide-react"

import { toast } from "sonner"
import { authAPI, userAPI } from "@food/api"
import { setAuthData } from "@food/utils/auth"
import { getCachedSettings, loadBusinessSettings } from "@food/utils/businessSettings"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@food/components/ui/dialog"
import { Button } from "@food/components/ui/button"
import { Input } from "@food/components/ui/input"
import { Label } from "@food/components/ui/label"
import { User } from "lucide-react"

export default function UnifiedOTPFastLogin() {
  const RESEND_COOLDOWN_SECONDS = 60
  const [phoneNumber, setPhoneNumber] = useState("")
  const [otp, setOtp] = useState("")
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [resendTimer, setResendTimer] = useState(0)
  const [showNameModal, setShowNameModal] = useState(false)
  const [newName, setNewName] = useState("")
  const [isUpdatingName, setIsUpdatingName] = useState(false)
  const [tempAuth, setTempAuth] = useState(null)
  const [pendingVerify, setPendingVerify] = useState(null)
  const [brand, setBrand] = useState(() => {
    const cached = getCachedSettings()
    return {
      logoUrl: cached?.logo?.url || null,
      companyName: cached?.companyName || "ZiggyBites",
    }
  })
  const navigate = useNavigate()
  const submitting = useRef(false)
  const goToFoodPreference = () => navigate("/user/auth/portal", { replace: true })

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

  const normalizedPhone = () => {
    const digits = String(phoneNumber).replace(/\D/g, "").slice(-15)
    return digits.length >= 8 ? digits : ""
  }

  const handleSendOTP = async (e) => {
    e.preventDefault()
    const phone = normalizedPhone()
    if (phone.length < 10) {
      toast.error("Please enter a valid 10-digit phone number")
      return
    }
    if (submitting.current) return
    submitting.current = true
    setLoading(true)
    try {
      await authAPI.sendOTP(phoneNumber, "login", null)
      setOtp("")
      setStep(2)
      setResendTimer(RESEND_COOLDOWN_SECONDS)
      toast.success("OTP sent successfully!")
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        "Failed to send OTP."
      toast.error(msg)
    } finally {
      setLoading(false)
      submitting.current = false
    }
  }

  const handleResendOTP = async () => {
    const phone = normalizedPhone()
    if (phone.length < 10) {
      toast.error("Please enter a valid phone number")
      return
    }
    if (resendTimer > 0 || submitting.current) return
    submitting.current = true
    setLoading(true)
    try {
      await authAPI.sendOTP(phoneNumber, "login", null)
      setOtp("")
      setResendTimer(RESEND_COOLDOWN_SECONDS)
      toast.success("OTP resent successfully.")
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        "Failed to resend OTP."
      toast.error(msg)
    } finally {
      setLoading(false)
      submitting.current = false
    }
  }

  const handleEditNumber = () => {
    setStep(1)
    setOtp("")
    setResendTimer(0)
    setPendingVerify(null)
    setShowNameModal(false)
    setNewName("")
  }

  const handleVerifyOTP = async (e) => {
    e.preventDefault()
    const otpDigits = String(otp).replace(/\D/g, "").slice(0, 4)
    if (otpDigits.length !== 4) {
      toast.error("Please enter the 4-digit OTP")
      return
    }
    if (submitting.current) return
    submitting.current = true
    setLoading(true)
    let fcmToken = null
    let platform = "web"
    try {
      try {
        if (typeof window !== "undefined") {
          if (window.flutter_inappwebview) {
            platform = "mobile";
            const handlerNames = ["getFcmToken", "getFCMToken", "getPushToken", "getFirebaseToken"];
            for (const handlerName of handlerNames) {
              try {
                const t = await window.flutter_inappwebview.callHandler(handlerName, { module: "user" });
                if (t && typeof t === "string" && t.length > 20) {
                  fcmToken = t.trim();
                  break;
                }
              } catch (e) { }
            }
          } else {
            fcmToken = localStorage.getItem("fcm_web_registered_token_user") || null;
          }
        }
      } catch (e) {
        console.warn("Failed to get FCM token during login", e);
      }

      const response = await authAPI.verifyOTP(phoneNumber, otpDigits, "login", null, null, "user", null, null, fcmToken, platform)
      const data = response?.data?.data || response?.data || {}
      const accessToken = data.accessToken
      const refreshToken = data.refreshToken || null
      const user = data.user

      setAuthData("user", accessToken, user, refreshToken)

      // If user has no name, show name modal instead of immediate navigation
      if (!user.name || user.name.trim() === "") {
        setTempAuth({ accessToken, user, refreshToken })
        setShowNameModal(true)
      } else {
        toast.success("Welcome back!")
        goToFoodPreference()
      }
    } catch (err) {
      const status = err?.response?.status
      let msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || "Invalid OTP. Please try again."
      const nameRequired = /name\s+is\s+required.*first[- ]?time|first[- ]?time.*name\s+is\s+required|first[- ]?time\s*sign\s*up/i.test(String(msg))
      if (nameRequired) {
        setPendingVerify({ phone: phoneNumber, otp: otpDigits, fcmToken, platform })
        setShowNameModal(true)
        return
      }
      if (status === 401) {
        if (/deactivat(ed|e)/i.test(String(msg))) {
          msg = "Your account is deactivated. Please contact support."
        } else {
          msg = "Invalid or expired code, or account not active."
        }
      }
      toast.error(msg)
    } finally {
      setLoading(false)
      submitting.current = false
    }
  }

  const handleNameSubmit = async (e) => {
    e.preventDefault()
    if (!newName.trim()) {
      toast.error("Please enter your name")
      return
    }

    try {
      setIsUpdatingName(true)
      if (pendingVerify) {
        const response = await authAPI.verifyOTP(
          pendingVerify.phone,
          pendingVerify.otp,
          "login",
          newName.trim(),
          null,
          "user",
          null,
          null,
          pendingVerify.fcmToken,
          pendingVerify.platform,
        )
        const data = response?.data?.data || response?.data || {}
        const accessToken = data.accessToken
        const refreshToken = data.refreshToken || null
        const user = data.user

        setAuthData("user", accessToken, user, refreshToken)
        setPendingVerify(null)
        toast.success(`Welcome, ${newName.trim()}!`)
        setShowNameModal(false)
        goToFoodPreference()
        return
      }

      // Call update profile API
      await userAPI.updateProfile({ name: newName.trim() })

      // Update local storage and auth data with the new name
      const updatedUser = { ...tempAuth.user, name: newName.trim() }
      setAuthData("user", tempAuth.accessToken, updatedUser, tempAuth.refreshToken)

      toast.success(`Welcome, ${newName.trim()}!`)
      setShowNameModal(false)
      goToFoodPreference()
    } catch (err) {
      toast.error("Failed to update name. You can skip this for now or try again.")
      console.error(err)
    } finally {
      setIsUpdatingName(false)
    }
  }

  useEffect(() => {
    if (step !== 2 || resendTimer <= 0) return
    const intervalId = setInterval(() => {
      setResendTimer((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(intervalId)
  }, [step, resendTimer])

  const formatResendTimer = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
  }

  const updateOtpDigit = (index, rawValue) => {
    const val = rawValue.replace(/\D/g, "").slice(-1)
    const nextOtp = Array.from({ length: 4 }, (_, digitIndex) => otp[digitIndex] || "")
    nextOtp[index] = val
    setOtp(nextOtp.join(""))

    if (val && index < 3) {
      document.getElementById(`otp-${index + 1}`)?.focus()
    }
  }

  const handleOtpBackspace = (index) => {
    const nextOtp = Array.from({ length: 4 }, (_, digitIndex) => otp[digitIndex] || "")

    if (nextOtp[index]) {
      nextOtp[index] = ""
      setOtp(nextOtp.join(""))
      return
    }

    if (index > 0) {
      nextOtp[index - 1] = ""
      setOtp(nextOtp.join(""))
      document.getElementById(`otp-${index - 1}`)?.focus()
    }
  }

  const handleOtpPaste = (e) => {
    e.preventDefault()
    const digits = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 4)
    if (!digits) return

    const nextOtp = Array.from({ length: 4 }, (_, digitIndex) => digits[digitIndex] || "")
    setOtp(nextOtp.join(""))

    const nextFocusIndex = Math.min(digits.length, 3)
    document.getElementById(`otp-${nextFocusIndex}`)?.focus()
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
            <div className="relative mx-auto mb-2 flex h-36 w-36 items-center justify-center rounded-full bg-white">
              {brand.logoUrl ? (
                <img
                  src={brand.logoUrl}
                  alt={`${brand.companyName || "Company"} Logo`}
                  className="h-36 w-36 rounded-full object-contain"
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
            <AnimatePresence mode="wait">
              {step === 1 ? (
                <motion.form
                  key="new-step-1"
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 16 }}
                  onSubmit={handleSendOTP}
                  className="space-y-4"
                >
                  <div className="relative rounded-xl bg-white shadow-[0_8px_28px_rgba(15,23,42,0.08)] ring-1 ring-gray-100">
                    <div className="absolute inset-y-0 left-4 flex items-center">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-[#ff1f1f]">
                        <Phone className="h-4 w-4" />
                      </span>
                    </div>
                    <div className="pointer-events-none absolute inset-y-0 left-16 flex items-center pt-4">
                      <span className="text-sm font-black leading-none text-[#202030]">+91</span>
                    </div>
                    <input
                      type="tel"
                      required
                      autoFocus
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, "").slice(0, 10))}
                      maxLength={10}
                      className="block h-14 w-full rounded-xl bg-transparent pl-[92px] pr-4 pt-4 text-sm font-black leading-none text-[#202030] outline-none placeholder:text-gray-300"
                      placeholder="98765 43210"
                    />
                    <div className="pointer-events-none absolute left-16 top-2 text-[9px] font-semibold text-gray-400">
                      Enter your phone number
                    </div>
                  </div>

                  <label className="flex items-center gap-2 text-[10px] font-semibold text-[#5f5f6f]">
                    <input type="checkbox" defaultChecked className="h-3.5 w-3.5 rounded border-red-200 accent-[#ff2727]" />
                    Remember me for faster sign-in
                  </label>

                  <button
                    type="submit"
                    disabled={loading || phoneNumber.length < 10}
                    className="relative flex h-12 w-full items-center justify-center rounded-xl bg-gradient-to-r from-[#ef1f1f] to-[#ff641f] text-sm font-black text-white shadow-[0_12px_24px_rgba(255,49,31,0.25)] transition active:scale-[0.98] disabled:opacity-60"
                  >
                    {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Continue"}
                    {!loading && <ArrowRight className="absolute right-5 h-4 w-4" />}
                  </button>


                </motion.form>
              ) : (
                <motion.form
                  key="new-step-2"
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  onSubmit={handleVerifyOTP}
                  className="space-y-4"
                >
                  <p className="text-center text-xs font-semibold text-gray-500">
                    Enter the code sent to +91 {phoneNumber}
                  </p>
                  <div className="flex justify-between gap-3">
                    {[0, 1, 2, 3].map((index) => (
                      <input
                        key={index}
                        id={`otp-${index}`}
                        type="tel"
                        inputMode="numeric"
                        required
                        autoFocus={index === 0}
                        value={otp[index] || ""}
                        onChange={(e) => updateOtpDigit(index, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Backspace") {
                            e.preventDefault()
                            handleOtpBackspace(index)
                          }
                        }}
                        onPaste={index === 0 ? handleOtpPaste : undefined}
                        className="h-14 w-full rounded-xl bg-white text-center text-2xl font-black text-[#202030] shadow-[0_8px_28px_rgba(15,23,42,0.08)] ring-1 ring-gray-100 outline-none focus:ring-[#ff2727]"
                      />
                    ))}
                  </div>
                  <div className="text-center text-[11px] font-semibold">
                    {resendTimer > 0 ? (
                      <span className="text-gray-400">Resend code in <span className="text-[#ff2727]">{formatResendTimer(resendTimer)}</span></span>
                    ) : (
                      <button type="button" onClick={handleResendOTP} className="text-[#ff2727]">Resend code</button>
                    )}
                    <button type="button" onClick={handleEditNumber} className="ml-4 text-gray-400">Edit number</button>
                  </div>
                  <button
                    type="submit"
                    disabled={loading || otp.length < 4}
                    className="flex h-12 w-full items-center justify-center rounded-xl bg-gradient-to-r from-[#ef1f1f] to-[#ff641f] text-sm font-black text-white shadow-[0_12px_24px_rgba(255,49,31,0.25)] transition active:scale-[0.98] disabled:opacity-60"
                  >
                    {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Verify & Continue"}
                  </button>
                </motion.form>
              )}
            </AnimatePresence>
          </div>

          <p className="mx-auto mt-5 max-w-[260px] text-center text-[9px] font-semibold leading-4 text-gray-400">
            By continuing, you agree to our<br />
            <Link to="/food/user/profile/terms" className="font-black text-[#ff2727] underline">Terms of Service</Link>
            <span> • </span>
            <Link to="/food/user/profile/privacy" className="font-black text-[#ff2727] underline">Privacy Policy</Link>
            <span> • </span>
            <Link to="/food/user/profile/cancellation" className="font-black text-[#ff2727] underline">Content Policy</Link>
          </p>
        </motion.div>
      </div>

      <div className="hidden">
      {/* Decorative Background Elements */}
      <div className="absolute top-0 left-0 w-full h-[600px] bg-gradient-to-b from-[#7e3866]/10 via-[#7e3866]/5 to-transparent pointer-events-none" />
      <div className="absolute top-[-100px] right-[-100px] w-[500px] h-[500px] bg-[#7e3866]/5 rounded-full blur-[120px] pointer-events-none animate-pulse" />
      <div className="absolute bottom-[-100px] left-[-100px] w-[400px] h-[400px] bg-[#7e3866]/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Main Content */}
      <div className="absolute top-6 right-6 z-20">
        <Link to="/user/auth/support">
          <Button variant="ghost" className="text-gray-500 hover:text-[#7e3866] font-semibold flex items-center gap-2">
            <ShieldQuestion className="w-5 h-5" />
            Support
          </Button>
        </Link>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="w-full max-w-md lg:max-w-lg"
        >
          {/* Logo & Header */}
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 20 }}
              className="relative inline-block mb-4"
            >
              {brand.logoUrl ? (
                <img
                  src={brand.logoUrl}
                  alt={`${brand.companyName || "Company"} Logo`}
                  className="w-40 h-40 md:w-48 md:h-48 object-contain mx-auto"
                  onError={() => setBrand((prev) => ({ ...prev, logoUrl: null }))}
                />
              ) : (
                <div className="w-40 h-40 md:w-48 md:h-48 mx-auto rounded-full bg-[#7e3866]/10 text-[#7e3866] flex items-center justify-center text-5xl md:text-6xl font-black">
                  {(brand.companyName || "Z").trim().charAt(0).toUpperCase()}
                </div>
              )}
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-gray-400 dark:text-gray-500 font-semibold text-sm uppercase tracking-[0.2em]"
            >
              TASTE THE DIFFERENCE
            </motion.p>
          </div>

          {/* Login Card */}
          <div className="bg-white/80 dark:bg-[#1a1a1a]/80 backdrop-blur-2xl rounded-[3rem] p-8 sm:p-12 shadow-[0_40px_80px_-20px_rgba(126,56,102,0.2)] dark:shadow-none border border-white/20 dark:border-gray-800 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-transparent via-[#7e3866]/20 to-transparent" />

            <div className="mb-10 text-center sm:text-left">
              <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-2 font-['Outfit'] tracking-tight">
                {step === 1 ? "Welcome Back" : "Security Check"}
              </h2>
              <div className="h-1 w-10 bg-[#7e3866] rounded-full mb-3 hidden sm:block" />
              <p className="text-base text-gray-500 dark:text-gray-400 font-medium">
                {step === 1
                  ? "Enter your details to access your account"
                  : `We've sent a code to +91 ${phoneNumber}`}
              </p>
            </div>

            <AnimatePresence mode="wait">
              {step === 1 ? (
                <motion.form
                  key="step-1"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  onSubmit={handleSendOTP}
                  className="space-y-6"
                >
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
                      <span className="flex h-full items-center text-sm font-bold text-[#7e3866] border-r border-gray-200 dark:border-gray-800 pr-3 leading-none">+91</span>
                    </div>
                    <input
                      type="tel"
                      required
                      autoFocus
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, "").slice(0, 10))}
                      maxLength={10}
                      className="block w-full pl-16 pr-6 py-4 bg-gray-50 dark:bg-gray-900/50 text-gray-900 dark:text-white border-2 border-transparent focus:border-[#7e3866]/50 rounded-2xl outline-none transition-all placeholder:text-gray-300 font-bold text-lg shadow-sm"
                      placeholder="Phone number"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading || phoneNumber.length < 10}
                    className="w-full py-4.5 bg-[#7e3866] hover:bg-[#6a2f56] disabled:bg-gray-200 dark:disabled:bg-gray-800 disabled:text-gray-400 text-white rounded-2xl font-bold text-lg shadow-xl shadow-[#7e3866]/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2 group overflow-hidden relative"
                  >
                    {loading ? (
                      <Loader2 className="w-6 h-6 animate-spin" />
                    ) : (
                      <>
                        <span>Continue</span>
                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                    <motion.div
                      className="absolute inset-0 bg-white/20 translate-x-[-100%]"
                      whileHover={{ translateX: "100%" }}
                      transition={{ duration: 0.6 }}
                    />
                  </button>
                </motion.form>
              ) : (
                <motion.form
                  key="step-2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  onSubmit={handleVerifyOTP}
                  className="space-y-6"
                >
                  <div className="flex justify-between gap-3">
                    {[0, 1, 2, 3].map((index) => (
                      <input
                        key={index}
                        id={`otp-${index}`}
                        type="tel"
                        inputMode="numeric"
                        required
                        autoFocus={index === 0}
                        value={otp[index] || ""}
                        onChange={(e) => updateOtpDigit(index, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Backspace") {
                            e.preventDefault()
                            handleOtpBackspace(index)
                          }
                        }}
                        onPaste={index === 0 ? handleOtpPaste : undefined}
                        className="w-full h-16 text-center text-3xl font-bold bg-gray-50 dark:bg-gray-900 border-2 border-transparent focus:border-[#7e3866]/50 rounded-2xl outline-none transition-all text-gray-900 dark:text-white shadow-sm"
                        placeholder="•"
                      />
                    ))}
                  </div>

                  <div className="flex flex-col items-center gap-4">
                    <div className="flex items-center gap-2 text-xs font-semibold">
                      {resendTimer > 0 ? (
                        <span className="text-gray-400">Resend code in <span className="text-[#7e3866]">{formatResendTimer(resendTimer)}</span></span>
                      ) : (
                        <button
                          type="button"
                          onClick={handleResendOTP}
                          className="text-[#7e3866] hover:underline"
                        >
                          Didn't receive code? Resend
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={handleEditNumber}
                      className="text-xs text-gray-400 hover:text-[#7e3866] transition-colors"
                    >
                      Edit phone number
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || otp.length < 4}
                    className="w-full py-4.5 bg-[#7e3866] hover:bg-[#6a2f56] disabled:bg-gray-200 dark:disabled:bg-gray-800 disabled:text-gray-400 text-white rounded-2xl font-bold text-lg shadow-xl shadow-[#7e3866]/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                  >
                    {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : "Verify & Continue"}
                  </button>
                </motion.form>
              )}
            </AnimatePresence>
          </div>

          {/* Footer Info */}
          <div className="mt-8 text-center">
            <p className="text-[11px] text-gray-400 font-medium leading-relaxed max-w-[320px] mx-auto">
              By continuing, you agree to our <br />
              <Link to="/food/user/profile/terms" className="text-gray-900 dark:text-white font-bold hover:text-[#7e3866] transition-colors">Terms of Service</Link> & <Link to="/food/user/profile/privacy" className="text-gray-900 dark:text-white font-bold hover:text-[#7e3866] transition-colors">Privacy Policy</Link>
            </p>
          </div>

          <div className="mt-12 flex justify-center items-center gap-6 opacity-30 grayscale hover:opacity-60 transition-opacity">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" />
              <span className="text-[10px] font-black uppercase tracking-widest">Secure Payment</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Heart className="w-4 h-4" />
              <span className="text-[10px] font-black uppercase tracking-widest">Handmade with Love</span>
            </div>
          </div>
        </motion.div>
      </div>

      </div>

      {/* Name Collection Modal */}
      <Dialog open={showNameModal} onOpenChange={setShowNameModal}>
        <DialogContent
          className="sm:max-w-[425px] rounded-3xl border-none p-0 overflow-hidden bg-white dark:bg-[#1a1a1a]"
          showCloseButton={false}
        >
          <div className="bg-[#7e3866] p-8 text-center relative">
            <div className="absolute top-[-20%] right-[-10%] w-32 h-32 bg-white/10 rounded-full blur-2xl" />
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center mx-auto mb-4 border border-white/30"
            >
              <User className="w-10 h-10 text-white" />
            </motion.div>
            <DialogTitle className="text-2xl font-bold text-white mb-2">Almost there!</DialogTitle>
            <DialogDescription className="text-white/80">
              We'd love to know your name to personalize your experience.
            </DialogDescription>
          </div>

          <form onSubmit={handleNameSubmit} className="p-8 pt-6 space-y-6">
            <div className="space-y-4">
              <Label htmlFor="name" className="text-sm font-medium text-gray-700 dark:text-gray-300 ml-1">
                Full Name
              </Label>
              <div className="relative group">
                <Input
                  id="name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Enter your name"
                  className="pl-4 h-14 bg-gray-50 dark:bg-gray-800 border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-[#7e3866] transition-all group-hover:border-[#7e3866]/30"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <Button
                type="submit"
                disabled={isUpdatingName}
                className="w-full h-14 bg-[#7e3866] hover:bg-[#6b2f57] text-white rounded-2xl font-bold text-lg shadow-lg shadow-[#7e3866]/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                {isUpdatingName ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  "Complete Profile"
                )}
              </Button>
              {!pendingVerify ? (
                <button
                  type="button"
                  onClick={() => {
                    setShowNameModal(false)
                    goToFoodPreference()
                  }}
                  className="text-sm text-gray-400 hover:text-gray-600 transition-colors py-2"
                >
                  Skip for now
                </button>
              ) : (
                <p className="text-xs text-gray-400 text-center">Name is required to complete signup.</p>
              )}
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
