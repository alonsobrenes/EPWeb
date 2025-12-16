// src/pages/clinic/ProfessionalsPage.jsx
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Heading, HStack, Button, ButtonGroup, IconButton,
  Box, Badge, Text, Input, Spacer, Spinner, Dialog, Portal, Table,
  Field, VStack, Avatar, NativeSelect,
} from '@chakra-ui/react'
import { useLocation } from 'react-router-dom'
import { FiPlus, FiRefreshCw, FiSearch, FiTrash2, FiEdit2 } from 'react-icons/fi'
import client, { apiOrigin } from "../../api/client"
import { toaster } from '../../components/ui/toaster'
import { Tip } from '../../components/ui/tooltip'
import ProfessionalDialog from './ProfessionalDialog'


function getErrorMessage(error) {
  const data = error?.response?.data
  if (data && typeof data === 'object') {
    if (typeof data.detail === 'string' && data.detail.trim().length > 0) return data.detail
    if (typeof data.message === 'string' && data.message.trim().length > 0) return data.message
    if (data.title) {
      const status = data.status || error?.response?.status
      return status ? `${data.title} (${status})` : `${data.title}`
    }
  }
  if (typeof data === 'string') return data
  return error?.message || 'Error'
}

const OrgApi = {
  async listMembers() {
    const { data } = await client.get('/orgs/members')
    return data
  },
  async listInvitations(status = 'pending') {
    const { data } = await client.get('/orgs/invitations', { params: { status } })
    return data
  },
  async createInvitation(payload) {
    const { data } = await client.post('/orgs/invitations', payload)
    return data
  },
  async revokeInvitation(id) {
    await client.delete(`/orgs/invitations/${id}`)
  },
  async getSummary() {
    const { data } = await client.get('/orgs/current/summary')
    return data
  },
  async removeMember(userId) {
    await client.delete(`/orgs/members/${userId}`)
  },
  async listLabelsForProfessional(userId) {
    const { data } = await client.get('/labels/for', { params: { type: 'professional', id: userId } })
    return Array.isArray(data.items) ? data.items : []
  }
}

function initialsFromEmail(email) {
  if (!email) return 'U'
  const left = email.split('@')[0] || ''
  if (!left) return 'U'
  const parts = left.replace(/[._-]+/g, ' ').trim().split(/\s+/)
  const first = parts[0]?.[0] || ''
  const second = parts[1]?.[0] || ''
  return (first + second || first || 'U').toUpperCase()
}

function textColorForHex(hex) {
  // hex: "#RRGGBB" o "RRGGBB"
  const h = (hex || '').replace('#', '')
  if (h.length !== 6) return 'white'
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  // luminancia perceptual simple
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b)
  return luminance > 150 ? 'black' : 'white'
}

