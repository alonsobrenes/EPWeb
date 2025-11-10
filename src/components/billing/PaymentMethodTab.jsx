import { useEffect, useState } from "react"
import { Box, Button, Card, CardBody, CardHeader, Heading, HStack, Text, VStack, Badge, Spinner } from "@chakra-ui/react"
import { toaster } from "../ui/toaster"
import BillingApi from "../../api/BillingApi"

export default function PaymentMethodTab({ prefetch = null }) {
  const [fetching, setFetching] = useState(!prefetch)
  const [pm, setPm] = useState(prefetch ?? null)
  const [loading, setLoading] = useState(false)
  const [guardActive, setGuardActive] = useState(true)

  async function load() {
    setFetching(true)
    try {
        const res = await BillingApi.getPaymentMethod({ cacheBust: true })
        setPm(res ?? null)
      } catch {
        setPm(null)
      } finally {
        setFetching(false)
        setLoading(false)
      }
    }

    useEffect(() => {
      setGuardActive(true)
      const t = setTimeout(() => setGuardActive(false), 600) // 500–600ms
      // Siempre refrescamos al montar para asegurar consistencia
      load()
      return () => clearTimeout(t)
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // useEffect(() => {
    //   if (prefetch !== null) {
    //     setPm(prefetch)
    //     setLoading(false)
    //     setGuardActive(true)
    //     const t = setTimeout(() => setGuardActive(false), 600)
    //     return () => clearTimeout(t)
    //   }
    // }, [prefetch])

  async function handleAddOrUpdateCard() {
    setLoading(true)
    try {
      const returnUrl = `${window.location.origin}/account/billing/pm-return`
      const redirectUrl = await BillingApi.startPaymentMethodTokenization(returnUrl)
      if (typeof redirectUrl === "string" && redirectUrl.length > 0) {
        window.location.assign(redirectUrl)
      } else {
        toaster.error({ title: "No se recibió URL de tokenización" })
      }
    } catch {
      toaster.error({ title: "No se pudo iniciar la tokenización" })
    } finally {
      setLoading(false)
    }
  }

  const has = pm?.has === true

  if (loading) {
  return <Spinner />
  }
  if (!pm && guardActive) {
    return (
      <div style={{ padding: 12, opacity: 0.7 }}>
        Verificando método de pago…
      </div>
    )
  }
  if (!pm) {
    return <div style={{ padding: 12 }}>No tienes un método de pago registrado.</div>
  }
  return (
    <Card.Root>
      <Card.Header>
        <Heading size="md">Método de Pago</Heading>
      </Card.Header>

      <Card.Body>
        <VStack align="stretch" gap={4}>
          {fetching ? (
            <HStack>
              <Spinner />
              <Text>Cargando…</Text>
            </HStack>
          ) : has ? (
            <Box borderWidth="1px" borderRadius="lg" p="3">
              <HStack justify="space-between">
                <Text>
                  {pm.brand ? `${pm.brand} •••• ${pm.last4 ?? "****"}` : "Tarjeta registrada"}
                  {(pm.expMonth && pm.expYear) ? ` — ${pm.expMonth}/${pm.expYear}` : ""}
                </Text>
                <Badge colorPalette="green">Activo</Badge>
              </HStack>
            </Box>
          ) : (
            <Text>No tienes un método de pago registrado.</Text>
          )}

          <HStack>
            <Button onClick={handleAddOrUpdateCard} loading={loading} colorPalette="blue">
              {has ? "Actualizar tarjeta" : "Agregar tarjeta"}
            </Button>
          </HStack>
        </VStack>
      </Card.Body>
    </Card.Root>
  )
}