// src/pages/clinic/ProfessionalDialog.jsx
import { useEffect, useMemo, useState } from "react"
import {
  Dialog, Portal, Button, HStack, VStack, Text, Heading, Avatar,
  Tabs, Box, Wrap, WrapItem, Spinner, Grid, GridItem,
  Table, Badge, Input, IconButton
} from "@chakra-ui/react"
import { toaster } from "../../components/ui/toaster"
import { ProfileApi } from "../../api/profileApi"
import { PatientsApi } from "../../api/patientsApi"
import PatientDialog from "./PatientDialog"
import { LuExternalLink } from "react-icons/lu"

function initialsFromEmail(email) {
  if (!email) return "U"
  const left = email.split("@")[0] || ""
  const parts = left.replace(/[._-]+/g, " ").trim().split(/\s+/)
  const a = parts[0]?.[0] || ""
  const b = parts[1]?.[0] || ""
  return (a + b || a || "U").toUpperCase()
}

/** Sección de etiquetas (igual a la validada antes) */
function ProfessionalLabelsSection({ professionalId }) {
  const [allLabels, setAllLabels] = useState([])
  const [assigned, setAssigned] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        if (!professionalId) {
          if (!cancelled) {
            setAllLabels([])
            setAssigned(new Set())
          }
          return
        }
        const labelsResp = await ProfileApi.getLabels()
        const all = Array.isArray(labelsResp?.items) ? labelsResp.items : []
        if (!cancelled) setAllLabels(all)

        const assignedResp = await ProfileApi.getLabelsFor({ type: "professional", id: String(professionalId) })
        const mine = Array.isArray(assignedResp?.items) ? assignedResp.items : []
        if (!cancelled) setAssigned(new Set(mine.map(x => x.id)))
      } catch {
        if (!cancelled) toaster.error({ title: "No se pudieron cargar las etiquetas" })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [professionalId])

  const toggle = async (lbl) => {
    if (!professionalId || !lbl?.id) return
    const isOn = assigned.has(lbl.id)
    try {
      setSaving(true)
      if (isOn) {
        await ProfileApi.unassignLabel({ labelId: lbl.id, targetType: "professional", targetId: String(professionalId) })
        const next = new Set(assigned); next.delete(lbl.id); setAssigned(next)
      } else {
        await ProfileApi.assignLabel({ labelId: lbl.id, targetType: "professional", targetId: String(professionalId) })
        const next = new Set(assigned); next.add(lbl.id); setAssigned(next)
      }
    } catch {
      toaster.error({ title: isOn ? "No se pudo quitar etiqueta" : "No se pudo asignar etiqueta" })
    } finally {
      setSaving(false)
    }
  }

  if (!loading && allLabels.length === 0) return null

  return (
    <Box ml="6" mt="6">
      <HStack justify="space-between" mb="2">
        <Text fontWeight="medium">Etiquetas del profesional</Text>
        {professionalId && loading && (
          <HStack><Spinner size="sm" /><Text>Cargando…</Text></HStack>
        )}
      </HStack>

      {allLabels.length > 0 && (
        <Wrap spacing="2">
          {allLabels.map(lbl => {
            const active = assigned.has(lbl.id)
            return (
              <WrapItem key={lbl.id}>
                <button
                  onClick={() => toggle(lbl)}
                  disabled={saving || lbl.isSystem === true}
                  title={lbl.name}
                  style={{
                    border: `2px solid ${lbl.colorHex}`,
                    background: active ? lbl.colorHex : "transparent",
                    color: active ? "#fff" : "inherit",
                    borderRadius: 6,
                    padding: "2px 8px",
                    fontSize: 12,
                    lineHeight: "18px",
                    cursor: "pointer"
                  }}
                >
                  {lbl.code}
                </button>
              </WrapItem>
            )
          })}
        </Wrap>
      )}
    </Box>
  )
}

