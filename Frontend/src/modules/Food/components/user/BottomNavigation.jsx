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
      pathname === "/food/user",
  },
  {
    label: "Subscription",
    to: "/food/user/profile/subscriptions",
    icon: CalendarDays,
    active: (pathname) =>
      pathname.startsWith("/food/user/profile/subscriptions") ||
      pathname.startsWith("/food/user/choose-meal") ||
      pathname.startsWith("/food/user/subscription-plans") ||
      pathname.startsWith("/food/user/checkout"),
  },
  {
    label: "History",
    to: "/food/user/orders",
    icon: History,
    active: (pathname) => pathname.startsWith("/food/user/orders"),
  },
  {
    label: "Profile",
    to: "/food/user/profile",
    icon: User,
    active: (pathname) => pathname.startsWith("/food/user/profile"),
  },
]

export default function BottomNavigation() {
  const { pathname } = useLocation()

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-gray-100 bg-white shadow-[0_-2px_10px_rgba(15,23,42,0.06)]">
      <div className="mx-auto grid h-[54px] max-w-md grid-cols-4 px-2">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = item.active(pathname)

          return (
            <Link
              key={item.label}
              to={item.to}
              className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition-colors ${
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
