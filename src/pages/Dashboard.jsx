// src/pages/Dashboard.jsx
import React, { useEffect, useState, useMemo } from "react"
import {
  Box,
  Heading,
  SimpleGrid,
  HStack,
  VStack,
  Text,
  Icon,
  Spinner,
  Button,
  Card,
  Input,
} from "@chakra-ui/react"
import { useNavigate } from "react-router-dom"
import client from "../api/client"
import { TestsApi } from "../api/testsApi"
import { PatientsApi } from "../api/patientsApi"
import { generatePatientsByPeriodPdf } from "../reports/generatePatientsByPeriodPdf"
import { toaster } from "../components/ui/toaster"
import { useOrgKind } from "../context/OrgContext"
import { getRole } from "../auth/role"
import {
  LuClipboardList,
  LuUsers,
  LuActivity,
  LuChevronRight,
} from "react-icons/lu"
import { getCurrentUser } from "../auth/session"
import {
  ResponsiveContainer,
  LineChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Line,
} from "recharts"
// -----------------------------
// Helpers de auth / rol / org
// -----------------------------

function decodeJwtPayload() {
  try {
    const raw =
      localStorage.getItem("authToken") ||
      sessionStorage.getItem("authToken") ||
      localStorage.getItem("token") ||
      sessionStorage.getItem("token") ||
      ""
    const token = raw.startsWith("Bearer ") ? raw.slice(7) : raw
    const [, payload] = token.split(".")
    if (!payload) return {}
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"))
    return JSON.parse(json)
  } catch {
    return {}
  }
}

// Igual que en AppShellSidebarCollapsible
function deriveRoleFromPayload(p) {
  return (
    p["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"] ||
    p.role ||
    null
  )
}

/**
 * Obtiene role ('admin' | 'editor' | 'viewer') y orgKind ('solo' | 'clinic' | 'hospital' | null)
 * combinando currentUser + payload del JWT.
 */
function getRoleAndOrgKind() {
  let currentUser = null
  try {
    currentUser = getCurrentUser()
  } catch {
    currentUser = null
  }

  const payload = decodeJwtPayload()

  const roleRaw =
    (currentUser && currentUser.role) || deriveRoleFromPayload(payload) || ""
  const orgKindRaw =
    (currentUser && currentUser.orgKind) ||
    payload.orgKind ||
    payload.org_kind ||
    ""

  const role = String(roleRaw || "").toLowerCase()
  const orgKind = useOrgKind()

  return { role, orgKind }
}

// -----------------------------
// Hook de datos para clínico
// (dashboard actual)
// -----------------------------

function useClinicianDashboardData() {
  const [loading, setLoading] = useState(true)
  const [counts, setCounts] = useState({
    tests: 0,
    patients: 0,
    weeklyRuns: 0,
  })
  const [recentPatients, setRecentPatients] = useState([])
  const [topTests, setTopTests] = useState([])

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        // 1) Tests disponibles
        let testsTotal = 0
        try {
          const data = await TestsApi.forMe({ page: 1, pageSize: 1 })
          testsTotal = data?.total ?? 0
        } catch {
          try {
            const data = await TestsApi.list({ page: 1, pageSize: 1 })
            testsTotal = data?.total ?? 0
          } catch {
            testsTotal = 0
          }
        }

        // 2) Pacientes totales
        let patientsTotal = 0
        try {
          const pd = await PatientsApi.list({ page: 1, pageSize: 1 })
          patientsTotal = pd?.total ?? 0
        } catch {
          patientsTotal = 0
        }

        // 3) Tests realizados últimos 7 días
        let weekly = 0
        try {
          const now = new Date()
          const start = new Date(now)
          start.setDate(now.getDate() - 6)
          const params = {
            dateFrom: start.toISOString(),
            dateTo: now.toISOString(),
          }
          const { data } = await client.get(
            "/clinician/attempts/summary",
            { params },
          )
          weekly = data?.finished ?? data?.total ?? 0
        } catch {
          weekly = 0
        }

        // 4) Últimos pacientes atendidos
        let recent = []
        try {
          const { data } = await client.get(
            "/clinician/patients/recent",
            { params: { take: 5 } },
          )
          recent = Array.isArray(data) ? data : []
        } catch {
          try {
            const { items } = await PatientsApi.list({
              page: 1,
              pageSize: 5,
            })
            recent = items || []
          } catch {
            recent = []
          }
        }

        // 5) Tests más utilizados
        let tops = []
        try {
          const { data } = await client.get("/clinician/tests/top", {
            params: { period: "90d", take: 5 },
          })
          tops = Array.isArray(data) ? data : []
        } catch {
          try {
            const td = await TestsApi.forMe({
              page: 1,
              pageSize: 5,
            })
            tops = td?.items || []
          } catch {
            tops = []
          }
        }

        // 6) Si no hay pacientes ni tests, “limpia” weekly y tops
        if (patientsTotal === 0 && testsTotal === 0) {
          weekly = 0
          tops = []
        }

        // 7) Filtro de seguridad: solo mostrar tests que el profesional realmente tiene acceso
        try {
          const acc = await TestsApi.forMe({ page: 1, pageSize: 50 })
          const allowed = new Set((acc?.items || []).map((x) => x.id))
          if (allowed.size > 0 && Array.isArray(tops)) {
            tops = tops.filter((t) => allowed.has(t.id))
          }
        } catch {
          // si falla, dejamos tops tal cual
        }

        if (!cancelled) {
          setCounts({
            tests: testsTotal,
            patients: patientsTotal,
            weeklyRuns: weekly,
          })
          setRecentPatients(recent)
          setTopTests(tops)
          setLoading(false)
        }
      } catch {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  return { loading, counts, recentPatients, topTests }
}

