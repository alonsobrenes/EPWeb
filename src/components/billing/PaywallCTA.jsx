// src/components/billing/PaywallCTA.jsx
import { Card, VStack, Text, HStack, Button } from "@chakra-ui/react"
import { useNavigate } from "react-router-dom"

/**
 * Bloque de “Upsell” / Paywall con acciones claras.
 *
 * Props:
 *  - message?: string          // Mensaje principal (por defecto uno amigable)
 *  - showManage?: boolean      // Mostrar botón "Gestionar suscripción"
 *  - onAfterClick?: () => void // (opcional) callback tras click
 *
 * Uso:
 *   <PaywallCTA />
 *   <PaywallCTA message="Tu período de prueba expiró…" showManage />
 */
export default function PaywallCTA({ message, showManage = false, onAfterClick }) {
  const navigate = useNavigate()
  const msg = message || "Tu período de prueba expiró o alcanzaste el límite del plan."

  function goPricing() {
    navigate("/pricing")
    onAfterClick?.()
  }

  function goBilling() {
    // Si tienes portal real, redirígelo allí. Por ahora al perfil/billing.
    navigate("/account/billing")
    onAfterClick?.()
  }

  return (
    <Card.Root p="12px" borderWidth="1px" bg="orange.50">
        <HStack justify="space-between" align="center">
            <Text>{msg}</Text>
          <Button onClick={goPricing} colorPalette="brand">Elegir plan</Button>
          {showManage && (
            <Button variant="outline" onClick={goBilling}>Gestionar suscripción</Button>
          )}
        </HStack>
    </Card.Root>
  )
}

