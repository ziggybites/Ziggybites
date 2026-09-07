import { useEffect, useState } from "react"
import { Link, useLocation } from "react-router-dom"
import { CalendarDays, History, Home, User } from "lucide-react"

const navItems = [
  {
    label: "Home",
    to: "/food/user",
    icon: Home,
    active: (pathname) =>
      pathname === "/" ||
      pathname === "/food" ||
      pathname === "/food/" ||
      pathname === "/food/user" ||
      pathname === "/food/user/" ||
      pathname === "/user" ||
      pathname === "/user/",
  },
  {
    label: "Subscription",
    to: "/food/user/profile/subscriptions",
    icon: CalendarDays,
    active: (pathname) =>
      pathname.startsWith("/food/user/profile/subscriptions") ||
      pathname.startsWith("/user/profile/subscriptions") ||
      pathname.startsWith("/food/user/choose-meal") ||
      pathname.startsWith("/user/choose-meal") ||
      pathname.startsWith("/food/user/subscription-plans") ||
      pathname.startsWith("/user/subscription-plans") ||
      pathname.startsWith("/food/user/checkout") ||
      pathname.startsWith("/user/checkout"),
  },
  {
    label: "History",
    to: "/food/user/orders",
    icon: History,
    active: (pathname) =>
      pathname.startsWith("/food/user/orders") ||
      pathname.startsWith("/user/orders"),
  },
  {
    label: "Profile",
    to: "/food/user/profile",
    icon: User,
    active: (pathname) =>
      (pathname.startsWith("/food/user/profile") ||
        pathname.startsWith("/user/profile") ||
        pathname === "/profile" ||
        pathname.startsWith("/profile/")) &&
      !pathname.startsWith("/food/user/profile/subscriptions") &&
      !pathname.startsWith("/user/profile/subscriptions"),
  },
]

const isEditableElement = (element) => {
  if (!element || typeof element.getAttribute !== "function") return false
  const tagName = element.tagName?.toLowerCase()
  if (tagName === "textarea") return true
  if (element.isContentEditable) return true
  if (tagName === "input") {
    const type = (element.getAttribute("type") || "text").toLowerCase()
    const nonTextTypes = [
      "button",
      "checkbox",
      "color",
      "file",
      "hidden",
      "image",
      "radio",
      "range",
      "reset",
      "submit",
    ]
    return !nonTextTypes.includes(type)
  }
  return false
}

export default function BottomNavigation() {
  const { pathname } = useLocation()
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false)
  const [isTextInputFocused, setIsTextInputFocused] = useState(false)

  // Hide bottom nav when typing on pages where virtual keyboard pushes it up (e.g. safety emergency)
  useEffect(() => {
    if (typeof window === "undefined") return undefined

    const handleFocusIn = (event) => {
      if (isEditableElement(event.target)) {
        setIsTextInputFocused(true)
      }
    }

    const handleFocusOut = () => {
      window.setTimeout(() => {
        setIsTextInputFocused(isEditableElement(document.activeElement))
      }, 50)
    }

    const handleViewportChange = () => {
      if (window.visualViewport) {
        const vv = window.visualViewport
        const heightDiff = window.innerHeight - vv.height
        const screenDiff = (window.screen?.height || window.innerHeight) - vv.height
        const isShrunk = heightDiff > 120 || screenDiff > 200 || vv.height < window.innerHeight * 0.82
        setIsKeyboardVisible(isShrunk)
      } else {
        const isShrunk = window.innerHeight < 550
        setIsKeyboardVisible(isShrunk)
      }
    }

    document.addEventListener("focusin", handleFocusIn)
    document.addEventListener("focusout", handleFocusOut)

    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", handleViewportChange)
      window.visualViewport.addEventListener("scroll", handleViewportChange)
    } else {
      window.addEventListener("resize", handleViewportChange)
    }

    if (isEditableElement(document.activeElement)) {
      setIsTextInputFocused(true)
    }
    handleViewportChange()

    return () => {
      document.removeEventListener("focusin", handleFocusIn)
      document.removeEventListener("focusout", handleFocusOut)
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", handleViewportChange)
        window.visualViewport.removeEventListener("scroll", handleViewportChange)
      } else {
        window.removeEventListener("resize", handleViewportChange)
      }
    }
  }, [])

  // Only hide bottom nav on pages with specific text input issues (like report safety emergency),
  // keeping it permanently fixed at bottom on profile edit and standard views
  const isSafetyEmergency = pathname.includes("report-safety-emergency")
  const isHidden = isSafetyEmergency && (isKeyboardVisible || isTextInputFocused)

  return (
    <nav
      className={`md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-gray-100 bg-white shadow-[0_-2px_10px_rgba(15,23,42,0.06)] pb-[env(safe-area-inset-bottom)] transition-all duration-150 ${
        isHidden ? "hidden pointer-events-none" : ""
      }`}
      aria-hidden={isHidden}
    >
      <div className="mx-auto grid h-[54px] max-w-md grid-cols-4 px-2">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = item.active(pathname)

          return (
            <Link
              key={item.label}
              to={item.to}
              className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition-all active:scale-95 active:opacity-70 ${
                isActive ? "text-[#e32c31]" : "text-[#4f4b5c]"
              }`}
            >
              <Icon
                className={`h-5 w-5 ${isActive ? "fill-[#e32c31]/10" : ""}`}
                strokeWidth={isActive ? 2.8 : 2.2}
              />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
