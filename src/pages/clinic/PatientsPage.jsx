// src/pages/clinic/PatientsPage.jsx
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Heading, HStack, Button, ButtonGroup, IconButton,
  Box, Badge, Text, Input, Spacer, Spinner, Dialog, Portal, Table,
} from '@chakra-ui/react'
import { useLocation, useNavigate } from 'react-router-dom'
import { FiPlus, FiEdit2, FiTrash2, FiRefreshCw, FiSearch } from 'react-icons/fi'
import { PatientsApi } from '../../api/patientsApi'
import PatientDialog from './PatientDialog'
import { toaster } from '../../components/ui/toaster'
import { Tip } from '../../components/ui/tooltip'

function getErrorMessage(error) {
  const data = error?.response?.data
  if (typeof data === 'string') return data
  if (data?.message) return data.message
  return error?.message || 'Error'
}

function fullName(p) {
  return [p.firstName, p.lastName1, p.lastName2].filter(Boolean).join(' ')
}

export default function PatientsPage() {
  const navigate = useNavigate()
  const location = useLocation()

  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState([])
  const [selectedId, setSelectedId] = useState(null)

  // filtros / búsqueda
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState('') // ''=todas, '1'=activas, '0'=inactivas

  // paginación
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [total, setTotal] = useState(0)

  // modales (botones)
  const [formOpen, setFormOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const cancelBtnRef = useRef(null)

  const selectedRow = useMemo(
    () => rows.find((r) => r.id === selectedId) || null,
    [rows, selectedId]
  )

  // Deep-link del diálogo (abrir historial)
  const params = new URLSearchParams(location.search)
  const qsOpenId = params.get('openPatientId')
  const qsTab = params.get('tab') || 'datos'
  const qsCloseDialog = params.get('closeDialog') === '1'

  const fromUrlRow = useMemo(
    () => rows.find(r => String(r.id) === String(qsOpenId)) || null,
    [rows, qsOpenId]
  )

  // si viene openPatientId y NO closeDialog=1, abrimos el diálogo
  const openFromUrl = !!qsOpenId && !qsCloseDialog
  const dialogIsOpen = formOpen || openFromUrl

  // initial values/tab del diálogo
  const dialogInitialValues = formOpen ? (selectedRow || undefined) : (fromUrlRow || undefined)
  const dialogInitialTab = formOpen ? 'datos' : qsTab

  // cerrar diálogo: cierra modal y limpia la query
  const handleDialogClose = () => {
    setFormOpen(false)
    setSelectedId(null)
    const u = new URL(window.location.href)
    u.searchParams.delete('openPatientId')
    u.searchParams.delete('tab')
    u.searchParams.delete('closeDialog')
    const next = u.pathname + (u.searchParams.toString() ? `?${u.searchParams.toString()}` : '')
    navigate(next, { replace: true })
  }

  // cargar
  async function load(opts = {}) {
    setLoading(true)
    try {
      const data = await PatientsApi.list({
        page,
        pageSize,
        search,
        active: activeFilter === '' ? undefined : activeFilter === '1',
      })
      setRows(data?.items || [])
      setTotal(data?.total ?? 0)
      if (!opts.keepSelection) setSelectedId(null)
    } catch (error) {
      toaster.error({ title: 'No se pudo cargar', description: getErrorMessage(error) })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, []) // init
  useEffect(() => { load({ keepSelection: true }) }, [page, pageSize, activeFilter]) // eslint-disable-line

  const onNew = () => { setSelectedId(null); setFormOpen(true) }
  const onEdit = () => { if (selectedId) setFormOpen(true) }
  const onDelete = () => { if (selectedId) setDeleteOpen(true) }

  // ⬇⬇⬇  🟢 FALTA QUE PROVOCÓ EL ERROR: onSubmitForm  ⬇⬇⬇
  async function onSubmitForm(payload) {
    try {
      if (selectedRow) {
        await PatientsApi.update(selectedRow.id, payload)
        toaster.success({ title: 'Súper', description: 'Paciente actualizado' })
        await load({ keepSelection: true })
      } else {
        await PatientsApi.create(payload)
        toaster.success({ title: 'Súper', description: 'Paciente creado' })
        setPage(1)
        await load()
      }
      setFormOpen(false)
    } catch (error) {
      let msg = getErrorMessage(error)
      if (/identificaci[oó]n ya existe/i.test(msg)) msg = 'Ya existe un paciente con ese número de identificación.'
      toaster.error({ title: 'Error al guardar', description: msg })
    }
  }
  // ⬆⬆⬆  🟢 FIN onSubmitForm  ⬆⬆⬆

  async function confirmDelete() {
    try {
      await PatientsApi.remove(selectedId)
      toaster.success({ title: 'Súper', description: 'Paciente eliminado' })
      const remaining = rows.length - 1
      const newTotal = total - 1
      const totalPages = Math.max(1, Math.ceil(newTotal / pageSize))
      if (remaining === 0 && page > 1 && page > totalPages) {
        setPage(page - 1)
      } else {
        await load()
      }
    } catch (error) {
      toaster.error({ title: 'No se pudo eliminar', description: getErrorMessage(error) })
    } finally {
      setDeleteOpen(false)
    }
  }

  // pie de tabla
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = total === 0 ? 0 : Math.min(page * pageSize, total)

  // líneas verticales sutiles (mejor legibilidad)
  const columnDividerSx = {
    'thead th:not(:first-of-type), tbody td:not(:first-of-type)': {
      borderLeft: '1px solid',
      borderColor: 'blackAlpha.200',
    },
  }

  return (
    <>
      <HStack mb={4} align="center" wrap="wrap">
        <Heading size="md">Pacientes</Heading>
        <Spacer />
        <HStack
          as="form"
          onSubmit={(e) => { e.preventDefault(); setPage(1); load() }}
          gap="2"
        >
          {/* Filtro estado */}
          <select
            value={activeFilter}
            onChange={(e) => { setActiveFilter(e.target.value); setPage(1) }}
            aria-label="Estado"
            style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid var(--chakra-colors-border)', fontSize: 14 }}
          >
            <option value="">Todos</option>
            <option value="1">Activos</option>
            <option value="0">Inactivos</option>
          </select>

          {/* Tamaño de página */}
          <select
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }}
            aria-label="Elementos por página"
            style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid var(--chakra-colors-border)', fontSize: 14 }}
          >
            <option value="10">10</option>
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>

          {/* Búsqueda */}
          <Input
            size="sm"
            placeholder="Buscar por nombre o identificación"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            width="260px"
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
          <Button leftIcon={<FiTrash2 />} onClick={onDelete} size="sm" colorPalette="red" disabled={!selectedId}>Borrar</Button>
        </ButtonGroup>
        {selectedRow && (
          <Box ml={4} color="fg.muted" fontSize="sm">
            Seleccionado: <b>{selectedRow.identificationNumber}</b> — {fullName(selectedRow)}
          </Box>
        )}
      </HStack>

      <Box borderWidth="1px" borderRadius="md" overflow="hidden">
        <Table.Root size="sm" variant="outline" sx={columnDividerSx}>
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeader minW="160px">Identificación</Table.ColumnHeader>
              <Table.ColumnHeader>Nombre</Table.ColumnHeader>
              <Table.ColumnHeader minW="120px">Sexo</Table.ColumnHeader>
              <Table.ColumnHeader minW="140px">Contacto</Table.ColumnHeader>
              <Table.ColumnHeader minW="100px">Estado</Table.ColumnHeader>
              <Table.ColumnHeader minW="220px">Actualización</Table.ColumnHeader>
            </Table.Row>
          </Table.Header>

          <Table.Body>
            {loading ? (
              <Table.Row>
                <Table.Cell colSpan={6}>
                  <HStack py="6" justify="center" color="fg.muted">
                    <Spinner /> <Text>Cargando…</Text>
                  </HStack>
                </Table.Cell>
              </Table.Row>
            ) : rows.length === 0 ? (
              <Table.Row>
                <Table.Cell colSpan={6}>
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
                    data-selected={isSelected ? 'true' : undefined}
                    bg={isSelected ? 'blue.50' : undefined}
                    _hover={{ bg: 'gray.50', cursor: 'pointer' }}
                  >
                    <Table.Cell>
                      <Text fontWeight="600">
                        {r.identificationNumber}
                      </Text>
                      <Text textStyle="xs" color="fg.muted">
                        {r.identificationType.toUpperCase()}
                      </Text>
                    </Table.Cell>
                    <Table.Cell>{fullName(r)}</Table.Cell>
                    <Table.Cell>{r.sex || '-'}</Table.Cell>
                    <Table.Cell>
                      <Text>{r.contactEmail || '-'}</Text>
                      <Text textStyle="xs" color="fg.muted">{r.contactPhone || ''}</Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge colorPalette={r.isActive ? 'green' : 'gray'}>
                        {r.isActive ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <Text textStyle="xs" color="fg.muted">
                        {new Date(r.updatedAt || r.createdAt).toLocaleString()}
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
        <Text textStyle="sm" color="fg.muted">
          Mostrando {from}–{to} de {total}
        </Text>

        <HStack>
          <Button
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            Anterior
          </Button>
          <Text textStyle="sm">Página {page} / {totalPages}</Text>
          <Button
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
          >
            Siguiente
          </Button>
        </HStack>
      </HStack>

      {/* Dialog crear/editar (botones) o deep-link */}
      <PatientDialog
        isOpen={dialogIsOpen}
        onClose={handleDialogClose}
        onSubmit={onSubmitForm}
        initialTab={dialogInitialTab}
        initialValues={dialogInitialValues}
      />

      {/* Confirmación de borrado */}
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
                <Dialog.Title>Eliminar paciente</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                ¿Seguro que deseas eliminar <b>{selectedRow?.identificationNumber}</b> — {selectedRow ? fullName(selectedRow) : ''}? Esta acción no se puede deshacer.
              </Dialog.Body>
              <Dialog.Footer>
                <Button ref={cancelBtnRef} onClick={() => setDeleteOpen(false)}>Cancelar</Button>
                <Button colorPalette="red" onClick={confirmDelete} ml={3}>Eliminar</Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </>
  )
}
