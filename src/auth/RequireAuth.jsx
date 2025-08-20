// src/auth/RequireAuth.jsx
import { Navigate, Outlet, useLocation } from "react-router-dom"
import { AUTH_TOKEN_KEY } from './constants'

export default function RequireAuth() {
  const raw = localStorage.getItem(AUTH_TOKEN_KEY)
  const hasToken = !!(raw && raw !== "null" && raw !== "undefined")
  const location = useLocation()

  if (!hasToken) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }
  return <Outlet />
}
