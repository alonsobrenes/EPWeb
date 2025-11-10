// src/components/billing/BillingHistoryTable.jsx
import { useEffect, useState } from "react"
import { Box, Spinner, Text, VStack } from "@chakra-ui/react"
import { toaster } from "../ui/toaster"
import BillingApi from "../../api/BillingApi"

function fmtMoney(amountCents, currency = "USD") {
  const v = (amountCents ?? 0) / 100
  try {
    return new Intl.NumberFormat("es-CR", { style: "currency", currency }).format(v)
  } catch {
    return `${currency} ${v.toFixed(2)}`
  }
}

function fmtDate(iso) {
  try {
    const d = new Date(iso)
    return d.toLocaleString()
  } catch { return iso }
}

function StatusBadge({ status }) {
  const s = (status || "").toLowerCase()
  const style = {
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: 12,
    fontSize: 12,
    border: "1px solid var(--chakra-colors-border)",
    background: s === "succeeded" ? "var(--chakra-colors-green-50)"
      : s === "failed" ? "var(--chakra-colors-red-50)"
      : "var(--chakra-colors-gray-50)"
  }
  return <span style={style}>{status}</span>
}

export default function PaymentsTab() {
  const [items, setItems] = useState(null)   // null => loading
  const [error, setError] = useState(null)
  const [subscription, setSubscription] = useState(null)

  useEffect(() => {
    let alive = true
    async function load() {
      try {
        const sub = await BillingApi.getSubscription()
        const list = await BillingApi.getPayments(50)
        if (alive){
            setSubscription(sub ?? null)
            setItems(list)
        }
      } catch (e) {
        if (alive) { setError("No se pudo cargar el historial"); setItems([]) }
      }
    }
    load()
    return () => { alive = false }
  }, [])

  if (items === null) {
    return <div style={{ padding: 12 }}>Cargando historial…</div>
  }
  if (error) {
    return <div style={{ padding: 12, color: "var(--chakra-colors-red-500)" }}>{error}</div>
  }
  if (items.length === 0) {
    return <div style={{ padding: 12 }}>Aún no hay pagos registrados.</div>
  }

  console.log(items)
  return (
    <>
    <Box borderWidth="1px" borderRadius="lg" p="4">
                <Text fontWeight="medium">Suscripción actual</Text>
                <Text color="fg.muted" mt="1">
                  {subscription
                    ? `${subscription.planCode} • ${subscription.status} • ${subscription.periodStartUtc} → ${subscription.periodEndUtc}`
                    : "—"}
                </Text>
              </Box>
    <div style={{ padding: 12, overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid var(--chakra-colors-border)" }}>
            <th style={{ padding: "8px 6px" }}>Fecha</th>
            <th style={{ padding: "8px 6px" }}>Monto</th>
            <th style={{ padding: "8px 6px" }}>Moneda</th>
            <th style={{ padding: "8px 6px" }}>Estado</th>
            <th style={{ padding: "8px 6px" }}>Order #</th>
            <th style={{ padding: "8px 6px" }}>Provider</th>
            <th style={{ padding: "8px 6px" }}>Ref. Pago</th>
            <th style={{ padding: "8px 6px" }}>Error</th>
          </tr>
        </thead>
        <tbody>
          {items.map((p) => (
            <tr key={p.id} style={{ borderBottom: "1px solid var(--chakra-colors-border)" }}>
              <td style={{ padding: "8px 6px", whiteSpace: "nowrap" }}>{fmtDate(p.createdAtUtc || p.created_at_utc)}</td>
              <td style={{ padding: "8px 6px" }}>{fmtMoney(p.amountCents ?? p.amount_cents, p.currencyIso ?? p.currency_iso)}</td>
              <td style={{ padding: "8px 6px" }}>{p.currencyIso ?? p.currency_iso}</td>
              <td style={{ padding: "8px 6px" }}><StatusBadge status={p.status} /></td>
              <td style={{ padding: "8px 6px" }}>{p.orderNumber ?? p.order_number ?? "—"}</td>
              <td style={{ padding: "8px 6px" }}>{p.provider}</td>
              <td style={{ padding: "8px 6px" }}>{p.providerPaymentId ?? p.provider_payment_id ?? "—"}</td>
              <td style={{ padding: "8px 6px", color: "var(--chakra-colors-red-500)" }}>{p.errorCode ?? p.error_code ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </>
  )
}
