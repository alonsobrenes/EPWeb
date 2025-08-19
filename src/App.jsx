import React from "react"
import { useRoutes } from "react-router-dom"
import Dashboard from "./pages/Dashboard"
import Login from "./pages/Login"
import Signup from "./pages/Signup"

export default function App() {
  const element = useRoutes([
    { path: "/", element: <Dashboard /> },
    { path: "/login", element: <Login /> },
    { path: "/signup", element: <Signup /> },
  ])
  return element
}
