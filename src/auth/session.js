// src/auth/session.js
import { AUTH_TOKEN_KEY } from './constants'

export function getToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY) || null
}

// Intenta extraer roles desde varias formas comunes (string, array, o claims .NET)
function extractRolesFromPayload(payload = {}) {
  const out = new Set()

  const candidates = [
    payload.role,
    payload.roles,
    payload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'],
    payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/role'],
  ]

  for (const v of candidates) {
    if (!v) continue
    if (Array.isArray(v)) {
      for (const s of v) out.add(String(s).trim().toLowerCase())
    } else if (typeof v === 'string') {
      // soporta "admin", "Admin", "admin,editor", "admin editor"
      for (const s of v.split(/[,\s]+/)) {
        if (s) out.add(s.trim().toLowerCase())
      }
    }
  }

  return Array.from(out)
}

export function getCurrentUser() {
  const token = getToken()
  if (!token) return null
  try {
    const base64 = token.split('.')[1] || ''
    const json = atob(base64.replace(/-/g, '+').replace(/_/g, '/'))
    const payload = JSON.parse(json)

    const roles = extractRolesFromPayload(payload)
    const role = roles[0] || (payload.role ? String(payload.role).toLowerCase() : undefined)

    return {
      id: payload.sub ?? payload.nameid ?? payload.userid,
      email: payload.email ?? payload.unique_name ?? payload.upn,
      role,            // string normalizada (si existe)
      roles,           // array normalizada
      raw: payload,    // por si necesitas inspección
    }
  } catch {
    return null
  }
}

export function hasRole(user, required = []) {
  if (!user) return false
  const have = new Set(
    (user.roles && user.roles.length ? user.roles : (user.role ? [user.role] : []))
      .map((r) => String(r).toLowerCase())
  )
  return required.some((r) => have.has(String(r).toLowerCase()))
}