export default function ProfessionalDialog({ isOpen, onClose, userId, userGuid, initialUser, initialTab = "datos", initialPatientIdToOpen, initialPatientTab }) {
  // const location = useLocation()
  // const navigate = useNavigate()
  // const didCleanRef = useRef(false)

  const [user, setUser] = useState(null)
  const [tabValue, setTabValue] = useState(initialTab)
  const [labelsSubjectId, setLabelsSubjectId] = useState(null)
  // Estado del Tab Pacientes
  const [patients, setPatients] = useState([])
  const [loadingPatients, setLoadingPatients] = useState(false)
  const [selectedPatientId, setSelectedPatientId] = useState(null)
  const [patientDialogOpen, setPatientDialogOpen] = useState(false)

  // Filtro local y ordenamiento
  const [q, setQ] = useState("")
  const [sortKey, setSortKey] = useState("name") // 'id' | 'name' | 'sex' | 'contact' | 'status' | 'updated'
  const [sortDir, setSortDir] = useState("asc")  // 'asc' | 'desc'

  const initials = useMemo(() => initialsFromEmail(user?.email), [user])

  const clinicianUserId = useMemo(() => {
    if (typeof userId === 'number') return userId
    if (typeof initialUser?.userId === 'number') return initialUser.userId
    if (typeof initialUser?.id === 'number') return initialUser.id
    return null
  }, [userId, initialUser])

  const backToForPatient = useMemo(() => {
    if (clinicianUserId == null) return null
    // Deep link de profesionales con el tab "pacientes" activo
    return `/app/clinic/profesionales?openProfessionalId=${clinicianUserId}&tab=pacientes`
  }, [clinicianUserId])

  useEffect(() => {
    if (isOpen) return
    // diálogo está cerrándose/cerrado → limpiar todo el estado volátil
    setTabValue("datos")
    setPatientDialogOpen(false)
    setSelectedPatientId(null)
    setQ("")
    setSortKey("name")
    setSortDir("asc")
    setPatients([])
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    setUser(initialUser || null)
    setTabValue(initialTab || "datos")

    const guidFromRow = initialUser?.userGuid ?? initialUser?.uid ?? initialUser?.guid ?? null
    const idFromRow = initialUser?.userId ?? initialUser?.id ?? null
    const chosen = userGuid || guidFromRow || (idFromRow != null ? String(idFromRow) : null)
    setLabelsSubjectId(chosen ?? (userId != null ? String(userId) : null))
  }, [isOpen, initialUser, userGuid, userId, initialTab])

  // Cargar pacientes del profesional cuando el Tab "pacientes" se activa
  useEffect(() => {
    // ✅ Evitar toasts y fetches indebidos al deseleccionar en ProfessionalsPage
    if (!isOpen) return
    if (tabValue !== 'pacientes') return

    if (clinicianUserId == null) {
      setPatients([])
      return
    }

    let cancelled = false
    async function load() {
      setLoadingPatients(true)
      try {
        const list = await PatientsApi.listByClinician(clinicianUserId)
        if (!cancelled) setPatients(list)
      } catch {
        if (!cancelled) toaster.error({ title: "No se pudieron cargar los pacientes" })
      } finally {
        if (!cancelled) setLoadingPatients(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [isOpen, tabValue, clinicianUserId])

  useEffect(() => {
    if (!isOpen) return
    if (tabValue !== 'pacientes') return
    if (!initialPatientIdToOpen) return
    if (!patients || patients.length === 0) return

    const found = patients.find(p => String(p.id).toLowerCase() === String(initialPatientIdToOpen).toLowerCase())

    if (found) {
      setSelectedPatientId(found.id)
      setPatientDialogOpen(true)
    }
    // Si no se encuentra, no hacemos nada (quizá el clínico no tiene ese paciente; comportamiento seguro)
  }, [isOpen, tabValue, initialPatientIdToOpen, patients])

  // Helpers para celdas
  function fullNameOf(row) {
    return row.fullName || [row.firstName, row.lastName1, row.lastName2].filter(Boolean).join(' ')
  }
  function NameCell({ row }) {
    return <Text noOfLines={1}>{fullNameOf(row) || '—'}</Text>
  }
  function IdCell({ row }) {
    const idStr = `${row.identificationType?.toUpperCase?.() || ''} ${row.identificationNumber || ''}`.trim()
    return <Text noOfLines={1} fontFamily="mono">{idStr || '—'}</Text>
  }
  function ContactCell({ row }) {
    const parts = [row.contactEmail, row.contactPhone].filter(Boolean)
    return <Text noOfLines={1}>{parts.join(' · ') || '—'}</Text>
  }
  function StatusCell({ row }) {
    return (
      <Badge colorPalette={row.isActive ? 'green' : 'gray'}>
        {row.isActive ? 'Activo' : 'Inactivo'}
      </Badge>
    )
  }
  function UpdatedCell({ row }) {
    const dt = row.updatedAt ? new Date(row.updatedAt) : null
    return <Text noOfLines={1}>{dt ? dt.toLocaleString() : '—'}</Text>
  }

  // Filtro y ordenamiento (client-side)
  const filteredPatients = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return patients
    return patients.filter(p => {
      const name = fullNameOf(p).toLowerCase()
      const idn = `${p.identificationNumber || ""}`.toLowerCase()
      return name.includes(t) || idn.includes(t)
    })
  }, [patients, q])

  const visiblePatients = useMemo(() => {
    const arr = [...filteredPatients]
    const dir = sortDir === "asc" ? 1 : -1

    const getKey = (r) => {
      switch (sortKey) {
        case "id":
          return `${r.identificationType || ""} ${r.identificationNumber || ""}`.toLowerCase()
        case "name":
          return fullNameOf(r).toLowerCase()
        case "sex":
          return (r.sex || "").toString().toLowerCase()
        case "contact":
          return `${r.contactEmail || ""} ${r.contactPhone || ""}`.toLowerCase()
        case "status":
          return r.isActive ? 1 : 0
        case "updated":
          return r.updatedAt ? new Date(r.updatedAt).getTime() : 0
        default:
          return fullNameOf(r).toLowerCase()
      }
    }

    arr.sort((a, b) => {
      const ka = getKey(a)
      const kb = getKey(b)
      if (ka < kb) return -1 * dir
      if (ka > kb) return 1 * dir
      return 0
    })
    return arr
  }, [filteredPatients, sortKey, sortDir])

  function headerClick(nextKey) {
    if (sortKey === nextKey) {
      setSortDir(d => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(nextKey)
      setSortDir("asc")
    }
  }

  // Doble click -> abrir PatientDialog readOnly
  function onRowDoubleClick(row) {
    setSelectedPatientId(row.id)
    setPatientDialogOpen(true)
  }
  function openPatient(row) {
    setSelectedPatientId(row.id)
    setPatientDialogOpen(true)
  }

  const selectedPatient = useMemo(
    () => visiblePatients.find(p => p.id === selectedPatientId) || patients.find(p => p.id === selectedPatientId) || null,
    [visiblePatients, patients, selectedPatientId]
  )

  const save = () => onClose?.()
  const preventParentClose = patientDialogOpen

  const closePatient = () => {
    setPatientDialogOpen(false)
    setSelectedPatientId(null)
  }

  return (
    <>
    <Dialog.Root role="dialog" open={isOpen}
          onOpenChange={(e) => {
            if (!e.open && patientDialogOpen) return
            if (!e.open) onClose?.()
          }}
          placement="center"
          closeOnInteractOutside={!preventParentClose}
          closeOnEsc={!preventParentClose}
      >
      <Portal>
        <Dialog.Backdrop bg="blackAlpha.400" backdropFilter="blur(1px)" />
        <Dialog.Positioner>
          <Dialog.Content
            maxW="960px"
            maxH="90vh"
            display="flex"
            flexDirection="column"
            bg="white"
            _dark={{ bg: "gray.800" }}
            shadow="2xl"
            rounded="xl"
            borderWidth="1px"
            borderColor="blackAlpha.300"
          >
            <Dialog.Header
              bg="brand.50"
              _dark={{ bg: "gray.800" }}
              position="sticky"
              top="0"
              zIndex="1"
              borderBottomWidth="1px"
              borderColor="blackAlpha.200"
            >
              <Dialog.Title>Editar profesional</Dialog.Title>
            </Dialog.Header>

            <ProfessionalLabelsSection professionalId={labelsSubjectId} />

            <Dialog.Body flex="1" overflowY="hidden" minH={0}>
              <Tabs.Root value={tabValue} onValueChange={(e) => setTabValue(e.value)} lazyMount unmountOnExit>
                <Tabs.List>
                  <Tabs.Trigger value="datos">Datos</Tabs.Trigger>
                  <Tabs.Trigger value="pacientes">Pacientes</Tabs.Trigger>
                </Tabs.List>

                <VStack align="stretch" gap="4" mt="3">
                  {/* Tab Datos */}
                  <Tabs.Content value="datos">
                    {!user ? (
                      <HStack color="fg.muted" justify="center" py="6">
                        <Spinner /><Text>Cargando…</Text>
                      </HStack>
                    ) : (
                      <VStack align="stretch" gap="3">
                        <HStack align="start" gap="6">
                          <VStack align="start" gap="1" flex="1" minW={0}>
                            <Heading size="md" noOfLines={1}>{user?.email || "Profesional"}</Heading>
                            {!!user?.userRole && (<Text color="fg.muted">{user.userRole}</Text>)}
                            {!!user?.name && (<Text color="fg.muted">{user.name}</Text>)}

                            <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={3} mt="3">
                              <GridItem>
                                <Text textStyle="sm" color="fg.muted" mb="1">Email</Text>
                                <div style={{
                                  padding: 8, border: "1px solid var(--chakra-colors-border)",
                                  borderRadius: 6, background: "var(--chakra-colors-bg-subtle)"
                                }}>{user?.email || "—"}</div>
                              </GridItem>
                              <GridItem>
                                <Text textStyle="sm" color="fg.muted" mb="1">Rol</Text>
                                <div style={{
                                  padding: 8, border: "1px solid var(--chakra-colors-border)",
                                  borderRadius: 6, background: "var(--chakra-colors-bg-subtle)"
                                }}>{user?.memberRole || user?.userRole || "—"}</div>
                              </GridItem>
                            </Grid>
                          </VStack>

                          <VStack align="center" minW="220px">
                            <Avatar.Root css={{ '--avatar-size': 'sizes.32', '--avatar-font-size': 'fontSizes.3xl' }} borderWidth="1px"
                              borderColor="blackAlpha.50">
                              <Avatar.Fallback name={initials} />
                              {user?.avatarUrl ? (
                                <Avatar.Image src={user.avatarUrl} alt={user.email} />
                              ) : null}
                            </Avatar.Root>
                          </VStack>
                        </HStack>
                      </VStack>
                    )}
                  </Tabs.Content>

                  {/* Tab Pacientes */}
                  <Tabs.Content value="pacientes">
                    <VStack align="stretch" gap="3">
                      <HStack justify="space-between" align="center">
                        <Heading size="sm">Pacientes del profesional</Heading>
                        <HStack>
                          <Badge colorPalette="gray" variant="subtle">
                            {visiblePatients.length} registro{visiblePatients.length === 1 ? "" : "s"}
                          </Badge>
                          {loadingPatients && (
                            <HStack color="fg.muted"><Spinner size="sm" /><Text>Cargando…</Text></HStack>
                          )}
                        </HStack>
                      </HStack>

                      <HStack>
                        <Input
                          value={q}
                          onChange={(e) => setQ(e.target.value)}
                          placeholder="Filtrar por identificación o nombre…"
                        />
                      </HStack>

                      <Table.Root size="sm" variant="outline">
                        <Table.Header>
                          <Table.Row>
                            <Table.ColumnHeader
                              minW="180px"
                              onClick={() => headerClick('id')}
                              _hover={{ bg: 'blackAlpha.50', cursor: 'pointer' }}
                            >
                              Identificación {sortKey === 'id' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                            </Table.ColumnHeader>
                            <Table.ColumnHeader
                              onClick={() => headerClick('name')}
                              _hover={{ bg: 'blackAlpha.50', cursor: 'pointer' }}
                            >
                              Nombre {sortKey === 'name' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                            </Table.ColumnHeader>
                            <Table.ColumnHeader
                              minW="100px"
                              onClick={() => headerClick('sex')}
                              _hover={{ bg: 'blackAlpha.50', cursor: 'pointer' }}
                            >
                              Sexo {sortKey === 'sex' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                            </Table.ColumnHeader>
                            <Table.ColumnHeader
                              minW="20px"
                              onClick={() => headerClick('contact')}
                              _hover={{ bg: 'blackAlpha.50', cursor: 'pointer' }}
                            >
                              Contacto {sortKey === 'contact' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                            </Table.ColumnHeader>
                            <Table.ColumnHeader
                              minW="80px"
                              onClick={() => headerClick('status')}
                              _hover={{ bg: 'blackAlpha.50', cursor: 'pointer' }}
                            >
                              Estado {sortKey === 'status' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                            </Table.ColumnHeader>
                            <Table.ColumnHeader
                              minW="100px"
                              onClick={() => headerClick('updated')}
                              _hover={{ bg: 'blackAlpha.50', cursor: 'pointer' }}
                            >
                              Actualización {sortKey === 'updated' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                            </Table.ColumnHeader>
                            <Table.ColumnHeader minW="100px">
                              Acciones
                            </Table.ColumnHeader>
                          </Table.Row>
                        </Table.Header>
                        <Table.Body>
                          {loadingPatients ? (
                            <Table.Row>
                              <Table.Cell colSpan={7}>
                                <HStack py="6" justify="center" color="fg.muted">
                                  <Spinner /> <Text>Cargando…</Text>
                                </HStack>
                              </Table.Cell>
                            </Table.Row>
                          ) : visiblePatients.length === 0 ? (
                            <Table.Row>
                              <Table.Cell colSpan={7}>
                                <Box py="6" textAlign="center" color="fg.muted">Sin resultados</Box>
                              </Table.Cell>
                            </Table.Row>
                          ) : (
                            visiblePatients.map((r) => (
                              <Table.Row
                                key={r.id}
                                onDoubleClick={() => onRowDoubleClick(r)}
                                onClick={() => setSelectedPatientId(r.id)}
                                _hover={{ bg: 'gray.50', cursor: 'pointer' }}
                                data-selected={selectedPatientId === r.id ? 'true' : undefined}
                                _selected={{ bg: 'blue.50' }}
                              >
                                <Table.Cell><IdCell row={r} /></Table.Cell>
                                <Table.Cell><NameCell row={r} /></Table.Cell>
                                <Table.Cell>{r.sex || '—'}</Table.Cell>
                                <Table.Cell><ContactCell row={r} /></Table.Cell>
                                <Table.Cell><StatusCell row={r} /></Table.Cell>
                                <Table.Cell><UpdatedCell row={r} /></Table.Cell>
                                <Table.Cell>
                                  <IconButton
                                    aria-label="Abrir"
                                    size="xs"
                                    variant="ghost"
                                    onClick={(e) => { e.stopPropagation(); openPatient(r) }}
                                  >
                                    <LuExternalLink />
                                  </IconButton>
                                </Table.Cell>
                              </Table.Row>
                            ))
                          )}
                        </Table.Body>
                      </Table.Root>
                    </VStack>
                  </Tabs.Content>
                </VStack>
              </Tabs.Root>
            </Dialog.Body>

            <Dialog.Footer
              bg="white"
              _dark={{ bg: "gray.800" }}
              position="sticky"
              bottom="0"
              zIndex="1"
              borderTopWidth="1px"
              borderColor="blackAlpha.200"
            >
              <Button onClick={onClose}>Cancelar</Button>
              <Button colorPalette="blue" ml={2} onClick={save}>Guardar</Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
    {/* Diálogo de paciente en solo lectura */}
      <PatientDialog
        isOpen={patientDialogOpen}
        onClose={() => closePatient()}
        initialValues={selectedPatient || undefined}
        readOnly={true}
        initialTab={initialPatientIdToOpen ? (initialPatientTab || 'hist') : 'datos'}
        backTo={backToForPatient}
      />
    </>
  )
}
