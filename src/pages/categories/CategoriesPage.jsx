// src/app/categories/CategoriesPage.jsx
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Heading, HStack, Button, ButtonGroup, IconButton,
  Box, Badge, Text, Input, Spacer, Spinner,
  Dialog, Portal, Table,
} from '@chakra-ui/react'
import { FiPlus, FiEdit2, FiTrash2, FiRefreshCw, FiSearch } from 'react-icons/fi'
import { CategoriesApi } from '../../api/categoriesApi'
import { DisciplinesApi } from '../../api/disciplinesApi'
import CategoryDialog from './CategoryDialog'
import { toaster } from '../../components/ui/toaster'
import { Tip } from '../../components/ui/tooltip'

function getErrorMessage(error) {
  const data = error?.response?.data
  if (typeof data === 'string') return data
  if (data?.message) return data.message
  return error?.message || 'Error'
}

export default function CategoriesPage() {
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState([])
  const [selectedId, setSelectedId] = useState(null)

  // filtros / búsqueda
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState('') // ''=todas, '1'=activas, '0'=inactivas
  const [disciplineFilter, setDisciplineFilter] = useState('') // ''=todas

  // paginación
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [total, setTotal] = useState(0)

  // data auxiliar
  const [disciplines, setDisciplines] = useState([])

  // modales
  const [formOpen, setFormOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const cancelBtnRef = useRef(null)

  const selectedRow = useMemo(
    () => rows.find((r) => r.id === selectedId) || null,
    [rows, selectedId]
  )

  const discMap = useMemo(() => {
    const m = new Map()
    for (const d of disciplines) m.set(d.id, d)
    return m
  }, [disciplines])

  async function loadDisciplines() {
    try {
      const data = await DisciplinesApi.list({ page: 1, pageSize: 1000 })
      setDisciplines(data?.items || [])
    } catch (error) {
      toaster.error({ title: 'No se pudieron cargar disciplinas', description: getErrorMessage(error) })
    }
  }

  async function load(opts = {}) {
    setLoading(true)
    try {
      const data = await CategoriesApi.list({
        page,
        pageSize,
        search,
        active: activeFilter === '' ? undefined : activeFilter === '1',
        disciplineId: disciplineFilter ? Number(disciplineFilter) : undefined,
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

  // carga inicial
  useEffect(() => {
    loadDisciplines()
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // recargar cuando cambie paginación o filtros
  useEffect(() => {
    load({ keepSelection: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, activeFilter, disciplineFilter])

  const onNew = () => { setSelectedId(null); setFormOpen(true) }
  const onEdit = () => { if (selectedId) setFormOpen(true) }
  const onDelete = () => { if (selectedId) setDeleteOpen(true) }

  async function confirmDelete() {
    try {
      await CategoriesApi.remove(selectedId)
      toaster.success({ title: 'Súper', description: 'Categoría eliminada' })
      // si borramos el último ítem visible, retrocede de página si aplica
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

  async function onSubmitForm(payload) {
    try {
      if (payload.id && payload.id > 0) {
        await CategoriesApi.update(payload.id, {
          name: payload.name,
          description: payload.description,
          isActive: payload.isActive,
        })
        toaster.success({ title: 'Súper', description: 'Categoría actualizada' })
        await load({ keepSelection: true })
      } else {
        await CategoriesApi.create({
          disciplineId: payload.disciplineId,
          code: payload.code,
          name: payload.name,
          description: payload.description,
          isActive: payload.isActive,
        })
        toaster.success({ title: 'Súper', description: 'Categoría creada' })
        // tras crear, volvemos a la primera página
        setPage(1)
        await load()
      }
      setFormOpen(false)
    } catch (error) {
      let msg = getErrorMessage(error)
      if (/c[oó]digo ya existe/i.test(msg)) msg = 'Ya existe una categoría con ese código en esa disciplina.'
      if (/disciplina no existe/i.test(msg)) msg = 'La disciplina seleccionada no existe.'
      toaster.error({ title: 'Error al guardar', description: msg })
    }
  }

  // pie de tabla
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = total === 0 ? 0 : Math.min(page * pageSize, total)

  return (
    <>
      <HStack mb={4} align="center" wrap="wrap">
        <Heading size="md">Categorías</Heading>
        <Spacer />
        <HStack
          as="form"
          onSubmit={(e) => { e.preventDefault(); setPage(1); load() }}
          gap="2"
        >
          {/* Filtro Disciplina */}
          <select
            value={disciplineFilter}
            onChange={(e) => { setDisciplineFilter(e.target.value); setPage(1) }}
            aria-label="Disciplina"
            style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid var(--chakra-colors-border)', fontSize: 14 }}
          >
            <option value="">Todas las disciplinas</option>
            {disciplines.map(d => (
              <option key={d.id} value={d.id}>{d.code} — {d.name}</option>
            ))}
          </select>

          {/* Filtro estado */}
          <select
            value={activeFilter}
            onChange={(e) => { setActiveFilter(e.target.value); setPage(1) }}
            aria-label="Estado"
            style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid var(--chakra-colors-border)', fontSize: 14 }}
          >
            <option value="">Todas</option>
            <option value="1">Activas</option>
            <option value="0">Inactivas</option>
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
            placeholder="Buscar (código o nombre)"
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
            Seleccionado: <b>{selectedRow.code}</b> — {selectedRow.name}
          </Box>
        )}
      </HStack>

      <Box borderWidth="1px" borderRadius="md" overflow="hidden">
        <Table.Root size="sm" variant="outline">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeader minW="140px">Código</Table.ColumnHeader>
              <Table.ColumnHeader>Nombre</Table.ColumnHeader>
              <Table.ColumnHeader minW="200px">Disciplina</Table.ColumnHeader>
              <Table.ColumnHeader>Descripción</Table.ColumnHeader>
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
                const d = discMap.get(r.disciplineId)
                return (
                  <Table.Row
                    key={r.id}
                    onClick={() => setSelectedId(isSelected ? null : r.id)}
                    onDoubleClick={() => { setSelectedId(r.id); onEdit() }}
                    data-selected={isSelected ? 'true' : undefined}
                    bg={isSelected ? 'blue.50' : undefined}
                    _hover={{ bg: 'gray.50', cursor: 'pointer' }}
                  >
                    <Table.Cell><Text fontWeight="600">{r.code}</Text></Table.Cell>
                    <Table.Cell>{r.name}</Table.Cell>
                    <Table.Cell>{d ? `${d.code} — ${d.name}` : r.disciplineId}</Table.Cell>
                    <Table.Cell>{r.description}</Table.Cell>
                    <Table.Cell>
                      <Badge colorPalette={r.isActive ? 'green' : 'gray'}>
                        {r.isActive ? 'Activa' : 'Inactiva'}
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

      {/* Dialog crear/editar */}
      <CategoryDialog
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={onSubmitForm}
        disciplines={disciplines}
        initialValues={
          selectedRow
            ? {
                id: selectedRow.id,
                disciplineId: selectedRow.disciplineId,
                code: selectedRow.code,
                name: selectedRow.name,
                description: selectedRow.description || '',
                isActive: selectedRow.isActive
              }
            : undefined
        }
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
                <Dialog.Title>Eliminar categoría</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                ¿Seguro que deseas eliminar <b>{selectedRow?.code}</b> — {selectedRow?.name}? Esta acción no se puede deshacer.
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
