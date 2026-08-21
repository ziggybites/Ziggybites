import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom"
import { useEffect, Suspense, lazy } from "react"
import ProtectedRoute from "@food/components/ProtectedRoute"
import AuthRedirect from "@food/components/AuthRedirect"
import Loader from "@food/components/Loader"
import AuthInitializer from "@food/components/AuthInitializer"
import PushSoundEnableButton from "@food/components/PushSoundEnableButton"
import { registerWebPushForCurrentModule } from "@food/utils/firebaseMessaging"

// Lazy Loading Components
const UserRouter = lazy(() => import("@food/components/user/UserRouter"))

// Restaurant Module
const RestaurantRouter = lazy(() => import("@food/components/restaurant/RestaurantRouter"))

// Admin Module
const AdminRouter = lazy(() => import("@food/components/admin/AdminRouter"))
const AdminLogin = lazy(() => import("@food/pages/admin/auth/AdminLogin"))
const AdminSignup = lazy(() => import("@food/pages/admin/auth/AdminSignup"))
const AdminForgotPassword = lazy(() => import("@food/pages/admin/auth/AdminForgotPassword"))

// Delivery Module
const DeliveryRouter = lazy(() => import("../DeliveryV2"))

function UserPathRedirect() {
  const location = useLocation()
  // Correctly handle the /food/user -> /food redirect regardless of where it starts
  const newPath = location.pathname.replace("/user", "") || "/food"
  return <Navigate to={newPath} replace />
}

// Scroll to top on route change
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function UserAuthRecovery() {
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    const isUserAuthRoute = (pathname) => {
      const path = String(pathname || "")
      return (
        path === "/food/user/auth/login" ||
        path === "/food/user/auth/otp" ||
        path === "/food/user/auth/callback" ||
        path === "/user/auth/login" ||
        path === "/user/auth/otp" ||
        path === "/user/auth/callback"
      )
    }

    const handleUserSessionExpired = (event) => {
      const moduleName = event?.detail?.module
      if (moduleName && moduleName !== "user") return
      if (event?.type === "userAuthChanged" && event?.detail?.authenticated !== false) return

      const currentPath = String(window.location?.pathname || location.pathname || "")
      if (!currentPath.startsWith("/food/user") && !currentPath.startsWith("/user")) return
      if (isUserAuthRoute(currentPath)) return

      navigate("/food/user/auth/login", {
        replace: true,
        state: { reason: "session_expired", from: currentPath },
      })
    }

    window.addEventListener("authRefreshFailed", handleUserSessionExpired)
    window.addEventListener("userAuthChanged", handleUserSessionExpired)

    return () => {
      window.removeEventListener("authRefreshFailed", handleUserSessionExpired)
      window.removeEventListener("userAuthChanged", handleUserSessionExpired)
    }
  }, [location.pathname, navigate])

  return null
}

export default function App() {
  const location = useLocation()

  useEffect(() => {
    registerWebPushForCurrentModule(location.pathname)
  }, [location.pathname])

  return (
    <AuthInitializer>
      <>
        <ScrollToTop />
        <UserAuthRecovery />
        <PushSoundEnableButton />
        <Suspense fallback={<Loader />}>
          <Routes>
            {/* Restaurant Module - Already mapped to /restaurant */}
            <Route
              path="restaurant/*"
              element={
                <RestaurantRouter />
              }
            />

            {/* Delivery Module - Already mapped to /delivery */}
            <Route
              path="delivery/*"
              element={<DeliveryRouter />}
            />

            {/* User Module - Explicitly mapped to /user and the catch-all for /food/ and / */}
            {/* NOTE: /user/food is a common mis-navigation - redirect to correct /food/user home */}
            <Route path="user/food" element={<Navigate to="/food/user" replace />} />
            <Route
              path="user/*"
              element={<UserRouter />}
            />

            {/* Make UserRouter the default for all other paths to handle / and /food/ as user home */}
            <Route path="/*" element={<UserRouter />} />
          </Routes>
        </Suspense>
      </>
    </AuthInitializer>
  )
}
