import { Navigate, useLocation } from "react-router-dom"
import { isModuleAuthenticated } from "@food/utils/auth"
import { getAccessToken, getRefreshToken, hasStoredSession } from "@/core/auth/tokenStore"

export default function ProtectedRoute({ children }) {
  const location = useLocation()
  const isAuthenticated = isModuleAuthenticated("delivery")
  const accessToken = getAccessToken("delivery")
  const refreshToken = getRefreshToken("delivery")
  const hasSession = hasStoredSession("delivery")

  console.log("[DeliveryAuthDebug] ProtectedRoute check", {
    path: location.pathname,
    isAuthenticated,
    hasSession,
    accessTokenPresent: Boolean(accessToken),
    refreshTokenPresent: Boolean(refreshToken),
    accessTokenPreview: accessToken ? `${String(accessToken).slice(0, 12)}...` : null,
  })

  if (!isAuthenticated) {
    return <Navigate to="/food/delivery/login" state={{ from: location.pathname }} replace />
  }

  return children
}
