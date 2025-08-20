// src/App.jsx
import { useRoutes, Navigate } from "react-router-dom"
import RequireAuth from "./auth/RequireAuth"
import Dashboard from "./pages/Dashboard"
import LoginBlock from "./pages/LoginBlock"
import SignupBlock from "./pages/SignupBlock"
import Landing from "./pages/Landing"
import AppShellSidebarCollapsible from "./components/AppShellSidebarCollapsible"


export default function App() {
  return useRoutes([
    { path: "/", element: <Landing /> }, 
    {
      path: "/app",
      element: <RequireAuth />,
      children: [
        {
          element: <AppShellSidebarCollapsible />,
          children: [
            { index: true, element: <Dashboard /> },            // /app
            // { path: "pacientes", element: <Pacientes /> },
            // { path: "evaluaciones", element: <Evaluaciones /> },
            // { path: "reportes", element: <Reportes /> },
            // { path: "ajustes", element: <Ajustes /> },
          ],
        },
      ],
    },
    { path: "/login", element: <LoginBlock /> },
    { path: "/signup", element: <SignupBlock /> },
    { path: "*", element: <Navigate to="/" replace /> },
  ])
}