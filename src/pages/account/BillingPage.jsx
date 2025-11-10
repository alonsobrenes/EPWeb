// src/pages/account/BillingPage.jsx
import { useEffect, useState } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { Heading, Tabs, Box, Separator, VStack, Text } from "@chakra-ui/react"
// import RequireAuth from "../../auth/RequireAuth"
import { toaster } from "../../components/ui/toaster"
// import { useAuth } from "../../auth/AuthProvider"
// import { getCurrentUser } from "../../auth/session"
import BillingProfileForm from "../../components/billing/BillingProfileForm"
import PlanPicker from "../../components/billing/PlanPicker"
import PaymentMethodTab from "../../components/billing/PaymentMethodTab"
import PaymentsTab from "../../components/billing/PaymentsTab"


export default function BillingPage() {
  // pestaña inicial: Perfil (form)
  const location = useLocation()
  const nav = useNavigate()
  const { search } = useLocation()
  const [tabValue, setTabValue] = useState("profile")
  const [refreshPaymentNonce, setRefreshPaymentNonce] = useState(0)
  const pmPrefetch = location.state?.pmPrefetch ?? null
  const ts = location.state?.ts ?? 0

  useEffect(() => {
    const sp = new URLSearchParams(location.search)
    const tab = sp.get("tab") || ""
    const refresh = sp.get("refresh") || ""

    if (tab === "payment" && refresh != null) {
      setRefreshPaymentNonce(n => n + 1)
      sp.delete("refresh")
      nav({ search: `?${sp.toString()}` }, { replace: true })

      if (tabValue !== "payment") setTabValue("payment")
    }
  }, [location.search])

  useEffect(() => {
    // 1) Si viene con ?tab=... en la URL, respétalo
    const params = new URLSearchParams(search)
    const tab = params.get("tab")
    if (tab) {
      // setTabValue(tab) // ya tienes este estado
      // Limpia la query para no “pegarse”
      params.delete("tab")
      setTabValue(tab)
      //nav({ search: params.toString() ? `?${params.toString()}` : "" }, { replace: true })
    }

    // 2) Lee el flag de retorno (si existe)
    const raw = sessionStorage.getItem("billing:return")
    if (raw) {
      sessionStorage.removeItem("billing:return")
      try {
        const data = JSON.parse(raw)
        if (data?.status === "success") {
          // setTabValue("history") // si quieres forzar la pestaña
          toaster.success({ title: "Pago aplicado", description: data.plan ? `Plan: ${data.plan}` : undefined })
        } else if (data?.status === "cancel") {
          toaster.warning({ title: "Pago cancelado" })
        } else if (data?.error) {
          toaster.error({ title: "Error de pago", description: data.error })
        }
      } catch {
        // ignore parse
      }
    }
  }, [search, nav])

  useEffect(() => {
    if (location.state?.pmPrefetch) {
      nav(location.pathname + location.search, { replace: true, state: null })
    }
  }, [location.key])
  
  return (
    <Box px={{ base: 4, md: 8 }} py={{ base: 4, md: 6 }}>
      <Heading size="lg">Facturación</Heading>
      <Text color="fg.muted" mt="1">
        Administra tu suscripción, método de pago y comprobantes.
      </Text>

      <Separator my="4" />

      <Tabs.Root
        value={tabValue}
        onValueChange={(e)=>{ setTabValue(e.value) }}
        variant="line" // opcional
      >
        <Tabs.List>
          <Tabs.Trigger value="profile">Perfil de Facturación</Tabs.Trigger>
          <Tabs.Trigger value="payment">Método de Pago</Tabs.Trigger>
          <Tabs.Trigger value="plans">Plan y Addons</Tabs.Trigger>
          <Tabs.Trigger value="history">Historial</Tabs.Trigger>
        </Tabs.List>

        <Separator my="4" />

        <Tabs.Content value="profile">
          <VStack align="stretch" gap="4">
            <BillingProfileForm />
          </VStack>
        </Tabs.Content>

        <Tabs.Content value="payment" key={`payment-${ts}`}>
          <VStack align="stretch" gap="4">
            <PaymentMethodTab  prefetch={pmPrefetch}/>
          </VStack>
        </Tabs.Content>

        <Tabs.Content value="plans">
          <VStack align="stretch" gap="4">
            <PlanPicker />
            {/* Aquí luego colocamos AddonsPicker cuando esté listo */}
          </VStack>
        </Tabs.Content>

        <Tabs.Content value="history">
          <VStack align="stretch" gap="4">
            <PaymentsTab />
          </VStack>
        </Tabs.Content>
      </Tabs.Root>
    </Box>
  )
}
