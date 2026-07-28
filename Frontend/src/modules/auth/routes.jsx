import { Routes, Route, Navigate } from "react-router-dom"
import { Suspense, lazy } from "react"
import Loader from "@food/components/Loader"

const Login = lazy(() => import("./pages/Login"))
const FoodPreference = lazy(() => import("./pages/FoodPreference"))
const Support = lazy(() => import("./pages/PublicSupport"))

export default function AuthRoutes() {
  return (
    <Suspense fallback={<Loader />}>
      <Routes>
        <Route path="login" element={<Login />} />
        <Route path="support" element={<Support />} />
        <Route path="portal" element={<FoodPreference />} />
        <Route path="food-preference" element={<FoodPreference />} />
        <Route path="*" element={<Navigate to="/user/auth/login" replace />} />
      </Routes>
    </Suspense>
  )
}
