import { Navigate, useLocation } from "react-router-dom"
import { useState, useEffect } from "react"
import { isModuleAuthenticated } from "@food/utils/auth"

export default function ProtectedRoute({ children }) {
  const location = useLocation()
  const [isAuthenticated, setIsAuthenticated] = useState(() => isModuleAuthenticated("admin"))

  useEffect(() => {
    // Re-check auth whenever an auth-related event fires (session expiry, logout, login)
    const recheck = () => {
      setIsAuthenticated(isModuleAuthenticated("admin"))
    }

    window.addEventListener("adminAuthChanged", recheck)
    window.addEventListener("authRefreshFailed", recheck)
    window.addEventListener("userAuthChanged", recheck)

    return () => {
      window.removeEventListener("adminAuthChanged", recheck)
      window.removeEventListener("authRefreshFailed", recheck)
      window.removeEventListener("userAuthChanged", recheck)
    }
  }, [])

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" state={{ from: location.pathname }} replace />
  }

  return children
}