function absolutizeApiUrl(url) {
  if (!url) return ""
  if (/^https?:\/\//i.test(url)) return url
  const origin = apiOrigin()
  return origin ? origin + (url.startsWith("/") ? "" : "/") + url : url
}

function SecureAvatar({ avatarUrl, initials, size = "sm", alt = "Avatar" }) {
  const [avatarImageUrl, setAvatarImageUrl] = useState("")
  const [loadingAvatarImage, setLoadingAvatarImage] = useState(false)

  useEffect(() => {
    setAvatarImageUrl("")
    if (!avatarUrl) return

    async function fetchAvatar() {
      try {
        setLoadingAvatarImage(true)

        const res = await client.get(absolutizeApiUrl(avatarUrl), { responseType: "blob" })

        const reader = new FileReader()
        reader.readAsDataURL(res.data)

        reader.onloadend = function () {
          const base64data = reader.result
          setAvatarImageUrl(base64data)
          try { window.dispatchEvent(new Event("ep:profile-updated")) } catch {}
        }
      } catch (err) {
        console.error("Error cargando avatar:", err)
      } finally {
        setLoadingAvatarImage(false)
      }
    }
  
    fetchAvatar()
  }, [avatarUrl])

  return (
     <>
     <HStack align="center" gap="4" flexWrap="wrap">
     {loadingAvatarImage ? <HStack color="fg.muted"><Spinner /><Text>Cargando…</Text></HStack> : <Avatar.Root size={size}>
      {avatarImageUrl ? (
                    <Avatar.Image src={avatarImageUrl} alt="Avatar" />
                  ) : null}
      <Avatar.Fallback>{initials}</Avatar.Fallback>
    </Avatar.Root> }
    </HStack>
    </>
  )
}

export default function ProfessionalsPage() {
  const location = useLocation()

  const [deeplink] = useState(() => {
    const sp = new URLSearchParams(location.search || '')
    return {
      professionalId: sp.get('openProfessionalId'),
      tab:            sp.get('tab'),
      openPatientId:  sp.get('openPatientId'),
      patientTab:     sp.get('patientTab'),
      hasAny:         !!(sp.get('openProfessionalId') || sp.get('openPatientId') || sp.get('patientTab') || sp.get('tab'))
    }
  })

  const consumedRef = useRef(false)
  const [loadingMembers, setLoadingMembers] = useState(true)
  const [members, setMembers] = useState([])

  const [loadingInv, setLoadingInv] = useState(true)
  const [invitations, setInvitations] = useState([])

  const [seats, setSeats] = useState(null)

  const [selectedRow, setSelectedRow] = useState(null)

  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [sortBy, setSortBy] = useState('email')
  const [sortDir, setSortDir] = useState('asc')

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const [inviteOpen, setInviteOpen] = useState(false)
  const cancelBtnRef = useRef(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteDays, setInviteDays] = useState(5)
  const [submittingInvite, setSubmittingInvite] = useState(false)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState(null)
  const [selectedUserGuid, setSelectedUserGuid] = useState(null)

  // etiquetas por usuarioId -> [{code, name, color,...}]
  const [labelsByUser, setLabelsByUser] = useState({})

  const [oneShotInitials, setOneShotInitials] = useState(null)


  async function loadMembers() {
    setLoadingMembers(true)
    try {
      const data = await OrgApi.listMembers()
      const list = Array.isArray(data) ? data : []
      setMembers(list)
      // cargar etiquetas en paralelo
      const entries = await Promise.all(
        list.map(async (m) => {
          const uid = m.userId ?? m.id
          if (uid == null) return [null, []]
          try {
            const labels = await OrgApi.listLabelsForProfessional(uid)
            return [uid, labels]
          } catch {
            return [uid, []]
          }
        })
      )
      const map = {}
      for (const [uid, labels] of entries) {
        if (uid != null) map[uid] = labels
      }
      setLabelsByUser(map)
    } catch (error) {
      toaster.error({ title: 'No se pudo cargar miembros', description: getErrorMessage(error) })
    } finally {
      setLoadingMembers(false)
    }
  }

  async function loadInvitations() {
    setLoadingInv(true)
    try {
      const data = await OrgApi.listInvitations('pending')
      setInvitations(Array.isArray(data) ? data : [])
    } catch (error) {
      if (error?.response?.status === 501) {
        setInvitations([])
      } else {
        toaster.error({ title: 'No se pudo cargar invitaciones', description: getErrorMessage(error) })
      }
    } finally {
      setLoadingInv(false)
    }
  }

  async function loadSeats() {
    try {
      const s = await OrgApi.getSummary()
      const n = typeof s?.seats === 'number' ? s.seats : null
      setSeats(n)
    } catch {
      setSeats(null)
    }
  }

  useEffect(() => {
    loadMembers()
    loadInvitations()
    loadSeats()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const availableRoles = useMemo(() => {
    const s = new Set()
    for (const r of members) {
      const role = r.memberRole || r.userRole
      if (role) s.add(String(role).toLowerCase())
    }
    return Array.from(s).sort()
  }, [members])
  const valueGetter = useMemo(() => ({
    email:   (r) => (r.email || '').toLowerCase(),
    role:    (r) => ((r.memberRole || r.userRole || '') + '').toLowerCase(),
    created: (r) => new Date(r.createdAtUtc).getTime() || 0,
  }), [])
  const filteredSorted = useMemo(() => {
    const term = (search || '').trim().toLowerCase()
    const get = valueGetter[sortBy] || valueGetter.name || valueGetter.email

    const arr = (members || []).filter(m => {
      if (roleFilter !== 'all') {
        const rr = (m.memberRole || m.userRole || '').toLowerCase()
        if (rr !== roleFilter) return false
      }
      if (!term) return true

      const fullName = [m.firstName, m.lastName1, m.lastName2].filter(Boolean).join(' ')
      const withPrefix = (m.titlePrefix ? `${m.titlePrefix} ` : '') + (fullName || '')
      const txt = [
        m.email || '',
        m.phone || '',
        m.licenseNumber || '',
        withPrefix,
        (m.memberRole || m.userRole || '')
      ].join(' ').toLowerCase()

      return txt.includes(term)
    })

    arr.sort((a, b) => {
      const va = get(a)
      const vb = get(b)
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })

    return arr
  }, [members, search, roleFilter, sortBy, sortDir, valueGetter])

 
  useEffect(() => {
    if (consumedRef.current) return
    if (!deeplink.hasAny) return
    if (!members || members.length === 0) return

    const pid = deeplink.professionalId ? Number(deeplink.professionalId) : null
    
    if (!pid) {
      consumedRef.current = true
      // limpiar URL por higiene
      try { window.history.replaceState({}, '', '/app/clinic/profesionales') } catch {}
      return
    }

    // Seleccionar fila y abrir
    const row = members.find(m => Number(m.userId ?? m.id) === pid)
    if (row) {
      setSelectedUserId(pid)
      setSelectedRow(row)
      setDialogOpen(true)
    }

    setOneShotInitials({
      initialTab: deeplink.tab || 'pacientes',
      initialPatientIdToOpen: deeplink.openPatientId || undefined,
      initialPatientTab: deeplink.patientTab || undefined,
    })

    // Limpiar URL sin provocar remount de la ruta
    try { window.history.replaceState({}, '', '/app/clinic/profesionales') } catch {}

    // Marcar consumido (no volver a leer location.search)
    consumedRef.current = true
  }, [members]) // ← depende solo de members; NO de location.search

  const initialTab = oneShotInitials?.initialTab
  const initialPatientIdToOpen = oneShotInitials?.initialPatientIdToOpen
  const initialPatientTab = oneShotInitials?.initialPatientTab


  const closeDialog = () => {
    setDialogOpen(false)
    // limpiar selección y estados
    setSelectedUserId(null)
    setSelectedUserGuid(null)
    setSelectedRow(null)
    setOneShotInitials(null)
  }

  const total = filteredSorted.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(page, totalPages)
  const startIndex = (safePage - 1) * pageSize
  const endIndex = Math.min(startIndex + pageSize, total)
  const pageRows = filteredSorted.slice(startIndex, endIndex)


  function handleSort(col) {
    const isSame = sortBy === col
    const nextSortBy  = col
    const nextSortDir = isSame ? (sortDir === 'asc' ? 'desc' : 'asc') : 'asc'
    setSortBy(nextSortBy)
    setSortDir(nextSortDir)
  }

  function SortableHeader({ col, children, minW }) {
    const isActive = sortBy === col
    const arrow = !isActive ? '' : (sortDir === 'asc' ? ' ▲' : ' ▼')
    return (
      <Table.ColumnHeader
        minW={minW}
        onClick={() => handleSort(col)}
        _hover={{ bg: 'gray.50', cursor: 'pointer' }}
        userSelect="none"
      >
        {children}{arrow}
      </Table.ColumnHeader>
    )
  }

  const columnDividerSx = {
    'thead th:not(:first-of-type), tbody td:not(:first-of-type)': {
      borderLeft: '1px solid',
      borderColor: 'blackAlpha.200',
    },
    'tbody tr[aria-selected="true"] td': {
      background: 'blue.50',
      _dark: { background: 'gray.700' }
    }
  }

  //const noSeatsAvailable = typeof seats === 'number' && seats > 0 && (members?.length || 0) >= seats
  const emailValid = /\S+@\S+\.\S+/.test(inviteEmail)

  async function submitInvite(e) {
    e?.preventDefault?.()
    setSubmittingInvite(true)
    try {
      await OrgApi.createInvitation({
        email: inviteEmail.trim(),
        expiresDays: Number(inviteDays) > 0 ? Number(inviteDays) : 5,
      })
      toaster.success({ title: 'Invitación enviada', description: inviteEmail })
      setInviteOpen(false)
      setInviteEmail('')
      setInviteDays(5)
      await loadInvitations()
    } catch (error) {
      toaster.error({ title: 'Error al invitar', description: getErrorMessage(error) })
    } finally {
      setSubmittingInvite(false)
    }
  }

  async function revokeInvite(id) {
    try {
      await OrgApi.revokeInvitation(id)
      toaster.success({ title: 'Invitación revocada' })
      await loadInvitations()
    } catch (error) {
      toaster.error({ title: 'No se pudo revocar', description: getErrorMessage(error) })
    }
  }

  async function removeMember(userId, email) {
    const ok = window.confirm(`¿Eliminar al profesional ${email}?`)
    if (!ok) return
    try {
      await OrgApi.removeMember(userId)
      toaster.success({ title: 'Profesional eliminado', description: email })
      await loadMembers()
    } catch (error) {
      toaster.error({ title: 'No se pudo eliminar', description: getErrorMessage(error) })
    }
  }

  function openDialogFor(row) {
    const userId = row.userId ?? row.id ?? null
    const userGuid = row.userGuid ?? row.uid ?? row.guid ?? null
    if (userId == null && !userGuid) {
      toaster.error({ title: 'No se pudo abrir el profesional', description: 'Faltan identificadores en la fila.' })
      return
    }

    setSelectedUserId(userId)
    setSelectedUserGuid(userGuid)
    setSelectedRow(row)
    setDialogOpen(true)
  }

  function handleRowClick(row) {
    const currentKey = selectedRow ? (selectedRow.userId ?? selectedRow.id) : null
    const nextKey = row ? (row.userId ?? row.id) : null
    if (currentKey != null && currentKey === nextKey) {
      setSelectedRow(null)
      return
    }
    setSelectedRow(row)
  }
  return (
    <>
      {/* Título + filtros (una fila) */}
      <HStack mb={2} align="center" wrap="wrap">
        <Heading size="md">Profesionales</Heading>
        <Spacer />
        <HStack gap="2" wrap="wrap">
          <Text color="fg.muted" fontSize="sm">Rol:</Text>
          <NativeSelect.Root size="sm" width="160px">
            <NativeSelect.Field
              value={roleFilter}
              onChange={(e) => { setRoleFilter(e.target.value); setPage(1) }}
            >
              <option value="all">Todos</option>
              {availableRoles.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </NativeSelect.Field>
            <NativeSelect.Indicator />
          </NativeSelect.Root>


          <Text color="fg.muted" fontSize="sm">Filas:</Text>
          <NativeSelect.Root size="sm" width="90px">
            <NativeSelect.Field
              value={String(pageSize)}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }}
            >
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
            </NativeSelect.Field>
            <NativeSelect.Indicator />
          </NativeSelect.Root>


          <Input
            size="sm"
            placeholder="Buscar por email o rol"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            width="260px"
          />
          <Tip label="Buscar">
            <IconButton type="button" aria-label="Buscar" size="sm">
              <FiSearch />
            </IconButton>
          </Tip>
          <Tip label="Recargar">
            <IconButton
              aria-label="Recargar"
              size="sm"
              onClick={() => { loadMembers(); loadInvitations(); loadSeats(); }}
            >
              <FiRefreshCw />
            </IconButton>
          </Tip>
        </HStack>
      </HStack>

      {/* Acciones arriba + (sin “Sin selección” cuando no hay) */}
      <HStack mb={3} wrap="wrap" gap="3" align="center">
        <ButtonGroup size="sm">
          {!(typeof seats === 'number' && seats > 0 && (members?.length || 0) >= seats) && (
            <Button leftIcon={<FiPlus />} onClick={() => setInviteOpen(true)} colorPalette="blue">
              Invitar
            </Button>
          )}
          <Button
            leftIcon={<FiEdit2 />}
            onClick={() => selectedRow && openDialogFor(selectedRow)}
            disabled={!selectedRow}
          >
            Editar
          </Button>
          <Button
            leftIcon={<FiTrash2 />}
            onClick={() => selectedRow && removeMember(selectedRow.userId ?? selectedRow.id, selectedRow.email || '')}
            disabled={!selectedRow}
          >
            Eliminar
          </Button>
        </ButtonGroup>

        {selectedRow ? (
          <Text fontSize="sm" color="fg.muted">
            Seleccionado: <b>{selectedRow.userId ?? selectedRow.id}</b> — {selectedRow.email || '—'}
          </Text>
        ) : null}
      </HStack>

      {/* Grid */}
      <Box borderWidth="1px" borderRadius="md" overflow="hidden">
        <Table.Root size="sm" variant="outline" sx={columnDividerSx}>
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeader minW="64px"><span aria-hidden="true" /></Table.ColumnHeader>
              <SortableHeader col="name" minW="260px">Profesional</SortableHeader>
              <SortableHeader col="role" minW="160px">Rol</SortableHeader>
              <Table.ColumnHeader minW="220px">Etiquetas</Table.ColumnHeader>
              <SortableHeader col="created" minW="220px">Miembro desde</SortableHeader>
            </Table.Row>
          </Table.Header>

          <Table.Body>
            {loadingMembers ? (
              <Table.Row>
                <Table.Cell colSpan={5}>
                  <HStack py="6" justify="center" color="fg.muted">
                    <Spinner /> <Text>Cargando…</Text>
                  </HStack>
                </Table.Cell>
              </Table.Row>
            ) : pageRows.length === 0 ? (
              <Table.Row>
                <Table.Cell colSpan={5}>
                  <Box py="6" textAlign="center" color="fg.muted">Sin profesionales</Box>
                </Table.Cell>
              </Table.Row>
            ) : (
              pageRows.map((r) => {
                const rol = r.memberRole || r.userRole || '-'
                const initials = initialsFromEmail(r.email)
                const isSelected = (selectedRow?.userId ?? selectedRow?.id) === (r.userId ?? r.id)
                const uid = r.userId ?? r.id
                const labels = labelsByUser[uid] || []
                return (
                  <Table.Row
                    key={uid ?? r.email}
                    aria-selected={isSelected ? 'true' : 'false'}
                    _hover={{ bg: 'gray.50', cursor: 'pointer' }}
                    onClick={() => handleRowClick(r)}
                  >
                    <Table.Cell>
                      <SecureAvatar avatarUrl={absolutizeApiUrl(r.avatarUrl)} initials={initials} size="xl" />
                  </Table.Cell>
<Table.Cell>
  {(() => {
    const fullName = [r.firstName, r.lastName1, r.lastName2].filter(Boolean).join(' ')
    const displayName = ((r.titlePrefix ? `${r.titlePrefix} ` : '') + (fullName || r.email || '-')).trim()

    return (
      <VStack align="start" gap="0">
        <Text fontWeight="600" noOfLines={1}>
          {displayName}
        </Text>
        <Text fontSize="xs" color="fg.muted" noOfLines={1}>
          {r.email || '—'}
        </Text>
        <HStack gap="2" wrap="wrap">
          {r.phone && (
            <Text fontSize="xs" color="fg.muted" noOfLines={1}>
              Tel: {r.phone}
            </Text>
          )}
          {r.licenseNumber && (
            <Text fontSize="xs" color="fg.muted" noOfLines={1}>
              Lic: {r.licenseNumber}
            </Text>
          )}
        </HStack>
      </VStack>
    )
  })()}
</Table.Cell>
<Table.Cell>
  <Badge>{rol}</Badge>
</Table.Cell>

                    <Table.Cell>
                      <HStack gap="1" wrap="wrap">
                        {labels.length === 0 ? (
                            <Text fontSize="xs" color="fg.muted">—</Text>
                          ) : labels.slice(0, 5).map(l => {
                            const bg = l.colorHex || '#A0AEC0' // fallback gris
                            const fg = textColorForHex(l.colorHex)
                            return (
                              <Badge
                                key={l.id || l.code}
                                bg={bg}
                                color={fg}
                                border="1px solid"
                                borderColor="blackAlpha.200"
                              >
                                {l.code || l.name}
                              </Badge>
                            )
                          })}
                      </HStack>
                    </Table.Cell>
                    <Table.Cell>
                      <Text textStyle="xs" color="fg.muted">
                        {new Date(r.createdAtUtc).toLocaleString()}
                      </Text>
                    </Table.Cell>
                  </Table.Row>
                )
              })
            )}
          </Table.Body>
        </Table.Root>
      </Box>

      {/* Paginación inferior */}
      <HStack mt="3" align="center">
        <Text fontSize="sm" color="fg.muted">
          Mostrando {total === 0 ? 0 : startIndex + 1}–{endIndex} de {total}
        </Text>
        <Spacer />
        <HStack>
          <Button
            size="sm"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={safePage <= 1}
          >
            Anterior
          </Button>
          <Text fontSize="sm">Página {safePage} / {totalPages}</Text>
          <Button
            size="sm"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={safePage >= totalPages}
          >
            Siguiente
          </Button>
        </HStack>
      </HStack>

      {/* Invitaciones pendientes (si hay cupo) */}
      {!(typeof seats === 'number' && seats > 0 && (members?.length || 0) >= seats) && (
        <Box mt="6" borderWidth="1px" borderRadius="md" overflow="hidden">
          <Box px="4" py="2" borderBottomWidth="1px">
            <Heading size="sm">Invitaciones pendientes</Heading>
          </Box>
          <Table.Root size="sm" variant="outline">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeader minW="240px">Email</Table.ColumnHeader>
                <Table.ColumnHeader minW="160px">Rol</Table.ColumnHeader>
                <Table.ColumnHeader minW="180px">Vence</Table.ColumnHeader>
                <Table.ColumnHeader minW="140px">Acciones</Table.ColumnHeader>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {loadingInv ? (
                <Table.Row>
                  <Table.Cell colSpan={4}>
                    <HStack py="6" justify="center" color="fg.muted">
                      <Spinner /> <Text>Cargando…</Text>
                    </HStack>
                  </Table.Cell>
                </Table.Row>
              ) : invitations.length === 0 ? (
                <Table.Row>
                  <Table.Cell colSpan={4}>
                    <Box py="6" textAlign="center" color="fg.muted">No hay invitaciones pendientes</Box>
                  </Table.Cell>
                </Table.Row>
              ) : (
                invitations.map(inv => (
                  <Table.Row key={inv.id}>
                    <Table.Cell>{inv.email}</Table.Cell>
                    <Table.Cell><Badge>{inv.role || '-'}</Badge></Table.Cell>
                    <Table.Cell>{inv.expiresAtUtc ? new Date(inv.expiresAtUtc).toLocaleString() : '—'}</Table.Cell>
                    <Table.Cell>
                      <Tip label="Revocar">
                        <IconButton aria-label="Revocar" size="xs" onClick={() => revokeInvite(inv.id)}>
                          <FiTrash2 />
                        </IconButton>
                      </Tip>
                    </Table.Cell>
                  </Table.Row>
                ))
              )}
            </Table.Body>
          </Table.Root>
        </Box>
      )}

      <ProfessionalDialog
        isOpen={dialogOpen}
          onClose={closeDialog}
          userId={selectedUserId ?? undefined}
          initialUser={selectedRow ?? undefined}
          initialTab={initialTab}
          initialPatientIdToOpen={initialPatientIdToOpen}
          initialPatientTab={initialPatientTab}
      />

      {/* Diálogo Invitar */}
      <Dialog.Root
        role="dialog"
        open={inviteOpen}
        onOpenChange={(e) => setInviteOpen(e.open)}
        initialFocusEl={() => cancelBtnRef.current}
        placement="center"
      >
        <Portal>
          <Dialog.Backdrop bg="blackAlpha.700" />
          <Dialog.Positioner>
            <Dialog.Content
              bg="white"
              _dark={{ bg: "gray.800" }}
              shadow="xl"
              borderRadius="md"
            >
              <Dialog.Header>
                <Dialog.Title>Invitar profesional</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                <VStack align="stretch" gap="3" as="form" onSubmit={submitInvite}>
                  <Field.Root>
                    <Field.Label>Email</Field.Label>
                    <Input
                      type="email"
                      inputMode="email"
                      pattern="^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      required
                      placeholder="nombre@dominio.com"
                    />
                  </Field.Root>

                  <Field.Root>
                    <Field.Label>Vence en (días)</Field.Label>
                    <Input
                      type="number"
                      min={1}
                      value={inviteDays}
                      onChange={(e) => setInviteDays(e.target.value)}
                    />
                  </Field.Root>
                </VStack>
              </Dialog.Body>
              <Dialog.Footer>
                <Button ref={cancelBtnRef} onClick={() => setInviteOpen(false)}>Cancelar</Button>
                <Button
                  colorPalette="blue"
                  onClick={submitInvite}
                  loading={submittingInvite}
                  disabled={submittingInvite || !emailValid}
                  ml={3}
                >
                  Enviar invitación
                </Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </>
  )
}
