// src/auth/RequireAuth.jsx
import { Navigate, useLocation } from "react-router-dom"
import { getCurrentUser } from "./session"

export default function RequireAuth({ children, allowedRoles }) {
  const user = getCurrentUser()
  const location = useLocation()

  // No autenticado
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  // Si no se pide rol específico, pasa cualquiera autenticado
  if (!allowedRoles || allowedRoles.length === 0) {
    return children
  }

  // Normalizar a lowercase
  const wanted = new Set(allowedRoles.map(r => String(r).toLowerCase()))
  const userRoles = []
  if (user.role) userRoles.push(String(user.role).toLowerCase())
  if (Array.isArray(user.roles)) {
    for (const r of user.roles) userRoles.push(String(r).toLowerCase())
  }

  const ok = userRoles.some(r => wanted.has(r))
  if (!ok) {
    // Importante: no mandes a "/", usa 403
    return <Navigate to="/403" replace />
  }

  return children
}