// -----------------------------
// Hook NUEVO: stats de pacientes por período
// (para gráfico + PDF luego)
// -----------------------------

function usePatientsByPeriodStats({ from, to }) {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const params = { from, to }

        const { data } = await client.get(
          "/clinician/patients/stats-by-period",
          { params },
        )

        if (!cancelled) {
          setStats(data)
          setLoading(false)
        }
      } catch (err) {
        toaster.error("Error loading patients-by-period stats")
        if (!cancelled) {
          setStats(null)
          setLoading(false)
        }
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [from, to])

  return { loading, stats }
}

function useOrgPatientsByProfessionalStats({ from, to }) {
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState(null)
  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const params = { from, to }
        const { data } = await client.get(
          "/orgs/patients-by-professional",
          { params },
        )

        if (!cancelled) {
          setItems(Array.isArray(data) ? data : [])
          setLoading(false)
        }
      } catch (err) {
        console.error(
          "Error loading org patients-by-professional stats",
          err,
        )
        if (!cancelled) {
          setItems(null)
          setLoading(false)
        }
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [from, to])

  return { loading, items }
}



// -----------------------------
// UI reutilizable
// -----------------------------

function KpiCard({ icon, label, value }) {
  return (
    <Card.Root p="4">
      <HStack gap="4" align="center" justify="flex-start">
        <Box
          w="10"
          h="10"
          rounded="full"
          bg="brand.100"
          display="grid"
          placeItems="center"
        >
          <Icon as={icon} boxSize="20px" />
        </Box>
        <Box>
          <Text fontSize="sm" color="fg.muted">
            {label}
          </Text>
          <Heading size="md">{value}</Heading>
        </Box>
      </HStack>
    </Card.Root>
  )
}

function formatPatientName(p) {
  const first = p.firstName ?? p.first_name ?? ""
  const last1 = p.lastName1 ?? p.last_name1 ?? ""
  const last2 = p.lastName2 ?? p.last_name2 ?? ""
  const full = [first, last1, last2].filter(Boolean).join(" ")
  return full || p.name || "Paciente"
}

// -----------------------------
// Variante actual (clínico)
// -----------------------------

