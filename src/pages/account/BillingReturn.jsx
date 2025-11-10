// src/pages/account/BillingReturn.jsx
import { useEffect } from "react"
import { useLocation, useNavigate } from "react-router-dom"

export default function BillingReturn() {
  const nav = useNavigate()
  const { search } = useLocation()

  useEffect(() => {
    const params = new URLSearchParams(search)
    const status = (params.get("status") || "").toLowerCase()
    const plan = params.get("planCode") || params.get("plan") || null
    const error = params.get("error") || null

    // Guarda un “flag” para que BillingPage muestre toaster/seleccione tab
    sessionStorage.setItem("billing:return", JSON.stringify({
      ts: Date.now(),
      status,
      plan,
      error,
    }))

    // Redirige al dashboard de billing; puedes forzar tab=history en success
    const next = status === "success"
      ? "/app/account/billing?tab=history"
      : "/app/account/billing"
    nav(next, { replace: true })
  }, [search, nav])

  // Render mínimo mientras redirige
  return (
    <div style={{ padding: 24 }}>
      Procesando retorno de pago…
    </div>
  )
}
