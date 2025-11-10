import { useState } from "react"
import { Box, Button, HStack, Text } from "@chakra-ui/react"
import { toaster } from "../ui/toaster"
import BillingApi from "../../api/BillingApi"

export default function PaymentMethodCard() {
  const [loading, setLoading] = useState(false)

  async function openPortal() {
    setLoading(true)
    try {
      const resp = await BillingApi.getPortal()
      const url = resp?.url || resp
      if (url) window.location.assign(url)
      else toaster.error({ title: "No se recibió URL de portal/tokenización" })
    } catch {
      toaster.error({ title: "No se pudo abrir el portal de pago" })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box borderWidth="1px" borderRadius="xl" p="6" bg="bg">
      <HStack justify="space-between">
        <Text>Método de pago actual</Text>
        <Button onClick={openPortal} loading={loading} colorPalette="blue">
          Actualizar método de pago
        </Button>
      </HStack>
    </Box>
  )
}
