import { useEffect, useMemo, useState, useRef } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { Card, CardBody, CardHeader, Heading, Text, VStack, Button,Box, Spinner } from "@chakra-ui/react"
import { toaster } from '../../components/ui/toaster'
import BillingApi from "../../api/BillingApi"


export default function PmReturnPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)
  const handledRef = useRef(null)

  const sp = useMemo(() => new URLSearchParams(location.search), [location.search])

  // Callback real de TiloPay
  const token    = sp.get("token") || ""
  const code     = sp.get("code") || ""          // "1" = aprobado
  const tokenize = sp.get("tokenize") || ""      // "1" = tokenización
  const brand    = sp.get("brand") || ""         // ej. "visa"
  const last4    = (sp.get("last-digits") || "").slice(-4)
  let pm = null 
  // Éxito TiloPay
  const ok = token && code === "1" && tokenize === "1"

  // Navegación correcta (ruta protegida bajo /app)
  const goBilling = (pm = null) => navigate("/app/account/billing?tab=payment&refresh=1", { replace: true, state: { pmPrefetch: pm, ts: Date.now() } })

  useEffect(() => {
    if (!ok) return

    const ssKey = `pm-finalized:${token}`

    // Evitar doble ejecución por StrictMode / re-renders
    if (handledRef.current === token) return
    handledRef.current = token

    // Si ya se procesó en esta sesión: ir directo a la página protegida
    if (sessionStorage.getItem(ssKey) === "1") {
      try { sessionStorage.removeItem(ssKey) } catch {}
      navigate("/app/account/billing?tab=payment", {
            replace: true,
            state: { pmPrefetch: pm, ts: Date.now() } // ts para remount
        })
      return
    }

    let aborted = false

    ;(async () => {
      setSaving(true)
      try {
        // Marcar ANTES de llamar al backend: evita dobles toasters si el usuario recarga rápido
        sessionStorage.setItem(ssKey, "1")
        const  pm = await BillingApi.finalizePaymentMethodTokenization({
          providerPmId: token,
          brand: brand || null,
          last4: last4 || null,
          expMonth: null,
          expYear: null,
          rawPayload: location.search,
        })

        toaster.success({ title: "Método de pago actualizado" })

        navigate("/app/account/billing?tab=payment", {
            replace: true,
            state: { pmPrefetch: pm, ts: Date.now() } // ts para remount
        })

        return
      } catch {
        // En error, limpiar la marca para permitir reintento
        try {
            sessionStorage.removeItem(ssKey) 
        } catch {}
        toaster.error({ title: "No se pudo registrar el método de pago" })
      }
    })()

    return () => { aborted = true }
  }, [ok, token, brand, last4, location.search])

  // Estados UI
  if (!token) {
    return (
      <Box p={6}>
        <Heading size="md" mb={2}>Resultado método de pago</Heading>
        <Text>Falta el token de TiloPay en la URL.</Text>
        <Button mt={4} onClick={() => navigate("/app/account/billing?tab=payment")}>
          Volver a Facturación
        </Button>
      </Box>
    )
  }

  if (!ok) {
    return (
      <Box p={6}>
        <Heading size="md" mb={2}>Resultado método de pago</Heading>
        <Text>La tokenización fue cancelada o falló.</Text>
        <Button mt={4} onClick={() => navigate("/app/account/billing?tab=payment")}>
          Volver a Facturación
        </Button>
      </Box>
    )
  }

  // Estado intermedio (debería durar muy poco)
  return (
    <Box p={6}>
      <Heading size="md" mb={2}>Procesando método de pago…</Heading>
      <Text mb={4}>Guardando el método de pago en tu cuenta.</Text>
      <Spinner />
    </Box>
  )
}
