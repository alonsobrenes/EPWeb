// src/pages/admin/TestsPage.jsx
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Heading, HStack, Button, ButtonGroup, IconButton,
  Box, Badge, Text, Input, Spacer, Spinner,
  Dialog, Portal, Table,
} from '@chakra-ui/react'
import { FiPlus, FiEdit2, FiTrash2, FiRefreshCw, FiSearch, FiExternalLink } from 'react-icons/fi'
import { toaster } from '../../components/ui/toaster'
import { Tip } from '../../components/ui/tooltip'
import { TestsApi } from '../../api/testsApi'
import client from '../../api/client'

function getErrorMessage(error) {
  const data = error?.response?.data
  if (typeof data === 'string') return data
  if (data?.message) return data.message
  return error?.message || 'Error'
}

function toApiUrl(u) {
  if (!u) return null
  try {
    return new URL(u, client.defaults.baseURL).href
  } catch {
    return u
  }
}

export default function TestsPage() {
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState([])
  const [selectedId, setSelectedId] = useState(null)

  const [search, setSearch] = useState('')

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [total, setTotal] = useState(0)

  const [deleteOpen, setDeleteOpen] = useState(false)
  const cancelBtnRef = useRef(null)

  const selectedRow = useMemo(
    () => rows.find((r) => r.id === selectedId) || null,
    [rows, selectedId]
  )

  async function load(opts = {}) {
    setLoading(true)
    try {
      const data = await TestsApi.list({
        page,
        pageSize,
        search: search || undefined,
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

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    load({ keepSelection: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize])

  const onNew = () => navigate('/app/tests/new')
  const onEdit = () => { if (selectedId) navigate(`/app/tests/${selectedId}`) }
  const onDelete = () => { if (selectedId) setDeleteOpen(true) }

  async function confirmDelete() {
    try {
      await TestsApi.remove(selectedId)
      toaster.success({ title: 'Test eliminado' })
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

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = total === 0 ? 0 : Math.min(page * pageSize, total)

  return (
    <>
      <HStack mb={4} align="center" wrap="wrap">
        <Heading size="md">Tests</Heading>
        <Spacer />
        <HStack
          as="form"
          onSubmit={(e) => { e.preventDefault(); setPage(1); load() }}
          gap="2"
        >
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
              <Table.ColumnHeader minW="160px">Grupo edad</Table.ColumnHeader>
              <Table.ColumnHeader>Descripción</Table.ColumnHeader>
              <Table.ColumnHeader minW="100px">Estado</Table.ColumnHeader>
              <Table.ColumnHeader minW="140px">PDF</Table.ColumnHeader>
              <Table.ColumnHeader minW="220px">Actualización</Table.ColumnHeader>
            </Table.Row>
          </Table.Header>

          <Table.Body>
            {loading ? (
              <Table.Row>
                <Table.Cell colSpan={7}>
                  <HStack py="6" justify="center" color="fg.muted">
                    <Spinner /> <Text>Cargando…</Text>
                  </HStack>
                </Table.Cell>
              </Table.Row>
            ) : rows.length === 0 ? (
              <Table.Row>
                <Table.Cell colSpan={7}>
                  <Box py="6" textAlign="center" color="fg.muted">Sin resultados</Box>
                </Table.Cell>
              </Table.Row>
            ) : (
              rows.map((r) => {
                const isSelected = r.id === selectedId
                const pdfHref = toApiUrl(r.pdfUrl)
                return (
                  <Table.Row
                    key={r.id}
                    onClick={() => setSelectedId(isSelected ? null : r.id)}
                    onDoubleClick={() => navigate(`/app/tests/${r.id}`)}
                    data-selected={isSelected ? 'true' : undefined}
                    bg={isSelected ? 'blue.50' : undefined}
                    _hover={{ bg: 'gray.50', cursor: 'pointer' }}
                  >
                    <Table.Cell><Text fontWeight="600">{r.code}</Text></Table.Cell>
                    <Table.Cell>{r.name}</Table.Cell>
                    <Table.Cell>{r.ageGroupName}</Table.Cell>
                    <Table.Cell>{r.description}</Table.Cell>
                    <Table.Cell>
                      <Badge colorPalette={r.isActive ? 'green' : 'gray'}>
                        {r.isActive ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      {pdfHref ? (
                        <a href={pdfHref} target="_blank" rel="noreferrer" title="Abrir PDF">
                          <HStack as="span" gap="1">
                            <FiExternalLink /> <Text textStyle="xs">Abrir</Text>
                          </HStack>
                        </a>
                      ) : (
                        <Text textStyle="xs" color="fg.muted">—</Text>
                      )}
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
                <Dialog.Title>Eliminar test</Dialog.Title>
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