function ClinicianDashboard({ role }) {
  const nav = useNavigate()
  const { loading, counts, recentPatients, topTests } =
    useClinicianDashboardData()
    // -----------------------------
  // Rango de período: hoy / ayer / semana / mes / 90d / custom
  // -----------------------------
  const [rangeMode, setRangeMode] = useState("30d") // "today" | "yesterday" | "7d" | "30d" | "90d" | "custom"
  const [customFrom, setCustomFrom] = useState("")  // "yyyy-mm-dd"
  const [customTo, setCustomTo] = useState("")      // "yyyy-mm-dd"

  const {
    fromDate,
    toDate,
    fromIso,
    toIso,
    rangeLabelShort,
    rangeLabelExact,
  } = useMemo(() => {
    const now = new Date()

    // Hoy en UTC, 00:00
    const todayUtc = new Date(
      Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
    )

    const buildRange = (days) => {
      const from = new Date(todayUtc)
      from.setUTCDate(from.getUTCDate() - (days - 1)) // incluye hoy
      const to = new Date(todayUtc)
      to.setUTCDate(to.getUTCDate() + 1) // exclusivo: mañana 00:00
      return { from, to }
    }

    let from, to, label

    if (rangeMode === "today") {
      // solo hoy
      const fromToday = new Date(todayUtc)
      const toToday = new Date(todayUtc)
      toToday.setUTCDate(toToday.getUTCDate() + 1)
      from = fromToday
      to = toToday
      label = "hoy"
    } else if (rangeMode === "yesterday") {
      // solo ayer
      const y = new Date(todayUtc)
      y.setUTCDate(y.getUTCDate() - 1) // ayer 00:00
      const toY = new Date(y)
      toY.setUTCDate(toY.getUTCDate() + 1) // día siguiente a ayer (exclusivo)
      from = y
      to = toY
      label = "ayer"
    } else if (rangeMode === "7d") {
      ({ from, to } = buildRange(7))
      label = "últimos 7 días"
    } else if (rangeMode === "90d") {
      ({ from, to } = buildRange(90))
      label = "últimos 90 días"
    } else if (rangeMode === "custom" && customFrom && customTo) {
      try {
        const [y1, m1, d1] = customFrom.split("-").map(Number)
        const [y2, m2, d2] = customTo.split("-").map(Number)
        const fromUtc = new Date(Date.UTC(y1, m1 - 1, d1))
        const toUtcBase = new Date(Date.UTC(y2, m2 - 1, d2))
        // to exclusivo: día siguiente
        toUtcBase.setUTCDate(toUtcBase.getUTCDate() + 1)
        from = fromUtc
        to = toUtcBase
        label = "rango personalizado"
      } catch {
        ({ from, to } = buildRange(30))
        label = "últimos 30 días"
      }
    } else {
      // default = últimos 30 días
      ({ from, to } = buildRange(30))
      label = "últimos 30 días"
    }

    // Etiquetas exactas dd/mm/yyyy – dd/mm/yyyy, sin problema de zona horaria
    const formatYmd = (iso) => {
      const [y, m, d] = iso.slice(0, 10).split("-")
      return `${d}/${m}/${y}`
    }

    const fromIsoLocal = from.toISOString().slice(0, 10)
    const toExclusive = new Date(to)
    toExclusive.setUTCDate(toExclusive.getUTCDate() - 1)
    const toIsoLocal = toExclusive.toISOString().slice(0, 10)

    const exact = `${formatYmd(fromIsoLocal)} – ${formatYmd(toIsoLocal)}`

    return {
      fromDate: from,
      toDate: to,
      fromIso: from.toISOString(),
      toIso: to.toISOString(),
      rangeLabelShort: label,
      rangeLabelExact: exact,
    }
  }, [rangeMode, customFrom, customTo])

  const {
    loading: statsLoading,
    stats: patientsStats,
  } = usePatientsByPeriodStats({ from: fromIso, to: toIso })

  const isAdminLike = role === "admin" || role === "editor"
  const chartData = useMemo(() => {
  if (!patientsStats || !Array.isArray(patientsStats.series)) {
    return []
  }

  return patientsStats.series.map((s) => {
    const d = s.date ? new Date(s.date) : null
    // Etiqueta amigable para eje X (dd/mm)
    const label = d
      ? d.toLocaleDateString("es-CR", {
          day: "2-digit",
          month: "2-digit",
        })
      : String(s.date ?? "")

    return {
      date: s.date,
      label,
      patients: s.patientsCount ?? s.patients ?? 0,
    }
  })
}, [patientsStats])

  const handleExportPatientsPdf = async () => {
    if (!patientsStats) return
    try {
      const blob = await generatePatientsByPeriodPdf({
        stats: patientsStats,
        fromIso,
        toIso,
      })
      const fileName = `Pacientes-atendidos_${fromDate.toISOString().slice(0, 10)}_${toDate.toISOString().slice(0, 10)}.pdf`
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      //toaster.error({ title: 'Error generando PDF de pacientes atendidos', description: err })
      console.log(err)
      // aquí podrías usar tu toaster si quieres feedback al usuario
    }
  }


  if (loading) {
    return (
      <Box p="6" display="grid" placeItems="center">
        <Spinner size="lg" />
      </Box>
    )
  }

  return (
    <VStack align="stretch" gap="6" p="2">
      <Heading size="lg">Dashboard</Heading>

      {/* KPIs */}
      <SimpleGrid columns={{ base: 1, md: 3 }} gap="4">
        <KpiCard
          icon={LuClipboardList}
          label="Tests disponibles"
          value={counts.tests}
        />
        <KpiCard
          icon={LuUsers}
          label="Pacientes"
          value={counts.patients}
        />
        <KpiCard
          icon={LuActivity}
          label="Tests realizados (últimos 7 días)"
          value={counts.weeklyRuns}
        />
      </SimpleGrid>

            {/* Pacientes atendidos por período */}
      <Card.Root p="4">
        <HStack
          justify="space-between"
          align="flex-start"
          mb="3"
          flexWrap="wrap"
          gap="3"
        >
          <VStack align="flex-start" spacing="1">
            <Heading size="sm">Pacientes atendidos</Heading>
            <Text fontSize="xs" color="fg.muted">
              {rangeLabelShort} · {rangeLabelExact}
            </Text>

            <HStack spacing="2" flexWrap="wrap">
              <Button
                size="xs"
                variant={rangeMode === "today" ? "solid" : "outline"}
                onClick={() => setRangeMode("today")}
              >
                Hoy
              </Button>
              <Button
                size="xs"
                variant={rangeMode === "yesterday" ? "solid" : "outline"}
                onClick={() => setRangeMode("yesterday")}
              >
                Ayer
              </Button>
              <Button
                size="xs"
                variant={rangeMode === "7d" ? "solid" : "outline"}
                onClick={() => setRangeMode("7d")}
              >
                Semana
              </Button>
              <Button
                size="xs"
                variant={rangeMode === "30d" ? "solid" : "outline"}
                onClick={() => setRangeMode("30d")}
              >
                Mes
              </Button>
              <Button
                size="xs"
                variant={rangeMode === "90d" ? "solid" : "outline"}
                onClick={() => setRangeMode("90d")}
              >
                90 días
              </Button>
              <Button
                size="xs"
                variant={rangeMode === "custom" ? "solid" : "outline"}
                onClick={() => setRangeMode("custom")}
              >
                Custom
              </Button>
            </HStack>

            {rangeMode === "custom" && (
              <HStack spacing="2" pt="1" flexWrap="wrap">
                <Text fontSize="xs" color="fg.muted">
                  De:
                </Text>
                <Input
                  size="xs"
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  max={customTo || undefined}
                />
                <Text fontSize="xs" color="fg.muted">
                  A:
                </Text>
                <Input
                  size="xs"
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  min={customFrom || undefined}
                />
              </HStack>
            )}
          </VStack>

          <Button
            size="xs"
            variant="outline"
            onClick={handleExportPatientsPdf}
            isDisabled={statsLoading || !patientsStats}
          >
            Exportar PDF
          </Button>
        </HStack>



        {statsLoading ? (
          <HStack gap="2">
            <Spinner size="sm" />
            <Text fontSize="sm" color="fg.muted">
              Cargando estadísticas…
            </Text>
          </HStack>
        ) : !patientsStats ? (
          <Text fontSize="sm" color="fg.muted">
            No hay datos en el período seleccionado.
          </Text>
        ) : (
                <VStack align="stretch" gap="3">
        <Text fontSize="sm" color="fg.muted">
          Total pacientes únicos:{" "}
          <Text as="span" fontWeight="medium" color="fg.default">
            {patientsStats.totalUniquePatients ?? 0}
          </Text>{" "}
          · Total contactos clínicos (sesiones, tests, entrevistas):{" "}
          <Text as="span" fontWeight="medium" color="fg.default">
            {patientsStats.totalContacts ?? 0}
          </Text>
        </Text>

        {/* Gráfico principal */}
        {chartData.length === 0 ? (
          <Text fontSize="sm" color="fg.muted">
            No hay datos para graficar en el período seleccionado.
          </Text>
        ) : (
          <Box w="100%" h="260px">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="label"
                  fontSize={12}
                  tickMargin={6}
                />
                <YAxis
                  allowDecimals={false}
                  fontSize={12}
                  tickMargin={4}
                />
                <Tooltip
                  formatter={(value) => [`${value} pacientes`, "Pacientes"]}
                  labelFormatter={(label) => `Fecha: ${label}`}
                />
                <Line
                  type="monotone"
                  dataKey="patients"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        )}
      </VStack>

        )}
      </Card.Root>

      {/* Últimos pacientes + Tests más utilizados */}
      <SimpleGrid columns={{ base: 1, lg: 2 }} gap="4">
        {/* Últimos pacientes */}
        <Card.Root p="4">
          <HStack justify="space-between" mb="3">
            <Heading size="sm">Últimos pacientes atendidos</Heading>
            <Button
              size="xs"
              variant="subtle"
              onClick={() => nav("/app/clinic/pacientes")}
            >
              Ver todos
            </Button>
          </HStack>
          <VStack align="stretch" gap="2">
            {recentPatients.length === 0 && (
              <Text color="fg.muted">Sin datos recientes.</Text>
            )}
            {recentPatients.map((p) => (
              <HStack
                key={p.id}
                justify="space-between"
                rounded="md"
                p="2"
                _hover={{ bg: "blackAlpha.50", cursor: "pointer" }}
                onClick={() =>
                  nav(
                    `/app/clinic/pacientes?openPatientId=${p.id}&tab=hist`,
                  )
                }
              >
                <Box>
                  <Text fontWeight="medium">
                    {formatPatientName(p)}
                  </Text>
                  {p?.identificationNumber && (
                    <Text fontSize="sm" color="fg.muted">
                      {p.identificationNumber}
                    </Text>
                  )}
                </Box>
                <Icon as={LuChevronRight} />
              </HStack>
            ))}
          </VStack>
        </Card.Root>

        {/* Tests más utilizados */}
        <Card.Root p="4">
          <HStack justify="space-between" mb="3">
            <Heading size="sm">Tests más utilizados</Heading>
            <Button
              size="xs"
              variant="subtle"
              onClick={() =>
                nav(
                  isAdminLike
                    ? "/app/tests"
                    : "/app/clinic/evaluaciones",
                )
              }
            >
              Ver catálogo
            </Button>
          </HStack>
          <VStack align="stretch" gap="2">
            {topTests.length === 0 && (
              <Text color="fg.muted">
                Aún no hay uso suficiente.
              </Text>
            )}
            {topTests.map((t) => (
              <HStack
                key={t.id}
                justify="space-between"
                rounded="md"
                p="2"
                _hover={{ bg: "blackAlpha.50", cursor: "pointer" }}
                onClick={() =>
                  nav(
                    `/app/clinic/evaluaciones?openAssignTestId=${
                      t.id
                    }&openAssignTestName=${encodeURIComponent(
                      t.name || t.title || t.code || "Test",
                    )}`,
                  )
                }
              >
                <Box>
                  <Text fontWeight="medium">
                    {t.name || t.title || t.code}
                  </Text>
                  {typeof t.usageCount === "number" && (
                    <Text fontSize="sm" color="fg.muted">
                      {t.usageCount} usos
                    </Text>
                  )}
                </Box>
                <Icon as={LuChevronRight} />
              </HStack>
            ))}
          </VStack>
        </Card.Root>
      </SimpleGrid>
    </VStack>
  )
}

