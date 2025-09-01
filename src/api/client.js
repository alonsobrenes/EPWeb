// src/lib/client.js
import axios from "axios"
import { AUTH_TOKEN_KEY } from "../auth/constants"

// Normaliza el baseURL (sin slash final)
const RAW_BASE = import.meta.env.VITE_API_BASE || ""
const BASE_URL = RAW_BASE.replace(/\/+$/, "")

if (!BASE_URL) {
  console.warn("VITE_API_BASE no está definido. Configúralo en .env (ej: VITE_API_BASE=https://localhost:53793/api)")
}

const api = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
  // timeout: 15000, // opcional
})

// Adjunta el Bearer token si existe
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(AUTH_TOKEN_KEY)
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error?.response?.status
    const url = error?.config?.url || ""
    const isAuthRoute = /\/Auth\/(login|signup)$/i.test(url)

    if (status === 401 && !isAuthRoute) {
      try { localStorage.removeItem(AUTH_TOKEN_KEY) } catch {}
      if (!window.location.pathname.startsWith("/login")) {
        window.location.href = "/login"
      }
    } else if (status === 403) {
      // Deja que el shell muestre un toast y/o redireccione si quieres
      try { window.dispatchEvent(new CustomEvent("ep:forbidden", { detail: { url } })) } catch {}
    } else if (!error?.response) {
      // Error de red / CORS / servidor caído
      try { window.dispatchEvent(new CustomEvent("ep:network-error")) } catch {}
    }

    return Promise.reject(error)
  }
)

export default api
export const API_BASE_URL = BASE_URL
export function apiOrigin() {
  try {
    const u = new URL(BASE_URL)
    return `${u.protocol}//${u.host}${u.pathname.replace(/\/api\/?$/,'')}`
  } catch { return "" }
}
