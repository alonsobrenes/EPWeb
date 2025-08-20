import axios from "axios"
import { AUTH_TOKEN_KEY } from "../auth/constants"

// Normaliza el baseURL (sin slash final)
const RAW_BASE = import.meta.env.VITE_API_BASE || ""
const BASE_URL = RAW_BASE.replace(/\/+$/, "")

if (!BASE_URL) {
  // Útil en dev si olvidamos el .env
  console.warn("VITE_API_BASE no está definido. Configúralo en .env (ej: VITE_API_BASE=https://localhost:53793/api)")
}

const api = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
  // withCredentials: true, // <- solo si usas cookies/sesión
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
    const isAuthRoute = /\/Auth\/(login|signup)$/i.test(error?.config?.url || "")
    if (status === 401 && !isAuthRoute) {
      localStorage.removeItem(AUTH_TOKEN_KEY)
      if (!window.location.pathname.startsWith("/login")) {
        window.location.href = "/login"
      }
    }
    return Promise.reject(error)
  }
)

export default api
