// src/components/billing/QuotaStrip.jsx
import { useEffect, useMemo, useState } from 'react'
import { Box, HStack, VStack, Text, Badge } from '@chakra-ui/react'
import api from '../../api/client' // tu axios con baseURL al /api 
import { LuCircleAlert } from 'react-icons/lu'

/**
 * QuotaStrip: tira compacta de cuotas/entitlements visibles.
 * - Lee GET /billing/subscription y muestra: used/limit por feature.
 * - Soporta filtrar qué features mostrar con props.show = [codes...]
 * - Evita componentes problemáticos: usa sólo Box/HStack/VStack/Badge/Text.
 *
 * Ejemplo:
 *   <QuotaStrip show={['tests.auto.monthly', 'sacks.monthly', 'ai.credits.monthly', 'storage.gb']} />
 */

function useSubscription() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const resp = await api.get('/billing/subscription')
        if (!alive) return
        setData(resp?.data || null)
      } catch (e) {
        if (!alive) return
        setError(e?.response?.data?.message || e?.message || 'Error')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [])

  return { data, error, loading }
}

function humanBytes(n) {
  if (!Number.isFinite(n)) return '—'
  const u = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0, v = n
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++ }
  const decimals = (v >= 10 || i === 0) ? 0 : 1
  return `${v.toFixed(decimals)} ${u[i]}`
}

function EntitlementPill({ label, used, limit, isStorage, tone, hint }) {
  const text = isStorage
    ? (limit != null ? `límite ${limit}` : 'límite —')
    : `${used ?? 0}/${limit ?? '—'}`
  return (
        <HStack gap="1.5" borderWidth="1px" borderRadius="md" px="2" py="1" bg="bg.subtle">
      {/* Ícono de alerta cuando hay tono (orange/red) */}
      {tone ? (
        <Box color={tone === 'red' ? 'red.600' : 'orange.600'} display="inline-flex" alignItems="center">
          <LuCircleAlert size={16} />
        </Box>
      ) : null}
      <Badge variant={tone ? "solid" : "subtle"} colorPalette={tone || undefined}>{label}</Badge>
      <Text fontSize="sm" color="fg.muted">{text}</Text>
      {hint ? <Text fontSize="xs" color={tone ? `${tone}.600` : "fg.muted"}>· {hint}</Text> : null}
    </HStack>

  )
}

export default function QuotaStrip({ show, mb = '3', showHints = false }) {
  const { data, error } = useSubscription()

  // Normaliza a diccionario: feature_code -> { limit, used, remaining }
  const byFeature = useMemo(() => {
    const map = new Map()
    const arr = Array.isArray(data?.entitlements) ? data.entitlements : []
    for (const e of arr) {
      const feature = e.feature ?? e.feature_code ?? ''
      map.set(feature, {
        limit: e.limit,
        used: e.used ?? null,
        remaining: e.remaining ?? null,
      })
    }
    return map
  }, [data])

  // Mapeo de etiquetas legibles
  const LABELS = {
    'tests.auto.monthly': 'Tests automáticos',
    'sacks.monthly': 'SACKS',
    'ai.credits.monthly': 'Créditos IA',
    'storage.gb': 'Almacenamiento',
  }

  // Orden sugerido (si no se pasa show)
  const ORDER = ['tests.auto.monthly', 'sacks.monthly', 'ai.credits.monthly', 'storage.gb']

  const features = Array.isArray(show) && show.length > 0 ? show : ORDER

  // Render
  if (error) {
    // Por UX no “gritamos” errores de cuota aquí; el resto de la UI/Paywall ya maneja 402.
    return null
  }

  return (
    <Box mb={mb}>
      <HStack gap="2" wrap="wrap">
        {features.map((f) => {
          const ent = byFeature.get(f)
          if (!ent) {
            // Si aún no hay entitlements para ese feature, lo mostramos “—” sin romper.
            if (f === 'storage.gb') {
              return <EntitlementPill key={f} label={LABELS[f] || f} isStorage used={null} limit={null} />
            }
            return <EntitlementPill key={f} label={LABELS[f] || f} used={0} limit={null} />
          }

          // Caso especial storage.gb: el límite viene en GB; mostramos “límite X GB”.
          if (f === 'storage.gb') {
            const gb = Number(ent.limit)
            const labelLimit = Number.isFinite(gb) ? `${gb} GB` : '—'
            return <EntitlementPill key={f} label={LABELS[f] || f} isStorage limit={labelLimit} />
          }

          // Mensuales: used/limit
          const used = Number.isFinite(ent.used) ? ent.used : 0
          const limit = Number.isFinite(ent.limit) ? ent.limit : null
          const remaining = Number.isFinite(ent.remaining) ? ent.remaining : (limit != null ? (limit - used) : null)
          // Thresholds:
          // - remaining <= 0  => rojo (agotado)
          // - remaining <= 2  => naranja (cerca del límite)
          let tone = undefined
          let hint = undefined
          if (Number.isFinite(remaining)) {
            if (remaining <= 0) tone = "red"
            else if (remaining <= 2) tone = "orange"
            if (showHints) {
              if (remaining <= 0) {
                hint = "Sin usos disponibles este mes."
              } else if (remaining === 1) {
                hint = "Te queda 1 uso este mes."
              } else if (remaining === 2) {
                hint = "Te quedan 2 usos este mes."
              }
            }
          }
          //return <EntitlementPill key={f} label={LABELS[f] || f} used={used} limit={limit} tone={tone} />
          return <EntitlementPill key={f} label={LABELS[f] || f} used={used} limit={limit} tone={tone} hint={hint} />
        })}
      </HStack>
    </Box>
  )
}