// -----------------------------
// Variantes stub para otros roles
// (por ahora reutilizan el clínico)
// -----------------------------

function SoloOwnerDashboard(props) {
  return <ClinicianDashboard {...props} />
}

function ClinicOwnerDashboard({ role, orgKind }) {
  const [rangeMode, setRangeMode] = useState("30d") // "today" | "yesterday" | "7d" | "30d" | "90d" | "custom"
  const [customFrom, setCustomFrom] = useState("")  // yyyy-mm-dd
  const [customTo, setCustomTo] = useState("")      // yyyy-mm-dd

  const {
    fromDate,
    toDate,
    fromIso,
    toIso,
    rangeLabelShort,
    rangeLabelExact,
  } = useMemo(() => {
    const now = new Date()

    // Hoy en UTC, 00:00
    const todayUtc = new Date(
      Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
    )

    const buildRange = (days) => {
      const from = new Date(todayUtc)
      from.setUTCDate(from.getUTCDate() - (days - 1)) // incluye hoy
      const to = new Date(todayUtc)
      to.setUTCDate(to.getUTCDate() + 1) // exclusivo: mañana 00:00
      return { from, to }
    }

    let from, to, label

    if (rangeMode === "today") {
      const fromToday = new Date(todayUtc)
      const toToday = new Date(todayUtc)
      toToday.setUTCDate(toToday.getUTCDate() + 1)
      from = fromToday
      to = toToday
      label = "hoy"
    } else if (rangeMode === "yesterday") {
      const y = new Date(todayUtc)
      y.setUTCDate(y.getUTCDate() - 1)
      const toY = new Date(y)
      toY.setUTCDate(toY.getUTCDate() + 1)
      from = y
      to = toY
      label = "ayer"
    } else if (rangeMode === "7d") {
      ({ from, to } = buildRange(7))
      label = "últimos 7 días"
    } else if (rangeMode === "90d") {
      ({ from, to } = buildRange(90))
      label = "últimos 90 días"
    } else if (rangeMode === "custom" && customFrom && customTo) {
      try {
        const [y1, m1, d1] = customFrom.split("-").map(Number)
        const [y2, m2, d2] = customTo.split("-").map(Number)
        const fromUtc = new Date(Date.UTC(y1, m1 - 1, d1))
        const toUtcBase = new Date(Date.UTC(y2, m2 - 1, d2))
        toUtcBase.setUTCDate(toUtcBase.getUTCDate() + 1) // exclusivo
        from = fromUtc
        to = toUtcBase
        label = "rango personalizado"
      } catch {
        ({ from, to } = buildRange(30))
        label = "últimos 30 días"
      }
    } else {
      ({ from, to } = buildRange(30))
      label = "últimos 30 días"
    }

    const formatYmd = (iso) => {
      const [y, m, d] = iso.split("-")
      return `${d}/${m}/${y}`
    }

    const fromIsoLocal = from.toISOString().slice(0, 10)
    const toExclusive = new Date(to)
    toExclusive.setUTCDate(toExclusive.getUTCDate() - 1)
    const toIsoLocal = toExclusive.toISOString().slice(0, 10)

    const exact = `${formatYmd(fromIsoLocal)} – ${formatYmd(toIsoLocal)}`

    return {
      fromDate: from,
      toDate: to,
      fromIso: from.toISOString(),
      toIso: to.toISOString(),
      rangeLabelShort: label,
      rangeLabelExact: exact,
    }
  }, [rangeMode, customFrom, customTo])

  const {
    loading: orgLoading,
    items: orgStats,
  } = useOrgPatientsByProfessionalStats({ from: fromIso, to: toIso })

  return (
    <VStack align="stretch" gap="6" p="2">
      {/* 1) Vista de profesional (la que ya tenías) */}
      {/* <ClinicianDashboard role={role} orgKind={orgKind} /> */}

      {/* 2) Nueva sección: actividad por profesional en la clínica */}
      <Card.Root p="4">
        <HStack
          justify="space-between"
          align="flex-start"
          mb="3"
          flexWrap="wrap"
          gap="3"
        >
          <VStack align="flex-start" spacing="1">
            <Heading size="sm">Actividad por profesional</Heading>
            <Text fontSize="xs" color="fg.muted">
              {rangeLabelShort} · {rangeLabelExact}
            </Text>

            <HStack spacing="2" flexWrap="wrap">
              <Button
                size="xs"
                variant={rangeMode === "today" ? "solid" : "outline"}
                onClick={() => setRangeMode("today")}
              >
                Hoy
              </Button>
              <Button
                size="xs"
                variant={rangeMode === "yesterday" ? "solid" : "outline"}
                onClick={() => setRangeMode("yesterday")}
              >
                Ayer
              </Button>
              <Button
                size="xs"
                variant={rangeMode === "7d" ? "solid" : "outline"}
                onClick={() => setRangeMode("7d")}
              >
                Semana
              </Button>
              <Button
                size="xs"
                variant={rangeMode === "30d" ? "solid" : "outline"}
                onClick={() => setRangeMode("30d")}
              >
                Mes
              </Button>
              <Button
                size="xs"
                variant={rangeMode === "90d" ? "solid" : "outline"}
                onClick={() => setRangeMode("90d")}
              >
                90 días
              </Button>
              <Button
                size="xs"
                variant={rangeMode === "custom" ? "solid" : "outline"}
                onClick={() => setRangeMode("custom")}
              >
                Custom
              </Button>
            </HStack>

            {rangeMode === "custom" && (
              <HStack spacing="2" pt="1" flexWrap="wrap">
                <Text fontSize="xs" color="fg.muted">
                  De:
                </Text>
                <Input
                  size="xs"
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  max={customTo || undefined}
                />
                <Text fontSize="xs" color="fg.muted">
                  A:
                </Text>
                <Input
                  size="xs"
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  min={customFrom || undefined}
                />
              </HStack>
            )}
          </VStack>
        </HStack>

        {orgLoading ? (
          <HStack gap="2">
            <Spinner size="sm" />
            <Text fontSize="sm" color="fg.muted">
              Cargando actividad por profesional…
            </Text>
          </HStack>
        ) : !orgStats || orgStats.length === 0 ? (
          <Text fontSize="sm" color="fg.muted">
            No hay actividad registrada en el período seleccionado.
          </Text>
        ) : (
          <Box w="100%" overflowX="auto">
            <VStack as="div" align="stretch" gap="1" minW="600px">
              {/* Encabezado */}
              <HStack
                px="2"
                py="1"
                borderBottom="1px solid"
                borderColor="gray.200"
              >
                <Box flex="2">
                  <Text fontSize="xs" fontWeight="bold">
                    Profesional
                  </Text>
                </Box>
                <Box flex="2">
                  <Text fontSize="xs" fontWeight="bold">
                    Paciente
                  </Text>
                </Box>
                <Box flex="1" textAlign="right">
                  <Text fontSize="xs" fontWeight="bold">
                    Pacientes únicos
                  </Text>
                </Box>
                <Box flex="1" textAlign="right">
                  <Text fontSize="xs" fontWeight="bold">
                    Contactos
                  </Text>
                </Box>
                <Box flex="1" textAlign="right">
                  <Text fontSize="xs" fontWeight="bold">
                    Tests
                  </Text>
                </Box>
                <Box flex="1" textAlign="right">
                  <Text fontSize="xs" fontWeight="bold">
                    Sesiones
                  </Text>
                </Box>
                <Box flex="1" textAlign="right">
                  <Text fontSize="xs" fontWeight="bold">
                    Entrevistas
                  </Text>
                </Box>
              </HStack>

              {/* Filas */}
              {orgStats.map((row, idx) => {
  const patientName = [
    row.patientFirstName,
    row.patientLastName1,
    row.patientLastName2,
  ].filter(Boolean).join(" ")

  return (
    <HStack
      key={`${row.clinicianUserId}-${row.patientId}-${idx}`}
      px="2"
      py="1"
      borderBottom="1px solid"
      borderColor="gray.100"
    >
      <Box flex="2">
        <Text fontSize="sm">
          {row.clinicianEmail || `Profesional #${row.clinicianUserId}`}
        </Text>
      </Box>

      <Box flex="2">
        <Text fontSize="sm">
          {patientName || `Paciente #${String(row.patientId).slice(0, 8)}…`}
        </Text>
        {row.patientEmail && (
          <Text fontSize="xs" color="fg.muted">
            {row.patientEmail}
          </Text>
        )}
      </Box>

      <Box flex="1" textAlign="right">
        <Text fontSize="sm">{row.contactsCount ?? 0}</Text>
      </Box>
      <Box flex="1" textAlign="right">
        <Text fontSize="sm">{row.testsCount ?? 0}</Text>
      </Box>
      <Box flex="1" textAlign="right">
        <Text fontSize="sm">{row.sessionsCount ?? 0}</Text>
      </Box>
      <Box flex="1" textAlign="right">
        <Text fontSize="sm">{row.interviewsCount ?? 0}</Text>
      </Box>
    </HStack>
  )
})}

            </VStack>
          </Box>
        )}
      </Card.Root>
    </VStack>
  )
}


function SystemAdminDashboard(props) {
  return <ClinicianDashboard {...props} />
}

// -----------------------------
// Wrapper principal por rol/orgKind
// -----------------------------

export default function Dashboard() {
  const role = getRole()
  const { orgKind } = getRoleAndOrgKind()
  if (role === "admin") {
    return (
      <SystemAdminDashboard role={role} orgKind={orgKind} />
    )
  }

  if (
    role === "editor" &&
    (orgKind === "clinic" || orgKind === "hospital")
  ) {
    return (
      <ClinicOwnerDashboard role={role} orgKind={orgKind} />
    )
  }

  if (role === "editor" && orgKind === "solo") {
    return (
      <SoloOwnerDashboard role={role} orgKind={orgKind} />
    )
  }

  return <ClinicianDashboard role={role} orgKind={orgKind} />
}
