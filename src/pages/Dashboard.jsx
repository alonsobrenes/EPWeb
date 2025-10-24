// src/pages/Dashboard.jsx
import React, { useEffect, useState } from "react"
import {
  Box, Heading, SimpleGrid, HStack, VStack, Text, Icon, Spinner, Button, Card
} from "@chakra-ui/react"
import { useNavigate } from "react-router-dom"
import client from "../api/client"
import { TestsApi } from "../api/testsApi"
import { PatientsApi } from "../api/patientsApi"
import { LuClipboardList, LuUsers, LuActivity, LuChevronRight } from "react-icons/lu"

function decodeJwtPayload() {
  try {
    const raw = localStorage.getItem("authToken") || sessionStorage.getItem("authToken") ||
                localStorage.getItem("token") || sessionStorage.getItem("token") || "";
    const token = raw.startsWith("Bearer ") ? raw.slice(7) : raw;
    const [, payload] = token.split(".");
    if (!payload) return {};
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json);
  } catch { return {}; }
}
function extractRolesFromPayload(p) {
  const out = new Set();
  const cand = [
    p.role, p.roles,
    p["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"],
    p["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/role"]
  ].flat();
  for (const r of cand || []) if (r) out.add(String(r).toLowerCase());
  return out;
}
function isAdminLike() {
  const roles = extractRolesFromPayload(decodeJwtPayload());
  console.log(roles)
  return ["admin","owner","manager"].some(r => roles.has(r));
}

function useDashboardData() {
  const [loading, setLoading] = useState(true)
  const [counts, setCounts] = useState({ tests: 0, patients: 0, weeklyRuns: 0 })
  const [recentPatients, setRecentPatients] = useState([])
  const [topTests, setTopTests] = useState([])

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        let testsTotal = 0
        try {
          const data = await TestsApi.forMe({ page: 1, pageSize: 1 })
          testsTotal = data?.total ?? 0
        } catch {
          const data = await TestsApi.list({ page: 1, pageSize: 1 })
          testsTotal = data?.total ?? 0
        }

        let patientsTotal = 0
        try {
          const pd = await PatientsApi.list({ page: 1, pageSize: 1 })
          patientsTotal = pd?.total ?? 0
        } catch {}

        let weekly = 0
        try {
          const now = new Date()
          const start = new Date(now)
          start.setDate(now.getDate() - 6)
          const params = { dateFrom: start.toISOString(), dateTo: now.toISOString() }
          const { data } = await client.get("/clinician/attempts/summary", { params })
          weekly = (data?.finished ?? data?.total ?? 0)
        } catch {}

        let recent = []
        try {
          const { data } = await client.get("/clinician/patients/recent", { params: { take: 5 } })
          recent = Array.isArray(data) ? data : []
        } catch {
          try {
            const { items } = await PatientsApi.list({ page: 1, pageSize: 5 })
            recent = items || []
          } catch {}
        }

        let tops = []
        try {
          const { data } = await client.get("/clinician/tests/top", { params: { period: "90d", take: 5 } })
          tops = Array.isArray(data) ? data : []
        } catch {
          try {
            const td = await TestsApi.forMe({ page: 1, pageSize: 5 })
            tops = td?.items || []
          } catch {}
        }

        if (patientsTotal === 0 && testsTotal === 0) {
          weekly = 0
          tops = []
        }

        try {
          const acc = await TestsApi.forMe({ page: 1, pageSize: 50 })
          const allowed = new Set((acc?.items || []).map(x => x.id))
          if (allowed.size > 0 && Array.isArray(tops)) {
            tops = tops.filter(t => allowed.has(t.id))
          }
        } catch { /* si falla, dejamos tops tal cual */ }

        if (!cancelled) {
          setCounts({ tests: testsTotal, patients: patientsTotal, weeklyRuns: weekly })
          setRecentPatients(recent)
          setTopTests(tops)
          setLoading(false)
        }
      } catch {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  return { loading, counts, recentPatients, topTests }
}

function KpiCard({ icon, label, value }) {
  return (
    <Card.Root p="4">
      <HStack gap="4" align="center" justify="flex-start">
        <Box w="10" h="10" rounded="full" bg="brand.100" display="grid" placeItems="center">
          <Icon as={icon} boxSize="5" color="brand.700" />
        </Box>
        <VStack gap="0" align="start">
          <Text fontSize="sm" color="fg.muted">{label}</Text>
          <Heading size="md">{value}</Heading>
        </VStack>
      </HStack>
    </Card.Root>
  )
}

function formatPatientName(p) {
  const parts = [p?.firstName, p?.lastName1, p?.lastName2].filter(Boolean)
  return parts.length ? parts.join(" ") : (p?.fullName || p?.name || "Paciente")
}

export default function Dashboard() {
  const nav = useNavigate()
  const { loading, counts, recentPatients, topTests } = useDashboardData()

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

      <SimpleGrid columns={{ base: 1, md: 3 }} gap="4">
        <KpiCard icon={LuClipboardList} label="Tests disponibles" value={counts.tests} />
        <KpiCard icon={LuUsers} label="Pacientes" value={counts.patients} />
        <KpiCard icon={LuActivity} label="Tests realizados (últimos 7 días)" value={counts.weeklyRuns} />
      </SimpleGrid>

      <SimpleGrid columns={{ base: 1, lg: 2 }} gap="4">
        <Card.Root p="4">
          <HStack justify="space-between" mb="3">
            <Heading size="sm">Últimos pacientes atendidos</Heading>
            <Button size="xs" variant="subtle" onClick={() => nav("/app/clinic/pacientes")}>Ver todos</Button>
          </HStack>
          <VStack align="stretch" gap="2">
            {recentPatients.length === 0 && <Text color="fg.muted">Sin datos recientes.</Text>}
            {recentPatients.map((p) => (
              <HStack
                key={p.id}
                justify="space-between"
                rounded="md"
                p="2"
                _hover={{ bg: "blackAlpha.50", cursor: "pointer" }}
                onClick={() => nav(`/app/clinic/pacientes?openPatientId=${p.id}&tab=hist`)}
              >
                <Box>
                  <Text fontWeight="medium">{formatPatientName(p)}</Text>
                  {p?.identificationNumber && (
                    <Text fontSize="sm" color="fg.muted">{p.identificationNumber}</Text>
                  )}
                </Box>
                <Icon as={LuChevronRight} />
              </HStack>
            ))}
          </VStack>
        </Card.Root>

        <Card.Root p="4">
          <HStack justify="space-between" mb="3">
            <Heading size="sm">Tests más utilizados</Heading>
            <Button size="xs" variant="subtle" onClick={() => nav(isAdminLike() ? "/app/tests" : "/app/clinic/evaluaciones")}>Ver catálogo</Button>
          </HStack>
          <VStack align="stretch" gap="2">
            {topTests.length === 0 && <Text color="fg.muted">Aún no hay uso suficiente.</Text>}
            {topTests.map((t) => (
              <HStack
                key={t.id}
                justify="space-between"
                rounded="md"
                p="2"
                _hover={{ bg: "blackAlpha.50", cursor: "pointer" }}
                onClick={() => nav(`/app/clinic/evaluaciones?openAssignTestId=${t.id}&openAssignTestName=${encodeURIComponent(t.name || t.title || t.code || "Test")}`)}
              >
                <Box>
                  <Text fontWeight="medium">{t.name || t.title || t.code}</Text>
                  {typeof t.usageCount === "number" && (
                    <Text fontSize="sm" color="fg.muted">{t.usageCount} usos</Text>
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
