// src/auth/role.js
import { getCurrentUser } from "./session"

function decodeJwtPayload() {
  try {
    const raw =
      localStorage.getItem("authToken") ||
      sessionStorage.getItem("authToken") ||
      localStorage.getItem("token") ||
      sessionStorage.getItem("token") ||
      ""

    const token = raw.startsWith("Bearer ") ? raw.slice(7) : raw
    const [, payload] = token.split(".")
    if (!payload) return {}

    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"))
    return JSON.parse(json)
  } catch {
    return {}
  }
}

function deriveRoleFromPayload(payload) {
  return (
    payload["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"] ||
    payload.role ||
    null
  )
}

export function getRole() {
  let currentUser = null
  try {
    currentUser = getCurrentUser()
  } catch {
    currentUser = null
  }

  const payload = decodeJwtPayload()
  const roleRaw =
    (currentUser && currentUser.role) ||
    deriveRoleFromPayload(payload) ||
    ""

  return String(roleRaw || "").toLowerCase()
}
