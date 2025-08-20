import React, { createContext, useContext, useState } from "react"
import { AUTH_TOKEN_KEY } from './constants'
const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(AUTH_TOKEN_KEY))

  const login = (jwt) => {
    setToken(jwt)
    localStorage.setItem(AUTH_TOKEN_KEY, jwt)
  }

  const logout = () => {
    setToken(null)
    localStorage.removeItem(AUTH_TOKEN_KEY)
  }

  return (
    <AuthContext.Provider value={{ token, isAuthenticated: !!token, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
