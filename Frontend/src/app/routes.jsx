// Routing file
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Suspense, lazy, useEffect } from 'react'
import { clearModuleAuth } from '@food/utils/auth'
import { AppShellSkeleton } from '@food/components/ui/loading-skeletons'

const NATIVE_LAST_ROUTE_KEY = 'native_last_route'

// Lazy load the Food service module (Quick-spicy app)
const FoodApp = lazy(() => import('../modules/Food/routes'))
const AuthApp = lazy(() => import('../modules/auth/routes'))
import ProtectedRoute from '@food/components/ProtectedRoute'

const PageLoader = () => {
  if (typeof window !== 'undefined') {
    const path = window.location.pathname.toLowerCase()
    if (
      path.includes('/terms') ||
      path.includes('/privacy') ||
      path.includes('/support')
    ) {
      return null
    }
  }
  return <AppShellSkeleton />
}

/**
 * FoodAppWrapper — Quick-spicy App. को /food prefix के साथ render करता है.
 * 
 * Quick-spicy की App.jsx में routes /restaurant, /usermain, /admin, /delivery
 * जैसे hain (bina /food prefix ke). Yahan hum useLocation se /food ke baad wala
 * path nikalne ke baad FoodApp render karte hain. FoodApp internally BrowserRouter
 * nahi use karta (sirf Routes use karta hai), isliye ye directly kaam karta hai.
 */
const FoodAppWrapper = () => {
  return (
    <Suspense fallback={<PageLoader />}>
      <FoodApp />
    </Suspense>
  )
}

const RedirectToFood = () => {
  const location = useLocation();
  // We safely replace the exact current pathname with a /food prefixed pathname
  // This effectively catches programmatic navigation to absolute paths like '/restaurant/login'
  // and turns them into '/food/restaurant/login'
  return <Navigate to={`/food${location.pathname}${location.search}`} replace />;
};

const AdminRouter = lazy(() => import('../modules/Food/components/admin/AdminRouter'))

/**
 * AdminAuthRecovery — listens for session expiry events emitted by the axios
 * interceptor (authRefreshFailed / userAuthChanged with authenticated:false)
 * and redirects the admin to the login page automatically.
 */
function AdminAuthRecovery() {
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    const isAdminAuthRoute = (pathname) => {
      const path = String(pathname || '')
      return (
        path === '/admin/login' ||
        path === '/admin/signup' ||
        path === '/admin/forgot-password'
      )
    }

    const handleAdminSessionExpired = (event) => {
      const moduleName = event?.detail?.module
      // Only act on admin module events
      if (moduleName && moduleName !== 'admin') return
      // Only act on sign-out events, not sign-in events
      if (event?.type === 'userAuthChanged' && event?.detail?.authenticated !== false) return

      const currentPath = String(window.location?.pathname || location.pathname || '')
      // Only redirect if we are currently on an admin page
      if (!currentPath.startsWith('/admin')) return
      // Don't redirect if already on an auth page
      if (isAdminAuthRoute(currentPath)) return

      // Clear any stale local session data for admin
      try { clearModuleAuth('admin') } catch { /* ignore */ }

      navigate('/admin/login', {
        replace: true,
        state: { reason: 'session_expired', from: currentPath },
      })
    }

    window.addEventListener('authRefreshFailed', handleAdminSessionExpired)
    window.addEventListener('userAuthChanged', handleAdminSessionExpired)

    return () => {
      window.removeEventListener('authRefreshFailed', handleAdminSessionExpired)
      window.removeEventListener('userAuthChanged', handleAdminSessionExpired)
    }
  }, [location.pathname, navigate])

  return null
}

const AppRoutes = () => {
  const location = useLocation()

  useEffect(() => {
    if (typeof window === 'undefined') return

    const protocol = String(window.location?.protocol || '').toLowerCase()
    const userAgent = String(window.navigator?.userAgent || '').toLowerCase()
    const isNativeLikeShell =
      Boolean(window.flutter_inappwebview) ||
      Boolean(window.ReactNativeWebView) ||
      protocol === 'file:' ||
      userAgent.includes(' wv') ||
      userAgent.includes('; wv')

    if (!isNativeLikeShell) return

    const route = `${location.pathname || ''}${location.search || ''}`
    if (route.startsWith('/food/') || route.startsWith('/admin')) {
      localStorage.setItem(NATIVE_LAST_ROUTE_KEY, route)
    }
  }, [location.pathname, location.search])

  return (
    <>
      {/* Global session-expiry listener for the admin portal */}
      <AdminAuthRecovery />
      <Routes>
        {/* Auth Module */}
        <Route path="/user/auth/*" element={<AuthApp />} />
        <Route path="/delivery/auth/*" element={<AuthApp />} />
        <Route path="/restaurant/auth/*" element={<AuthApp />} />

        {/* Food Module - Handle both /food and root / for the user app */}
        <Route path="/food/*" element={<FoodAppWrapper />} />

        {/* Global Admin Portal - AdminRouter handles its own protection for sub-routes */}
        <Route path="/admin/*" element={<AdminRouter />} />

        {/* Root and other user-facing paths open the food user app. */}
        <Route path="/*" element={<FoodAppWrapper />} />
      </Routes>
    </>
  )
}

export default AppRoutes
