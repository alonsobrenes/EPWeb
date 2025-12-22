// src/pages/Dashboard.jsx
import React, { useEffect, useState, useMemo, useRef } from "react"
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
import { generateOrgPatientsByProfessionalPdf } from "../reports/generateOrgPatientsByProfessionalPdf"
import { toaster } from "../components/ui/toaster"
import { useOrgKind } from "../context/OrgContext"
import { getRole } from "../auth/role"
import {
  LuClipboardList,
  LuUsers,
  LuActivity,
  LuCalendarCheck,
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
  Legend
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
  const [stats, setStats] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const params = { from, to }
        const { data } = await client.get(
          "/orgs/patients-by-professional/stats",
          { params },
        )

        if (!cancelled) {
          setStats(data || null)
          setLoading(false)
        }
      } catch (err) {
        console.error("Error loading org patients-by-professional stats v2", err)
        if (!cancelled) {
          setStats(null)
          setLoading(false)
        }
      }
    }

    load()
    return () => { cancelled = true }
  }, [from, to])

  return { loading, stats }
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

const parseCustomDateOrNull = (ymd) => {
    if (!ymd) return null
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
    if (!m) return null

    const y = Number(m[1])
    const mo = Number(m[2])
    const d = Number(m[3])

    // Límite SQL Server datetime
    if (y < 1753 || y > 9999) return null
    if (mo < 1 || mo > 12) return null
    if (d < 1 || d > 31) return null

    const dt = new Date(Date.UTC(y, mo - 1, d))
    if (Number.isNaN(dt.getTime())) return null

    // evita "correcciones" silenciosas (2025-02-31)
    if (
      dt.getUTCFullYear() !== y ||
      dt.getUTCMonth() + 1 !== mo ||
      dt.getUTCDate() !== d
    ) {
      return null
    }

    return dt
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
  const lastValidRangeRef = useRef(null)

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

    // Base: rango válido anterior o default 30d
    if (lastValidRangeRef.current) {
      from = new Date(lastValidRangeRef.current.from)
      to = new Date(lastValidRangeRef.current.to)
      label = lastValidRangeRef.current.label ?? "últimos 30 días"
    } else {
      ;({ from, to } = buildRange(30))
      label = "últimos 30 días"
    }

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
      ;({ from, to } = buildRange(7))
      label = "últimos 7 días"
    } else if (rangeMode === "90d") {
      ;({ from, to } = buildRange(90))
      label = "últimos 90 días"
    } else if (rangeMode === "custom") {
      const f = parseCustomDateOrNull(customFrom)
      const t = parseCustomDateOrNull(customTo)

      if (f && t && f <= t) {
        const toEx = new Date(t)
        toEx.setUTCDate(toEx.getUTCDate() + 1) // exclusivo
        from = f
        to = toEx
        label = "rango personalizado"
      } else {
        // IMPORTANTÍSIMO:
        // mientras el usuario teclea (0202), NO tocamos from/to
        // y así NO se dispara request inválido
        label = "rango personalizado"
      }
    } else {
      ;({ from, to } = buildRange(30))
      label = "últimos 30 días"
    }

    // Persistimos el último rango válido SIEMPRE que from/to sean válidos
    if (from instanceof Date && to instanceof Date && !Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime())) {
      lastValidRangeRef.current = { from, to, label }
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

function OrgMultiLineChart({ series }) {
  const { chartData, lineDefs } = useMemo(() => {
    const rows = Array.isArray(series) ? series : []
    if (rows.length === 0) return { chartData: [], lineDefs: [] }

    // claves por clinician
    const clinicians = new Map()
    for (const r of rows) {
      const id = r.clinicianUserId
      if (!id) continue
      if (!clinicians.has(id)) {
        clinicians.set(id, {
          id,
          key: `u${id}`,
          name: r.clinicianFullName || `Profesional #${id}`,
        })
      }
    }

    // limitar a top 6 por sum(patientsCount) para no saturar
    const totals = new Map()
    for (const r of rows) {
      const id = r.clinicianUserId
      if (!id) continue
      totals.set(id, (totals.get(id) || 0) + (Number(r.patientsCount) || 0))
    }

    const topIds = Array.from(totals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([id]) => id)

    const lineDefs = topIds
      .map((id) => clinicians.get(id))
      .filter(Boolean)

    // agrupar por fecha (yyyy-mm-dd)
    const byDate = new Map()
    for (const r of rows) {
      const d = r.date ? new Date(r.date) : null
      if (!d || Number.isNaN(d.getTime())) continue
      const dateKey = d.toISOString().slice(0, 10)
      if (!byDate.has(dateKey)) byDate.set(dateKey, {})
      const obj = byDate.get(dateKey)

      const id = r.clinicianUserId
      const def = clinicians.get(id)
      if (!def) continue
      if (!topIds.includes(id)) continue

      obj[def.key] = Number(r.patientsCount ?? 0) || 0
    }

    const dates = Array.from(byDate.keys()).sort()
    const chartData = dates.map((dateKey) => {
      const d = new Date(dateKey + "T00:00:00.000Z")
      const label = `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`
      return { label, ...byDate.get(dateKey) }
    })

    return { chartData, lineDefs }
  }, [series])

  if (chartData.length === 0 || lineDefs.length === 0) return null

  // colores distintos (constante y simple)
  const palette = ["#1A73E8","#188038", "#d9257fff", "#49e2f7de", "#A142F4", "#F9AB00", "#12B5CB"]

  return (
    <Box w="100%" h="320px" mb="4">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="label" fontSize={12} tickMargin={6} />
          <YAxis allowDecimals={false} fontSize={12} tickMargin={4} />
          <Tooltip />
          <Legend />
          {lineDefs.map((s, idx) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.name}
              stroke={palette[idx % palette.length]}
              strokeWidth={2}
              dot={{ r: 2 }}
              activeDot={{ r: 4 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </Box>
  )
}



function ClinicOwnerDashboard({ role, orgKind }) {
  const [rangeMode, setRangeMode] = useState("30d") // today | yesterday | 7d | 30d | 90d | custom
  const [customFrom, setCustomFrom] = useState("")
  const [customTo, setCustomTo] = useState("")
  const lastValidRangeRef = useRef(null)

  const { fromDate, toDate, fromIso, toIso, rangeLabelShort, rangeLabelExact } = useMemo(() => {
    const now = new Date()
    const todayUtc = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))

    const buildRange = (days) => {
      const from = new Date(todayUtc)
      from.setUTCDate(from.getUTCDate() - (days - 1))
      const to = new Date(todayUtc)
      to.setUTCDate(to.getUTCDate() + 1)
      return { from, to }
    }

    let from, to, label

    // Base: rango válido anterior o default 30d
    if (lastValidRangeRef.current) {
      from = new Date(lastValidRangeRef.current.from)
      to = new Date(lastValidRangeRef.current.to)
      label = lastValidRangeRef.current.label ?? "últimos 30 días"
    } else {
      ;({ from, to } = buildRange(30))
      label = "últimos 30 días"
    }

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
      ;({ from, to } = buildRange(7))
      label = "últimos 7 días"
    } else if (rangeMode === "90d") {
      ;({ from, to } = buildRange(90))
      label = "últimos 90 días"
    } else if (rangeMode === "custom") {
      const f = parseCustomDateOrNull(customFrom)
      const t = parseCustomDateOrNull(customTo)

      if (f && t && f <= t) {
        const toEx = new Date(t)
        toEx.setUTCDate(toEx.getUTCDate() + 1) // exclusivo
        from = f
        to = toEx
        label = "rango personalizado"
      } else {
        // IMPORTANTÍSIMO:
        // mientras el usuario teclea (0202), NO tocamos from/to
        // y así NO se dispara request inválido
        label = "rango personalizado"
      }
    } else {
      ;({ from, to } = buildRange(30))
      label = "últimos 30 días"
    }

    // Persistimos el último rango válido SIEMPRE que from/to sean válidos
    if (from instanceof Date && to instanceof Date && !Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime())) {
      lastValidRangeRef.current = { from, to, label }
    }


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

  const { loading: statsLoading, stats: orgStats } =
    useOrgPatientsByProfessionalStats({ from: fromIso, to: toIso })

  const series = orgStats?.series || []
  const details = orgStats?.details || [] // se usa para PDF, no se muestra
  const totalUniquePatients = orgStats?.totalUniquePatients ?? 0
  const totalContacts = orgStats?.totalContacts ?? 0

  const handleExportPdf = async () => {
    if (!series) return
    try {
      const blob = await generateOrgPatientsByProfessionalPdf({
        stats: orgStats,
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
      toaster.error({ title: 'Error generando PDF de pacientes atendidos', description: err })
      console.log(err)
      // aquí podrías usar tu toaster si quieres feedback al usuario
    }
  }

  return (
    <VStack align="stretch" gap="6" p="2">
      <Heading size="lg">Dashboard</Heading>

      {/* KPIs */}
      <SimpleGrid columns={{ base: 1, md: 3 }} gap="4">
        <KpiCard
          icon={LuCalendarCheck}
          label="Visitas"
          value={totalContacts}
        />
        <KpiCard
          icon={LuUsers}
          label="Pacientes únicos"
          value={totalUniquePatients}
        />
      </SimpleGrid>
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
                <Text fontSize="xs" color="fg.muted">De:</Text>
                <Input
                  size="xs"
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  max={customTo || undefined}
                />
                <Text fontSize="xs" color="fg.muted">A:</Text>
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
            onClick={handleExportPdf}
            isDisabled={statsLoading || !orgStats}
          >
            Exportar PDF
          </Button>
        </HStack>

        {statsLoading ? (
          <HStack gap="2">
            <Spinner size="sm" />
            <Text fontSize="sm" color="fg.muted">
              Cargando actividad por profesional…
            </Text>
          </HStack>
        ) : !orgStats ? (
          <Text fontSize="sm" color="fg.muted">
            No hay datos en el período seleccionado.
          </Text>
        ) : (
          <VStack align="stretch" gap="3">
            <Text fontSize="sm" color="fg.muted">
              Total pacientes únicos:{" "}
              <Text as="span" fontWeight="medium" color="fg.default">
                {totalUniquePatients}
              </Text>{" "}
              · Total contactos clínicos (sesiones, tests, entrevistas):{" "}
              <Text as="span" fontWeight="medium" color="fg.default">
                {totalContacts}
              </Text>
            </Text>

            {Array.isArray(series) && series.length > 0 ? (
              <OrgMultiLineChart series={series} />
            ) : (
              <Text fontSize="sm" color="fg.muted">
                No hay datos para graficar en el período seleccionado.
              </Text>
            )}

            {/* Details quedan disponibles para PDF (no se muestran) */}
            <Box display="none" aria-hidden="true">
              {details.length}
            </Box>
          </VStack>
        )}
      </Card.Root>
    </VStack>
  )
}


function SystemAdminDashboard(props) {
  return <></>
  //return <ClinicianDashboard {...props} />
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
