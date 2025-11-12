// src/app/notifications/NotificationsAdminPage.jsx
import { useEffect, useMemo, useRef, useState } from "react"
import {
  Heading, HStack, Button, ButtonGroup, IconButton,
  Box, Badge, Text, Input, Spacer, Spinner,
  Dialog, Portal, Table, Select,
} from "@chakra-ui/react"
import { FiPlus, FiEdit2, FiTrash2, FiRefreshCw, FiSearch } from "react-icons/fi"
import { AdminNotificationsApi } from "../api/adminNotificationsApi"
import NotificationDialog from "./NotificationDialog"
import { toaster } from "../components/ui/toaster"
import { Tip } from "../components/ui/tooltip"

function getErrorMessage(error) {
  const data = error?.response?.data
  if (typeof data === "string") return data
  if (data?.message) return data.message
  return error?.message || "Error"
}

const KIND_BADGE = {
  info: "gray",
  success: "green",
  warning: "yellow",
  urgent: "red",
}

export default function NotificationsAdminPage() {
  const [loading, setLoading] = useState(true)
  const [allRows, setAllRows] = useState([])
  const [rows, setRows] = useState([])
  const [selectedId, setSelectedId] = useState(null)

  // filtros / búsqueda
  const [search, setSearch] = useState("")
  const [activeOnly, setActiveOnly] = useState(true) // publicadas y no expiradas
  const [audienceFilter, setAudienceFilter] = useState("") // '', 'all', 'org', 'user', 'role'

  // paginación (client-side)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  const [formOpen, setFormOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const cancelBtnRef = useRef(null)

  const selectedRow = useMemo(
    () => rows.find((r) => r.id === selectedId) || null,
    [rows, selectedId]
  )

  async function load(opts = {}) {
    setLoading(true)
    try {
      const data = await AdminNotificationsApi.list({
        activeOnly,
        audience: audienceFilter || undefined,
        q: search,
        top: 500,
      })
      setAllRows(data)
      // aplicar paginación en memoria
      setSelectedId(null)
      setPage((p) => 1) // a página 1 después de recargar filtros/búsqueda
    } catch (error) {
      toaster.error({ title: "No se pudo cargar", description: getErrorMessage(error) })
    } finally {
      setLoading(false)
    }
  }

  // carga inicial
  useEffect(() => { load() /* eslint-disable-line react-hooks/exhaustive-deps */ }, [])

  // recargar cuando cambien filtros (mantiene UX de Disciplines)
  useEffect(() => {
    load({ keepSelection: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOnly, audienceFilter])

  // aplicar búsqueda + paginado en memoria
  const filtered = useMemo(() => {
    const q = (search || "").trim().toLowerCase()
    let arr = allRows
    if (q) {
      arr = arr.filter(r =>
        (r.title || "").toLowerCase().includes(q) ||
        (r.body || "").toLowerCase().includes(q)
      )
    }
    return arr
  }, [allRows, search])

  const total = filtered.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = total === 0 ? 0 : Math.min(page * pageSize, total)

  useEffect(() => {
    const start = (page - 1) * pageSize
    setRows(filtered.slice(start, start + pageSize))
  }, [filtered, page, pageSize])

  const onNew = () => { setSelectedId(null); setFormOpen(true) }
  const onEdit = () => { if (selectedId) setFormOpen(true) }

  // “Borrar” → acción segura: expirar ya (no hay DELETE en backend)
  async function onExpireNow() {
    if (!selectedId) return
    try {
      await AdminNotificationsApi.expireNow(selectedId)
      toaster.success({ title: "Expirada", description: "La notificación fue expirada." })
      await load()
    } catch (error) {
      toaster.error({ title: "No se pudo expirar", description: getErrorMessage(error) })
    } finally {
      setDeleteOpen(false)
    }
  }

  async function onSubmitForm() {
    // delegado al dialog vía onSaved -> load()
  }

  return (
    <>
      <HStack mb={4} align="center" wrap="wrap">
        <Heading size="md">Notificaciones</Heading>
        <Spacer />

        <HStack
          as="form"
          onSubmit={(e) => { e.preventDefault(); setPage(1); load({ keepSelection: true }) }}
          gap="2"
        >
          {/* Filtro ActiveOnly */}
          <select
            value={activeOnly ? "1" : "0"}
            onChange={(e) => { setActiveOnly(e.target.value === "1"); setPage(1) }}
            aria-label="Estado"
            style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid var(--chakra-colors-border)", fontSize: 14 }}
          >
            <option value="1">Publicadas activas</option>
            <option value="0">Todas</option>
          </select>

          {/* Filtro audiencia */}
          <select
            value={audienceFilter}
            onChange={(e) => { setAudienceFilter(e.target.value); setPage(1) }}
            aria-label="Audiencia"
            style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid var(--chakra-colors-border)", fontSize: 14 }}
          >
            <option value="">Todas las audiencias</option>
            <option value="all">Todos</option>
            <option value="org">Organización</option>
            <option value="user">Usuario</option>
            <option value="role">Rol</option>
          </select>

          {/* Tamaño de página */}
          <select
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }}
            aria-label="Elementos por página"
            style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid var(--chakra-colors-border)", fontSize: 14 }}
          >
            <option value="10">10</option>
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>

          {/* Búsqueda */}
          <Input
            size="sm"
            placeholder="Buscar (título o cuerpo)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            width="280px"
          />

          <Tip label="Buscar">
            <IconButton type="submit" aria-label="Buscar" size="sm">
              <FiSearch />
            </IconButton>
          </Tip>

          <Tip label="Recargar">
            <IconButton aria-label="Recargar" size="sm" onClick={() => load({ keepSelection: true })}>
              <FiRefreshCw />
            </IconButton>
          </Tip>
        </HStack>
      </HStack>

      <HStack mb={3}>
        <ButtonGroup>
          <Button leftIcon={<FiPlus />} onClick={onNew} colorPalette="blue" size="sm">Nuevo</Button>
          <Button leftIcon={<FiEdit2 />} onClick={onEdit} size="sm" disabled={!selectedId}>Editar</Button>
          <Button leftIcon={<FiTrash2 />} onClick={() => setDeleteOpen(true)} size="sm" colorPalette="red" disabled={!selectedId}>
            Borrar
          </Button>
        </ButtonGroup>
        {selectedId && (
          <Box ml={4} color="fg.muted" fontSize="sm">
            Seleccionado: <b>{rows.find(r => r.id === selectedId)?.title}</b>
          </Box>
        )}
      </HStack>

      <Box borderWidth="1px" borderRadius="md" overflow="hidden">
        <Table.Root size="sm" variant="outline">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeader minW="220px">Título</Table.ColumnHeader>
              <Table.ColumnHeader>Tipo</Table.ColumnHeader>
              <Table.ColumnHeader>Audiencia</Table.ColumnHeader>
              <Table.ColumnHeader minW="160px">Publicación</Table.ColumnHeader>
              <Table.ColumnHeader minW="160px">Expira</Table.ColumnHeader>
            </Table.Row>
          </Table.Header>

          <Table.Body>
            {loading ? (
              <Table.Row>
                <Table.Cell colSpan={5}>
                  <HStack py="6" justify="center" color="fg.muted">
                    <Spinner /> <Text>Cargando…</Text>
                  </HStack>
                </Table.Cell>
              </Table.Row>
            ) : rows.length === 0 ? (
              <Table.Row>
                <Table.Cell colSpan={5}>
                  <Box py="6" textAlign="center" color="fg.muted">Sin resultados</Box>
                </Table.Cell>
              </Table.Row>
            ) : (
              rows.map((r) => {
                const isSelected = r.id === selectedId
                return (
                  <Table.Row
                    key={r.id}
                    onClick={() => setSelectedId(isSelected ? null : r.id)}
                    onDoubleClick={() => { setSelectedId(r.id); onEdit() }}
                    data-selected={isSelected ? "true" : undefined}
                    bg={isSelected ? "blue.50" : undefined}
                    _hover={{ bg: "gray.50", cursor: "pointer" }}
                  >
                    <Table.Cell>
                      <Text fontWeight="600" noOfLines={1}>{r.title}</Text>
                      <Text color="fg.muted" textStyle="xs" noOfLines={1}>{(r.body || "").slice(0, 120)}</Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge colorPalette={KIND_BADGE[r.kind] || "gray"}>
                        {r.kind}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge colorPalette="gray">{r.audience}</Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <Text textStyle="xs" color="fg.muted">
                        {r.publishedAtUtc ? new Date(r.publishedAtUtc).toLocaleString() : "—"}
                      </Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Text textStyle="xs" color="fg.muted">
                        {r.expiresAtUtc ? new Date(r.expiresAtUtc).toLocaleString() : "—"}
                      </Text>
                    </Table.Cell>
                  </Table.Row>
                )
              })
            )}
          </Table.Body>
        </Table.Root>
      </Box>

      {/* Pie: paginación */}
      <HStack mt="3" justify="space-between" wrap="wrap" gap="2">
        <Text textStyle="sm" color="fg.muted">Mostrando {from}–{to} de {total}</Text>
        <HStack>
          <Button size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>Anterior</Button>
          <Text textStyle="sm">Página {page} / {totalPages}</Text>
          <Button size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>Siguiente</Button>
        </HStack>
      </HStack>

      {/* Dialog crear/editar */}
      <NotificationDialog
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={() => load({ keepSelection: true })}
        initialValues={
          selectedRow
            ? {
                id: selectedRow.id,
                title: selectedRow.title,
                body: selectedRow.body || "",
                kind: selectedRow.kind || "info",
                audience: selectedRow.audience || "all",
                audienceValue: selectedRow.audienceValue || "",
                publishedAtUtc: selectedRow.publishedAtUtc || null,
                expiresAtUtc: selectedRow.expiresAtUtc || null,
                actionUrl: selectedRow.actionUrl || null,
                actionLabel: selectedRow.actionLabel || null,
              }
            : undefined
        }
      />

      {/* Confirmación de “Borrar” → expirar ya */}
      <Dialog.Root
        role="alertdialog"
        open={deleteOpen}
        onOpenChange={(e) => setDeleteOpen(e.open)}
        initialFocusEl={() => cancelBtnRef.current}
        placement="center"
      >
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>Expirar notificación</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                ¿Seguro que deseas <b>expirar ahora</b> la notificación
                <br />
                <b>{selectedRow?.title}</b>?
              </Dialog.Body>
              <Dialog.Footer>
                <Button ref={cancelBtnRef} onClick={() => setDeleteOpen(false)}>Cancelar</Button>
                <Button colorPalette="red" onClick={onExpireNow} ml={3}>Expirar ya</Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </>
  )
}
