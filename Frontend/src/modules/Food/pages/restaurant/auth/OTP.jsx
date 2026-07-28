import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowLeft, ShieldCheck, Timer, RefreshCw, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { restaurantAPI } from "@food/api"
import {
  setAuthData as setRestaurantAuthData,
  setRestaurantPendingPhone,
} from "@food/utils/auth"
import { checkOnboardingStatus, isRestaurantOnboardingComplete } from "@food/utils/onboardingUtils"

export default function RestaurantOTP() {
  const navigate = useNavigate()
  const [otp, setOtp] = useState(["", "", "", ""])
  const [isLoading, setIsLoading] = useState(false)
  const [resendTimer, setResendTimer] = useState(0)
  const [authData, setAuthData] = useState(null)
  const [contactInfo, setContactInfo] = useState("")
  const [focusedIndex, setFocusedIndex] = useState(null)
  const inputRefs = useRef([])
  const hasSubmittedRef = useRef(false)

  useEffect(() => {
    const stored = sessionStorage.getItem("restaurantAuthData")
    if (stored) {
      const data = JSON.parse(stored)
      setAuthData(data)

      if (data.method === "email" && data.email) {
        setContactInfo(data.email)
      } else if (data.phone) {
        const phoneMatch = data.phone?.match(/(\+\d+)\s*(.+)/)
        if (phoneMatch) {
          const formattedPhone = `${phoneMatch[1]} ${phoneMatch[2].replace(/\D/g, "")}`
          setContactInfo(formattedPhone)
        } else {
          setContactInfo(data.phone || "")
        }
      }
    } else {
      navigate("/food/restaurant/login")
      return
    }

    setResendTimer(60)
    const timer = setInterval(() => {
      setResendTimer((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [navigate])

  useEffect(() => {
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus()
    }
  }, [])

  const handleChange = (index, value) => {
    const digit = String(value || "").replace(/\D/g, "").slice(-1)

    const newOtp = [...otp]
    newOtp[index] = digit
    setOtp(newOtp)

    if (digit && index < 3) {
      inputRefs.current[index + 1]?.focus()
    }

    if (newOtp.every((digit) => digit !== "")) {
      if (!hasSubmittedRef.current) {
        hasSubmittedRef.current = true
        handleVerify(newOtp.join(""))
      }
    }
  }

  const handlePaste = (e) => {
    e.preventDefault()
    const pastedDigits = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 4)
      .split("")

    if (!pastedDigits.length) return

    const nextOtp = ["", "", "", ""]
    pastedDigits.forEach((digit, index) => {
      nextOtp[index] = digit
    })
    setOtp(nextOtp)

    if (pastedDigits.length === 4) {
      hasSubmittedRef.current = true
      handleVerify(nextOtp.join(""))
    } else {
      inputRefs.current[pastedDigits.length]?.focus()
    }
  }

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace") {
      if (!otp[index] && index > 0) {
        inputRefs.current[index - 1]?.focus()
        const newOtp = [...otp]
        newOtp[index - 1] = ""
        setOtp(newOtp)
      }
    }
  }

  const handleVerify = async (otpValue = null) => {
    const code = otpValue || otp.join("")

    if (code.length !== 4) {
      toast.error("Please enter the complete 4-digit code")
      hasSubmittedRef.current = false
      return
    }

    setIsLoading(true)

    try {
      if (!authData) throw new Error("Session expired. Please login again.")

      const phone = authData.method === "phone" ? authData.phone : null
      const email = authData.method === "email" ? authData.email : null
      const purpose = authData.isSignUp ? "register" : "login"

      const response = await restaurantAPI.verifyOTP(phone, code, purpose, null, email)
      const data = response?.data?.data || response?.data

      if (data?.needsRegistration) {
        setRestaurantPendingPhone(data.phone || phone)
        sessionStorage.removeItem("restaurantAuthData")
        navigate("/food/restaurant/onboarding", { replace: true })
        return
      }

      if (data?.pendingApproval) {
        const pendingPhone = data.phone || phone
        setRestaurantPendingPhone(pendingPhone)
        sessionStorage.removeItem("restaurantAuthData")
        navigate("/food/restaurant/pending-verification", {
          replace: true,
          state: {
            phone: pendingPhone,
            isRejected: data.isRejected,
            rejectionReason: data.rejectionReason
          },
        })
        return
      }

      const accessToken = data?.accessToken
      const restaurant = data?.user ?? data?.restaurant

      if (accessToken && restaurant) {
        setRestaurantAuthData("restaurant", accessToken, restaurant, data?.refreshToken)
        window.dispatchEvent(new Event("restaurantAuthChanged"))
        sessionStorage.removeItem("restaurantAuthData")
        toast.success("Verification successful!")

        setTimeout(async () => {
          if (authData?.isSignUp) {
            navigate("/food/restaurant/onboarding", { replace: true })
          } else {
            const onboardingComplete = isRestaurantOnboardingComplete(restaurant)
            if (!onboardingComplete) {
              const incompleteStep = await checkOnboardingStatus()
              if (incompleteStep) {
                navigate(`/food/restaurant/onboarding?step=${incompleteStep}`, { replace: true })
                return
              }
            }
            navigate("/food/restaurant", { replace: true })
          }
        }, 800)
      }
    } catch (err) {
      const message = err?.response?.data?.message || "Invalid OTP. Please try again."

      if (/pending approval/i.test(message)) {
        const pendingPhone = authData?.phone || authData?.email || contactInfo
        setRestaurantPendingPhone(pendingPhone)
        navigate("/food/restaurant/pending-verification", {
          replace: true,
          state: { phone: pendingPhone || "" },
        })
        return
      }

      toast.error(message)
      setOtp(["", "", "", ""])
      hasSubmittedRef.current = false
      inputRefs.current[0]?.focus()
    } finally {
      setIsLoading(false)
    }
  }

  const handleResend = async () => {
    if (resendTimer > 0) return
    setIsLoading(true)
    try {
      const purpose = authData.isSignUp ? "register" : "login"
      await restaurantAPI.sendOTP(authData.phone, purpose, authData.email)
      toast.success("New code sent!")
      setResendTimer(60)
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to resend code")
    } finally {
      setIsLoading(false)
    }
  }

  const isOtpComplete = otp.every((digit) => digit !== "")

  if (!authData) return null

  return (
    <div className="min-h-screen bg-[#fbfbfc] dark:bg-[#0a0a0a] flex flex-col relative overflow-hidden">
      {/* Decorative Background Elements */}
      <div
        className="absolute top-0 left-0 w-full h-[600px] pointer-events-none"
        style={{
          background:
            "linear-gradient(to bottom, color-mix(in srgb, var(--app-theme-primary) 10%, transparent), color-mix(in srgb, var(--app-theme-primary) 5%, transparent), transparent)",
        }}
      />
      <div
        className="absolute top-[-100px] right-[-100px] w-[500px] h-[500px] rounded-full blur-[120px] pointer-events-none"
        style={{ backgroundColor: "color-mix(in srgb, var(--app-theme-primary) 5%, transparent)" }}
      />
      <div
        className="absolute bottom-[-100px] left-[-100px] w-[400px] h-[400px] rounded-full blur-[120px] pointer-events-none"
        style={{ backgroundColor: "color-mix(in srgb, var(--app-theme-primary) 5%, transparent)" }}
      />

      {/* Header / Back */}
      <div className="relative z-20 px-5 py-5 flex items-center">
        <motion.button
          whileHover={{ x: -4 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => navigate("/food/restaurant/login")}
          className="p-3 bg-white dark:bg-[#1a1a1a] rounded-xl text-[var(--app-theme-primary)] border outline-none"
          style={{
            borderColor: "color-mix(in srgb, var(--app-theme-primary) 5%, transparent)",
            boxShadow: "0 20px 25px -5px color-mix(in srgb, var(--app-theme-primary) 10%, transparent)",
          }}
        >
          <ArrowLeft className="w-5 h-5" />
        </motion.button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-5 pb-14 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-[420px]"
        >
          {/* Icon & Title */}
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
              className="w-16 h-16 bg-[var(--app-theme-primary)] rounded-2xl flex items-center justify-center mx-auto mb-5 relative"
              style={{ boxShadow: "0 25px 50px -12px color-mix(in srgb, var(--app-theme-primary) 30%, transparent)" }}
            >
              <ShieldCheck className="text-white w-8 h-8" />
            </motion.div>

            <h1 className="text-3xl font-black text-slate-950 dark:text-white tracking-tight mb-3">
              Verify Account
            </h1>
            <p className="text-sm leading-6 text-gray-500 dark:text-gray-400 font-medium">
              Enter the 4-digit code sent to<br />
              <span className="text-[var(--app-theme-primary)] font-extrabold">{contactInfo}</span>
            </p>
          </div>

          {/* OTP Input Card */}
          <div
            className="bg-white dark:bg-[#1a1a1a] rounded-3xl p-6 sm:p-8 border border-gray-100 dark:border-gray-800"
            style={{ boxShadow: "0 24px 60px -28px color-mix(in srgb, var(--app-theme-primary) 34%, transparent)" }}
          >
            <div className="grid grid-cols-4 gap-3 sm:gap-4 mb-8">
              {otp.map((digit, index) => (
                <div key={index} className="relative group">
                  <input
                    ref={(el) => (inputRefs.current[index] = el)}
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete={index === 0 ? "one-time-code" : "off"}
                    autoFocus={index === 0}
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    onPaste={handlePaste}
                    onFocus={(e) => {
                      setFocusedIndex(index)
                      e.target.select()
                    }}
                    onBlur={() => setFocusedIndex(null)}
                    className={`w-full aspect-square bg-white dark:bg-gray-900/50 text-center text-3xl font-black text-slate-950 dark:text-white border-2 rounded-2xl outline-none transition-all ${
                      focusedIndex === index
                        ? "scale-105"
                        : digit
                          ? "border-slate-300 dark:border-gray-600"
                          : "border-slate-200 dark:border-gray-700 group-hover:border-slate-300"
                    }`}
                    style={
                      focusedIndex === index
                        ? {
                            borderColor: "var(--app-theme-primary)",
                            boxShadow: "0 10px 30px color-mix(in srgb, var(--app-theme-primary) 10%, transparent)",
                          }
                        : undefined
                    }
                  />
                  <div className={`absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-1 rounded-full transition-all duration-300 ${focusedIndex === index ? "bg-[var(--app-theme-primary)] opacity-100" : "bg-gray-200 opacity-0"}`} />
                </div>
              ))}
            </div>

            <button
              onClick={() => handleVerify()}
              disabled={isLoading || !isOtpComplete}
              className="w-full py-4 bg-[var(--app-theme-primary)] hover:brightness-90 disabled:bg-gray-200 dark:disabled:bg-gray-800 disabled:text-gray-400 text-white rounded-2xl font-bold text-base transition-all active:scale-[0.98] flex items-center justify-center gap-2 mb-7"
              style={{ boxShadow: "0 20px 25px -5px color-mix(in srgb, var(--app-theme-primary) 20%, transparent)" }}
            >
              {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : "Verify & Continue"}
            </button>

            {/* Resend Logic */}
            <div className="text-center">
              {resendTimer > 0 ? (
                <p className="text-gray-400 flex items-center justify-center gap-2 uppercase text-[10px] font-black tracking-wide">
                  <Timer className="w-3.5 h-3.5 text-[var(--app-theme-primary)]" />
                  Resend code in <span className="text-[var(--app-theme-primary)] font-bold">{resendTimer}s</span>
                </p>
              ) : (
                <button
                  onClick={handleResend}
                  className="text-xs text-[var(--app-theme-primary)] font-black uppercase tracking-widest hover:underline underline-offset-4 flex items-center justify-center gap-2 mx-auto"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Resend OTP Code
                </button>
              )}
            </div>
          </div>

          <p className="mt-8 text-[10px] font-black text-gray-300 dark:text-gray-600 text-center uppercase tracking-[0.25em]">
            Secure Verification &bull; ZiggyBites Partner
          </p>
        </motion.div>
      </div>
    </div>
  )
}
