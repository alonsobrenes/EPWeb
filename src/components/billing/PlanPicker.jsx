// src/components/billing/PlanPicker.jsx
import { useEffect, useState } from "react"
import { Box, Button, Card, HStack, Spinner, Text, VStack } from "@chakra-ui/react"
import { toaster } from "../ui/toaster"
import BillingApi from "../../api/BillingApi"


export default function PlanPicker() {
  const [loading, setLoading] = useState(true)
  const [plans, setPlans] = useState([])
  const [selected, setSelected] = useState(null)
  const [checkingOut, setCheckingOut] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const res = await BillingApi.getPlans()
        // Tu /api/billing/plans devuelve un array simple
        const items = Array.isArray(res) ? res : Array.isArray(res?.items) ? res.items : []
        if (!cancelled) {
          setPlans(items)
          if (items.length > 0) {
            const first = items[0]
            setSelected(first.code ?? first.planCode ?? null)
          }
        }
      } catch {
        toaster.error({ title: "No se pudieron cargar los planes" })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  function valueOf(p) {
    return p.code ?? p.planCode
  }
  function labelOf(p) {
    return p.name ?? p.title ?? valueOf(p) ?? "Plan"
  }
  function priceOf(p) {
    // Tu esquema real usa monthlyUsd (número)
    if (typeof p.monthlyUsd === "number") return `USD ${p.monthlyUsd}`
    return p.priceFormatted ?? `${p.currency ?? "USD"} ${p.price ?? p.amount ?? ""}`
  }

  function selectPlan(val) {
    setSelected(val)
  }

  async function checkout() {
    if (!selected) {
      toaster.error({ title: "Selecciona un plan" }); return
    }
    setCheckingOut(true)
    try {
      const payload = {
        planCode: selected,
        addons: [],
        billTo: null,
        shipTo: null,
        returnUrl: `${window.location.origin}/account/billing/return`,
      }
      const resp = await BillingApi.createCheckout(payload)

       const url =
      resp?.checkoutUrl ??
      resp?.redirectUrl ??
      resp?.url ??
      (typeof resp === 'string' ? resp : null)

      if (typeof url === 'string' && url.length > 0) {
      window.location.assign(url)
    } else {
      toaster.error({ title: "No se recibió URL de checkout" })
    }
    } catch(err) {
        const status = err?.response?.status
        const data = err?.response?.data
        if (status === 409 && (data?.code === 'DOWNGRADE_BLOCKED' || data?.message)) {
          toaster.warning({
            title: "No es posible cambiar a 'Solo'",
            description: data?.message ?? "Hay más de un miembro activo en tu organización. Reduce a 1 para continuar.",
            duration: 8000,
          })
          // (Opcional) Si tienes orgKind !== 'solo', podrías navegar a profesionales:
          // navigate('/app/clinic/profesionales')
          return
        }
    } finally {
      setCheckingOut(false)
    }
  }

  return (
    <Box>
      {loading ? (
        <HStack><Spinner /><Text>Cargando planes…</Text></HStack>
      ) : (
        <VStack align="stretch" gap="4">
          {/* Grupo visual con comportamiento de radio */}
          <VStack
            align="stretch"
            gap="3"
            role="radiogroup"
            aria-label="Selecciona un plan"
          >
            {plans.map((p) => {
              const val = valueOf(p)
              const isSelected = String(selected) === String(val)
              return (
                <Card.Root
                  key={val}
                  role="radio"
                  aria-checked={isSelected}
                  tabIndex={0}
                  onClick={() => selectPlan(val)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") selectPlan(val)
                  }}
                  borderWidth={isSelected ? "2px" : "1px"}
                  borderColor={isSelected ? "blue.500" : "border"}
                  bg={isSelected ? "blue.50" : "bg"}
                  _dark={{
                    bg: isSelected ? "blue.900" : "gray.800",
                    borderColor: isSelected ? "blue.400" : "gray.700",
                  }}
                  cursor="pointer"
                >
                  <Card.Body>
                    <HStack justify="space-between" align="start">
                      <VStack align="start" gap="1">
                        <Text fontWeight="semibold">{labelOf(p)}</Text>
                        {p.features?.length > 0 && (
                          <Text color="fg.muted" fontSize="sm">
                            {p.features.join(" • ")}
                          </Text>
                        )}
                      </VStack>
                      <Text fontWeight="bold">{priceOf(p)}</Text>
                    </HStack>
                  </Card.Body>
                </Card.Root>
              )
            })}
          </VStack>

          <HStack justify="flex-end">
            <Button onClick={checkout} loading={checkingOut} colorPalette="blue">
              Confirmar y Pagar
            </Button>
          </HStack>
        </VStack>
      )}
    </Box>
  )
}
