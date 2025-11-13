import React, { useEffect, useMemo, useState } from "react"
import {
  Box,
  Button,
  HStack,
  VStack,
  Text,
  Input,
  Badge,
  Separator,
} from "@chakra-ui/react"
import { listTickets } from "../api/adminSupportApi"
import TicketAdminDialog from "./TicketAdminDialog"
import { toaster } from "../components/ui/toaster"

export default function TicketsAdminPage() {
  // filtros
  const [status, setStatus] = useState("")
  const [priority, setPriority] = useState("")
  const [category, setCategory] = useState("")
  const [assignedTo, setAssignedTo] = useState("")
  const [userId, setUserId] = useState("")
  const [q, setQ] = useState("")
  const [top, setTop] = useState(100)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [rows, setRows] = useState([])

  // paginación client-side
  const [page, setPage] = useState(1)
  const pageSize = 10
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize))
  const pageRows = useMemo(() => {
    const start = (page - 1) * pageSize
    return rows.slice(start, start + pageSize)
  }, [rows, page])

  // selección
  const [selected, setSelected] = useState(null) // row seleccionada
  const [dialogOpen, setDialogOpen] = useState(false)

  async function fetchData() {
    try {
      setError("")
      setLoading(true)
      const data = await listTickets({ top, status, assignedTo, userId, category, priority, q })
      setRows(data)
      setPage(1)
    } catch (err) {
      console.error(err)
      setError("No fue posible cargar los tickets.")
      toaster.error({ title: "Error", description: "No fue posible cargar los tickets." })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function onOpen(row) {
    setSelected(row)
    setDialogOpen(true)
  }

  function onClose() {
    setDialogOpen(false)
    setSelected(null)
  }

  return (
    <VStack align="stretch" gap="4">
      {/* Header + Filtros */}
      <Box>
        <HStack justify="space-between" align="center">
          <Text fontSize="xl" fontWeight="bold">Centro de Ayuda — Tickets (Admin)</Text>
          <HStack>
            <Button onClick={fetchData} variant="subtle">Refrescar</Button>
          </HStack>
        </HStack>

        <Box mt="3" borderWidth="1px" rounded="md" p="3" bg="bg.subtle" borderColor="border">
          <VStack align="stretch" gap="3">
            <HStack gap="3" wrap="wrap">
              {/* status */}
              <Box>
                <Text textStyle="xs" mb="1">Estado</Text>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  style={{ padding: 8, borderRadius: 6, border: "1px solid var(--chakra-colors-border)" }}
                >
                  <option value="">(todos)</option>
                  <option value="open">open</option>
                  <option value="in_progress">in_progress</option>
                  <option value="resolved">resolved</option>
                  <option value="closed">closed</option>
                </select>
              </Box>

              {/* priority */}
              <Box>
                <Text textStyle="xs" mb="1">Prioridad</Text>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  style={{ padding: 8, borderRadius: 6, border: "1px solid var(--chakra-colors-border)" }}
                >
                  <option value="">(todas)</option>
                  <option value="low">low</option>
                  <option value="normal">normal</option>
                  <option value="high">high</option>
                </select>
              </Box>

              {/* category */}
              <Box>
                <Text textStyle="xs" mb="1">Categoría</Text>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  style={{ padding: 8, borderRadius: 6, border: "1px solid var(--chakra-colors-border)" }}
                >
                  <option value="">(todas)</option>
                  <option value="bug">bug</option>
                  <option value="feature">feature</option>
                  <option value="billing">billing</option>
                  <option value="other">other</option>
                </select>
              </Box>

              {/* assignedTo */}
              <Box>
                <Text textStyle="xs" mb="1">Asignado a (user_id)</Text>
                <Input
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  placeholder="ID usuario"
                  w="140px"
                />
              </Box>

              {/* userId */}
              <Box>
                <Text textStyle="xs" mb="1">Usuario (user_id)</Text>
                <Input
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  placeholder="ID usuario"
                  w="140px"
                />
              </Box>

              {/* q */}
              <Box flex="1" minW="220px">
                <Text textStyle="xs" mb="1">Buscar</Text>
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="asunto o descripción"
                />
              </Box>

              {/* top */}
              <Box>
                <Text textStyle="xs" mb="1">Top</Text>
                <select
                  value={top}
                  onChange={(e) => setTop(Number(e.target.value))}
                  style={{ padding: 8, borderRadius: 6, border: "1px solid var(--chakra-colors-border)" }}
                >
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                </select>
              </Box>

              <HStack align="end">
                <Button onClick={fetchData} colorPalette="blue">Aplicar</Button>
              </HStack>
            </HStack>
          </VStack>
        </Box>
      </Box>

      <Separator />

      {/* Grid encabezados */}
      <Box>
        <HStack justify="space-between" mb="2">
          <HStack>
            <Text textStyle="sm" color="fg.muted">Registros</Text>
            <Badge colorPalette="gray">{rows.length}</Badge>
          </HStack>
        </HStack>

        <Box borderWidth="1px" borderColor="border" rounded="md" overflow="hidden">
          {/* Header */}
          <Box bg="bg.subtle" borderBottomWidth="1px" p="2">
            <HStack fontWeight="semibold" color="fg.muted">
              <Box flex="2">Contacto</Box>
              <Box flex="2">Asunto</Box>
              <Box flex="1">Estado</Box>
              <Box flex="1">Prioridad</Box>
              <Box flex="1">Categoría</Box>
              <Box flex="1">Asignado</Box>
              <Box flex="2">Última actividad</Box>
              <Box w="96px" textAlign="right">Acciones</Box>
            </HStack>
          </Box>

          {/* Rows */}
          <VStack align="stretch" spacing="0">
            {loading && (
              <Box p="3" color="fg.muted">Cargando…</Box>
            )}
            {!loading && error && (
              <Box p="3" color="fg.muted">{error}</Box>
            )}
            {!loading && !error && pageRows.length === 0 && (
              <Box p="3" color="fg.muted">No hay resultados.</Box>
            )}
            {!loading && !error && pageRows.map((r) => {
              const statusColor =
                r.status === "open" ? "blue" :
                r.status === "in_progress" ? "yellow" :
                r.status === "resolved" ? "green" : "gray"
              return (
                <Box key={r.id} borderTopWidth="1px" _first={{ borderTopWidth: "0px" }}>
                  <HStack p="2" _hover={{ bg: "bg.muted" }} cursor="pointer" onDoubleClick={() => onOpen(r)}>
                    <Box flex="1">
                      <Text noOfLines={1}>{r.openedBy.orgLegalName}</Text>
                      <Text textStyle="xs" color="fg.muted">{r.openedBy.email ?? "—"}</Text>
                      </Box>
                    <Box flex="2">
                      <Text noOfLines={1}>{r.subject}</Text>
                      <Text textStyle="xs" color="fg.muted">user: {r.userId ?? "—"} • org: {r.orgId ?? "—"}</Text>
                    </Box>
                    <Box flex="1"><Badge colorPalette={statusColor}>{r.status}</Badge></Box>
                    <Box flex="1">{r.priority ? <Badge colorPalette="gray">{r.priority}</Badge> : "—"}</Box>
                    <Box flex="1">{r.category ?? "—"}</Box>
                    <Box flex="1">{r.assignedToUserId ?? "—"}</Box>
                    <Box flex="2">
                      <Text textStyle="xs" color="fg.muted">
                        {r.lastMessageAtUtc ? new Date(r.lastMessageAtUtc).toLocaleString() :
                          r.updatedAtUtc ? new Date(r.updatedAtUtc).toLocaleString() :
                          new Date(r.createdAtUtc).toLocaleString()}
                      </Text>
                    </Box>
                    <Box w="96px" textAlign="right">
                      <Button size="xs" variant="subtle" onClick={() => onOpen(r)}>Ver</Button>
                    </Box>
                  </HStack>
                </Box>
              )
            })}
          </VStack>
        </Box>

        {/* Paginación */}
        <HStack justify="space-between" mt="3">
          <Text textStyle="sm" color="fg.muted">Página {page} de {totalPages}</Text>
          <HStack>
            <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Anterior</Button>
            <Button size="sm" variant="ghost" disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>Siguiente</Button>
          </HStack>
        </HStack>
      </Box>

      {/* Dialogo de Detalle */}
      {dialogOpen && selected && (
        <TicketAdminDialog
          open={dialogOpen}
          onClose={onClose}
          ticketId={selected.id}
          subject={selected.subject}
          initialStatus={selected.status}
          initialPriority={selected.priority}
          initialCategory={selected.category}
          assignedToUserId={selected.assignedToUserId}
          onChanged={fetchData}
        />
      )}
    </VStack>
  )
}
