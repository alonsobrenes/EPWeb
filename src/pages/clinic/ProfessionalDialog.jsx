// src/pages/clinic/ProfessionalDialog.jsx
import { useEffect, useMemo, useState } from "react"
import {
  Dialog, Portal, Button, HStack, VStack, Text, Heading, Avatar,
  Tabs, Box, Wrap, WrapItem, Spinner, Grid, GridItem, Table, Input, Badge, IconButton
} from "@chakra-ui/react"
import { toaster } from "../../components/ui/toaster"
import { LuExternalLink, LuDownload } from 'react-icons/lu'
import { ProfileApi } from "../../api/profileApi"
import client from "../../api/client" // default import (tu módulo no exporta named 'client')

function initialsFromEmail(email) {
  if (!email) return "U"
  const left = email.split("@")[0] || ""
  const parts = left.replace(/[._-]+/g, " ").trim().split(/\s+/)
  const a = parts[0]?.[0] || ""
  const b = parts[1]?.[0] || ""
  return (a + b || a || "U").toUpperCase()
}

/** Sección de etiquetas (mismo patrón que PatientDialog) */
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
        // 1) Todas las etiquetas disponibles
        const labelsResp = await ProfileApi.getLabels()
        const all = Array.isArray(labelsResp?.items) ? labelsResp.items : []
        if (!cancelled) setAllLabels(all)

        // 2) Etiquetas asignadas al profesional
        const assignedResp = await ProfileApi.getLabelsFor({ type: "professional", id: String(professionalId) })
        const mine = Array.isArray(assignedResp?.items) ? assignedResp.items : []
        if (!cancelled) setAssigned(new Set(mine.map(x => x.id)))
      } catch (e) {
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

/**
 * ProfessionalDialog
 * Props:
 *  - isOpen: boolean
 *  - onClose: () => void
 *  - userId?: number       // id INT del profesional (preferido para "professional")
 *  - userGuid?: string     // opcional; backend también lo acepta
 *  - initialUser?: object  // fila seleccionada desde ProfessionalsPage
 */
export default function ProfessionalDialog({ isOpen, onClose, userId, userGuid, initialUser }) {
  const [user, setUser] = useState(null)
  const [tabValue, setTabValue] = useState("datos")
  const [labelsSubjectId, setLabelsSubjectId] = useState(null) // GUID o INT (string)

  // entrevistas (listado)
  const [interviews, setInterviews] = useState([])
  const [loadingInterviews, setLoadingInterviews] = useState(false)
  const [errorInterviews, setErrorInterviews] = useState(null)

  // orden y filtro (client-side)
  const [ivSortField, setIvSortField] = useState("startedAtUtc") // 'patientName' | 'status' | 'startedAtUtc' | 'endedAtUtc' | 'durationMs'
  const [ivSortDir, setIvSortDir] = useState("desc")             // 'asc' | 'desc'
  const [ivFilterQ, setIvFilterQ] = useState("")

  const initials = useMemo(() => initialsFromEmail(user?.email), [user])

  useEffect(() => {
    if (!isOpen) return
    setTabValue("datos")
    setUser(initialUser || null)

    const guidFromRow = initialUser?.userGuid ?? initialUser?.uid ?? initialUser?.guid ?? null
    const idFromRow = initialUser?.userId ?? initialUser?.id ?? null
    const chosen = userGuid || guidFromRow || (idFromRow != null ? String(idFromRow) : null)
    setLabelsSubjectId(chosen ?? (userId != null ? String(userId) : null))
  }, [isOpen, initialUser, userGuid, userId])

  // Cargar entrevistas al activar el tab
  useEffect(() => {
    let cancelled = false
    async function loadInterviews() {
      if (!isOpen || tabValue !== "entrevistas" || !userId) return
      setLoadingInterviews(true)
      setErrorInterviews(null)
      try {
        const { data } = await client.get("/clinician/interviews/by-clinician", { params: { UserId: userId } })
        if (!cancelled) {
          setInterviews(Array.isArray(data?.items) ? data.items : [])
        }
      } catch (err) {
        if (!cancelled) setErrorInterviews(err)
        toaster.error({ title: "No se pudieron cargar las entrevistas" })
      } finally {
        if (!cancelled) setLoadingInterviews(false)
      }
    }
    loadInterviews()
    return () => { cancelled = true }
  }, [isOpen, tabValue, userId])

  // Orden + filtro (cliente)
  const visibleInterviews = useMemo(() => {
    const q = ivFilterQ.trim().toLowerCase()
    let list = interviews
    if (q) {
      list = list.filter(iv => (iv.patientName || "").toLowerCase().includes(q))
    }
    const dir = ivSortDir === "asc" ? 1 : -1
    const field = ivSortField
    const sorted = [...list].sort((a, b) => {
      const av = a?.[field]
      const bv = b?.[field]
      // fechas numéricas para comparar
      const toTime = (v) => (v ? new Date(v).getTime() : 0)
      if (field === "startedAtUtc" || field === "endedAtUtc") {
        const aa = toTime(av), bb = toTime(bv)
        if (aa < bb) return -1 * dir
        if (aa > bb) return 1 * dir
        return 0
      }
      if (field === "durationMs") {
        const aa = av ?? 0, bb = bv ?? 0
        if (aa < bb) return -1 * dir
        if (aa > bb) return 1 * dir
        return 0
      }
      // strings
      const aa = (av ?? "").toString().toLowerCase()
      const bb = (bv ?? "").toString().toLowerCase()
      if (aa < bb) return -1 * dir
      if (aa > bb) return 1 * dir
      return 0
    })
    return sorted
  }, [interviews, ivFilterQ, ivSortDir, ivSortField])

  const toggleSort = (field) => {
    if (ivSortField === field) {
      setIvSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setIvSortField(field)
      setIvSortDir("asc")
    }
  }

  const save = () => onClose?.()

  // Indicador visual simple del sentido de orden
  const arrow = (field) => ivSortField === field ? (ivSortDir === "asc" ? " ▲" : " ▼") : ""

  return (
    <Dialog.Root role="dialog" open={isOpen} onOpenChange={(e) => e.open ? null : onClose?.()} placement="center">
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

            {/* Etiquetas bajo el header */}
            <ProfessionalLabelsSection professionalId={labelsSubjectId} />

            <Dialog.Body flex="1" overflowY="hidden" minH={0}>
              <Tabs.Root value={tabValue} onValueChange={(e) => setTabValue(e.value)} lazyMount unmountOnExit>
                <Tabs.List>
                  <Tabs.Trigger value="datos">Datos</Tabs.Trigger>
                  <Tabs.Trigger value="entrevistas">Entrevistas</Tabs.Trigger>
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
                          {/* Columna izquierda */}
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

                          {/* Columna derecha: avatar grande */}
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

                  {/* Tab Entrevistas */}
                  <Tabs.Content value="entrevistas">
                    {loadingInterviews ? (
                      <HStack color="fg.muted" justify="center" py="6">
                        <Spinner /><Text>Cargando entrevistas…</Text>
                      </HStack>
                    ) : errorInterviews ? (
                      <Text color="red.500" py="6" textAlign="center">Error al cargar entrevistas.</Text>
                    ) : (
                      <VStack align="stretch" gap="3">
                        {/* Filtro por paciente */}
                        <HStack justify="space-between">
                          <Box flex="1" maxW="360px">
                            <Input
                              size="sm"
                              placeholder="Filtrar por paciente…"
                              value={ivFilterQ}
                              onChange={(e) => setIvFilterQ(e.target.value)}
                            />
                          </Box>
                          <HStack justify="end">
                                <Badge variant="subtle">{visibleInterviews.length} registro(s)</Badge>
                            </HStack>
                        </HStack>

                        {visibleInterviews.length === 0 ? (
                          <Text color="fg.muted" py="6" textAlign="center">No hay entrevistas registradas.</Text>
                        ) : (
                          <Box overflowX="auto" maxH="60vh" borderWidth="0px" borderRadius="md">
                            <Table.Root size="sm" variant="outline">
                              <Table.Header bg="gray.50">
                                <Table.Row>
                                  <Table.ColumnHeader
                                    cursor="pointer"
                                    onClick={() => toggleSort("patientName")}
                                  >
                                    Paciente{arrow("patientName")}
                                  </Table.ColumnHeader>
                                  <Table.ColumnHeader
                                    cursor="pointer"
                                    onClick={() => toggleSort("status")}
                                  >
                                    Estado{arrow("status")}
                                  </Table.ColumnHeader>
                                  <Table.ColumnHeader
                                    cursor="pointer"
                                    onClick={() => toggleSort("startedAtUtc")}
                                  >
                                    Inicio{arrow("startedAtUtc")}
                                  </Table.ColumnHeader>
                                  <Table.ColumnHeader
                                    cursor="pointer"
                                    onClick={() => toggleSort("endedAtUtc")}
                                  >
                                    Fin{arrow("endedAtUtc")}
                                  </Table.ColumnHeader>
                                  <Table.ColumnHeader
                                    cursor="pointer"
                                    onClick={() => toggleSort("durationMs")}
                                  >
                                    Duración{arrow("durationMs")}
                                  </Table.ColumnHeader>
                                  <Table.ColumnHeader textAlign="right" minW="120px">Acción</Table.ColumnHeader>
                                </Table.Row>
                              </Table.Header>
                              <Table.Body>
                                {visibleInterviews.map(iv => (
                                  <Table.Row key={iv.id}>
                                    <Table.Cell>{iv.patientName || "—"}</Table.Cell>
                                    <Table.Cell>{iv.status || "—"}</Table.Cell>
                                    <Table.Cell>{iv.startedAtUtc ? new Date(iv.startedAtUtc).toLocaleString() : "—"}</Table.Cell>
                                    <Table.Cell>{iv.endedAtUtc ? new Date(iv.endedAtUtc).toLocaleString() : "—"}</Table.Cell>
                                    <Table.Cell>{iv.durationMs ? `${Math.round(iv.durationMs / 1000 / 60)} min` : "—"}</Table.Cell>
                                    <Table.Cell>
                                        <HStack justify="flex-end" gap="1">
                                            <IconButton aria-label="Abrir" size="xs" variant="ghost" title="Abrir"><LuExternalLink /></IconButton>
                                            <IconButton aria-label="Descargar PDF" size="xs" variant="ghost" title="Descargar PDF"><LuDownload /></IconButton>
                                        </HStack>
                                    </Table.Cell>
                                  </Table.Row>
                                ))}
                              </Table.Body>
                            </Table.Root>
                          </Box>
                        )}
                      </VStack>
                    )}
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
  )
}
