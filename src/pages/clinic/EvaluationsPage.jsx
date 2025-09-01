import { useEffect, useMemo, useState } from "react"
import {
  Box, Heading, HStack, VStack, Text, Input, IconButton,
  Grid, Card, Badge, Button, Spacer, Spinner
} from "@chakra-ui/react"
import { FiSearch, FiRefreshCw, FiPlay } from "react-icons/fi"
import { TestsApi } from "../../api/testsApi"
import { PatientsApi } from "../../api/patientsApi"
import { AssignmentsApi } from "../../api/assignmentsApi"
import { toaster } from "../../components/ui/toaster"
import { Tip } from "../../components/ui/tooltip"

function getErrorMessage(error) {
  const data = error?.response?.data
  if (typeof data === "string") return data
  if (data?.message) return data.message
  return error?.message || "Error"
}

function AssignDialog({ isOpen, onClose, test, onAssigned }) {
  const [loading, setLoading] = useState(false)
  const [patients, setPatients] = useState([])
  const [patientId, setPatientId] = useState("")
  const [due, setDue] = useState("")

  useEffect(() => {
    if (!isOpen) return
    ;(async () => {
      try {
        const res = await PatientsApi.list({ page: 1, pageSize: 1000 })
        setPatients(res?.items || [])
      } catch (e) {
        toaster.error({ title: "No se pudieron cargar pacientes", description: getErrorMessage(e) })
      }
    })()
  }, [isOpen])

  const submit = async () => {
    if (!patientId) {
      toaster.error({ title: "Selecciona un paciente" })
      return
    }
    setLoading(true)
    try {
      await AssignmentsApi.create({
        testId: test.id,
        assignedToUserId: Number(patientId),
        subjectUserId: Number(patientId),
        respondentRole: "self",
        dueAt: due || null
      })
      toaster.success({ title: "Evaluación asignada" })
      onAssigned?.()
      onClose()
    } catch (e) {
      toaster.error({ title: "No se pudo asignar", description: getErrorMessage(e) })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box display={isOpen ? "block" : "none"}>
      <Box position="fixed" inset="0" bg="blackAlpha.600" />
      <Box position="fixed" inset="0" display="grid" placeItems="center" p="4">
        <Box bg="white" rounded="lg" shadow="lg" maxW="560px" w="100%" p="5">
          <Heading size="sm" mb="3">Asignar evaluación</Heading>
          <VStack align="stretch" gap="3">
            <Box>
              <Text textStyle="sm" color="fg.muted">Evaluación</Text>
              <Text fontWeight="semibold">{test?.name}</Text>
            </Box>

            <Box>
              <Text textStyle="sm" color="fg.muted" mb="1">Paciente</Text>
              <select
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
                style={{ padding: 8, width: "100%", borderRadius: 6, border: "1px solid var(--chakra-colors-border)" }}
              >
                <option value="">Seleccione…</option>
                {patients.map(p => (
                  <option key={p.id} value={p.id}>
                    {`${p.firstName} ${p.lastName1}${p.lastName2 ? " " + p.lastName2 : ""}`}
                  </option>
                ))}
              </select>
            </Box>

            <Box>
              <Text textStyle="sm" color="fg.muted" mb="1">Fecha límite (opcional)</Text>
              <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
            </Box>

            <HStack justify="end" mt="2">
              <Button onClick={onClose} variant="outline">Cancelar</Button>
              <Button colorPalette="brand" onClick={submit} isLoading={loading}>
                Asignar
              </Button>
            </HStack>
          </VStack>
        </Box>
      </Box>
    </Box>
  )
}

export default function EvaluationsPage() {
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(24)
  const [search, setSearch] = useState("")

  const [assignOpen, setAssignOpen] = useState(false)
  const [selectedTest, setSelectedTest] = useState(null)

  async function load() {
    setLoading(true)
    try {
      const data = await TestsApi.listForMe({ page, pageSize, search })
      setItems(data?.items || [])
      setTotal(data?.total ?? 0)
    } catch (e) {
      toaster.error({ title: "No se pudieron cargar evaluaciones", description: getErrorMessage(e) })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, []) // primera carga

  useEffect(() => { load() }, [page, pageSize]) // paginación

  const onSearch = (e) => {
    e.preventDefault()
    setPage(1)
    load()
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <Box>
      <HStack mb="4" align="center" wrap="wrap">
        <Heading size="md">Evaluaciones</Heading>
        <Spacer />
        <HStack as="form" onSubmit={onSearch} gap="2">
          <select
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }}
            aria-label="Elementos por página"
            style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid var(--chakra-colors-border)', fontSize: 14 }}
          >
            <option value="12">12</option>
            <option value="24">24</option>
            <option value="48">48</option>
          </select>

          <Input
            size="sm"
            placeholder="Buscar evaluación…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            width="260px"
          />
          <Tip label="Buscar">
            <IconButton type="submit" aria-label="Buscar" size="sm"><FiSearch /></IconButton>
          </Tip>
          <Tip label="Recargar">
            <IconButton aria-label="Recargar" size="sm" onClick={() => load()}><FiRefreshCw /></IconButton>
          </Tip>
        </HStack>
      </HStack>

      {loading ? (
        <HStack py="10" justify="center" color="fg.muted"><Spinner /><Text>Cargando…</Text></HStack>
      ) : items.length === 0 ? (
        <Box py="10" textAlign="center" color="fg.muted">No hay evaluaciones disponibles para tus disciplinas.</Box>
      ) : (
        <Grid templateColumns="repeat(auto-fill, minmax(260px, 1fr))" gap="4">
          {items.map(t => (
            <Card.Root key={t.id} p="4" borderWidth="1px" rounded="lg">
              <VStack align="stretch" gap="3">
                <HStack justify="space-between">
                  <Heading size="sm" noOfLines={2}>{t.name}</Heading>
                  <Badge variant="subtle">{t.ageGroupName}</Badge>
                </HStack>
                <Text color="fg.muted" noOfLines={3}>{t.description || "Sin descripción"}</Text>
                <HStack justify="space-between" mt="2">
                  <Text textStyle="xs" color="fg.muted">{t.code}</Text>
                  <Button
                    size="sm"
                    leftIcon={<FiPlay />}
                    colorPalette="brand"
                    onClick={() => { setSelectedTest(t); setAssignOpen(true) }}
                  >
                    Iniciar
                  </Button>
                </HStack>
              </VStack>
            </Card.Root>
          ))}
        </Grid>
      )}

      {/* Paginación simple */}
      <HStack mt="4" justify="space-between" wrap="wrap" gap="2">
        <Text textStyle="sm" color="fg.muted">
          Página {page} de {totalPages} — {total} en total
        </Text>
        <HStack>
          <Button size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>Anterior</Button>
          <Button size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>Siguiente</Button>
        </HStack>
      </HStack>

      {/* Dialog asignar */}
      {selectedTest && (
        <AssignDialog
          isOpen={assignOpen}
          onClose={() => setAssignOpen(false)}
          test={selectedTest}
          onAssigned={() => {}}
        />
      )}
    </Box>
  )
}
