// src/pages/clinic/PatientSessionsTab.jsx
import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import {
  Button, HStack, VStack, Input, Text, Table, Separator, Textarea, Dialog,
  IconButton, Badge, Box, Portal, Wrap, WrapItem, Spinner
} from '@chakra-ui/react'
import { LuTrash2, LuDownload } from 'react-icons/lu'
import SessionsApi from '../../api/sessionsApi'
import { ProfileApi } from '../../api/profileApi'
import client from '../../api/client'
import { toaster } from '../../components/ui/toaster'
import { generateSessionPdf } from '../../utils/generateSessionPdf'
import QuotaStrip from '../../components/billing/QuotaStrip'
import HashtagsApi from '../../api/hashtagsApi'

function PencilIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2"
         strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  )
}

export default function PatientSessionsTab({ patientId, patientName, autoOpenSessionId = null }) {
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState([])
  const [q, setQ] = useState('')
  const autoOpenedRef = useRef(false)
  // Standalone modal state
  const [isOpen, setOpen] = useState(false)
  const cancelRef = useRef(null)
  const didInitForKey = useRef(null);
  // Editor state
  const [editing, setEditing] = useState(null) // dto or null (new)
  const [title, setTitle] = useState('')
  const [contentText, setContentText] = useState('')
  const [aiTidyText, setAiTidyText] = useState('')
  const [aiOpinionText, setAiOpinionText] = useState('')
  const [quotas, setQuotas] = useState({ tidy: null, opinion: null })
  const [paywalled, setPaywalled] = useState(false)
  const [saving, setSaving] = useState(false)

  const [autoOpenId, setAutoOpenId] = useState(autoOpenSessionId)
  useEffect(() => {
    setAutoOpenId(autoOpenSessionId)
  }, [autoOpenSessionId])
  const [sessionTags, setSessionTags] = useState([])
  const [loadingTags, setLoadingTags] = useState(false)
  const [savingTagsSession, setSavingTagsSession] = useState(false)
  const [newTagSession, setNewTagSession] = useState('')
  const rxTag = /#?([\p{L}\p{N}_-]{2,64})/iu
  const normTag = (s) => {
    const m = rxTag.exec(String(s || '').trim())
    if (!m) return null
    return m[1].toLowerCase()
  }

  const [aiBusy, setAiBusy] = useState(false)
  const [busyTidy, setBusyTidy] = useState(false)
  const [busyId, setBusyId] = useState(null)

  const anyBusy = aiBusy || busyTidy || saving || savingTagsSession

  // Unificar indicador de cuota (IA créditos unificados)
  const iaQuota = useMemo(() => {
    const q = quotas
    if (!q || q.limit == null) return { limit: null, remaining: Number.POSITIVE_INFINITY }
    return { limit: Number(q.limit), remaining: Number(q.remaining) }
  }, [quotas])

  async function loadAiQuota() {
    try {
      const data = await SessionsApi.getAiQuotas(patientId)
      const item = Array.isArray(data?.items) ? data.items.find(x => x.code === 'ai.credits.monthly') || data.items[0] : null
      setQuotas(item || null)
    } catch {
      setQuotas(null)
    }
  }

  async function loadSessionHashtags(sessionId) {
    if (!sessionId) return
    setLoadingTags(true)
    try {
      const r = await HashtagsApi.getFor({ type: 'session', id: sessionId })
      const items = Array.isArray(r?.items) ? r.items : []
      setSessionTags(items.map(x => (x.tag || '').toString()).filter(Boolean))
    } catch {
      setSessionTags([])
    } finally {
      setLoadingTags(false)
    }
  }

  async function persistSessionTags(sessionId, next) {
    if (!sessionId) return
    setSavingTagsSession(true)
    try {
      const unique = Array.from(new Set((next || []).filter(Boolean)))
      const r = await HashtagsApi.setFor({ type: 'session', id: sessionId, tags: unique })
      const items = Array.isArray(r?.items) ? r.items : []
      setSessionTags(items.map(x => (x.tag || '').toString()))
      toaster.success({ title: 'Hashtags actualizados' })
    } catch (e) {
      toaster.error({ title: 'No se pudieron guardar los hashtags' })
    } finally {
      setSavingTagsSession(false)
    }
  }

  async function addTagSession() {
    const t = normTag(newTagSession)
    if (!t) return
    const next = [...sessionTags, t]
    setNewTagSession('')
    await persistSessionTags(editing?.id, next)
  }

  async function removeTagSession(t) {
    const next = sessionTags.filter(x => x !== t)
    await persistSessionTags(editing?.id, next)
  }

  // Labels for list + modal
  const [allLabels, setAllLabels] = useState([]) // org labels
  const [labelsBySession, setLabelsBySession] = useState(new Map()) // sessionId -> Array<label>
  const [assigned, setAssigned] = useState(new Set()) // ids assigned in editor
  const [labelsLoading, setLabelsLoading] = useState(false)
  const [labelsSaving, setLabelsSaving] = useState(false)

  const fetchOrgLabels = useCallback(async () => {
    try {
      const resp = await ProfileApi.getLabels()
      const arr = Array.isArray(resp?.items) ? resp.items : []
      setAllLabels(arr)
    } catch { setAllLabels([]) }
  }, [])


  const load = useCallback(async (force = false) => {
    if (!patientId) return
    const key = String(patientId || '');
    if (!force && didInitForKey.current === key) return;
    didInitForKey.current = key;

    try {
      setLoading(true)
      const res = await SessionsApi.listByPatient(patientId, { skip: 0, take: 200, search: q })
      const arr = Array.isArray(res?.items) ? res.items : []
      setItems(arr)

      // Preload labels per session (MVP)
      const pairs = await Promise.all(arr.map(async (s) => {
        try {
          const r = await SessionsApi.getLabelsFor(s.id ?? s.sessionId ?? s.session_id)
          const list = Array.isArray(r?.items) ? r.items : []
          return [s.id, list]
        } catch { return [s.id, []] }
      }))
      setLabelsBySession(new Map(pairs))

      if (allLabels.length === 0) await fetchOrgLabels()
    } catch (e) {
      toaster.error({ title: 'No se pudieron cargar las sesiones', description: e?.message || 'Error' })
    } finally {
      setLoading(false)
    }
  }, [patientId, q, allLabels.length, fetchOrgLabels])

  useEffect(() => { load(false) }, [load])

  const openNew = async () => {
    setEditing(null)
    setTitle('')
    setContentText('')
    setAiTidyText('')
    setAiOpinionText('')
    setAssigned(new Set())
    setSessionTags([])
    if (allLabels.length === 0) await fetchOrgLabels()
    setOpen(true)
    await loadAiQuota()
  }


  const openEdit = async (s) => {
    let base = s
    if (!s.contentText && !s.aiTidyText && !s.aiOpinionText) {
      try { const { data } = await client.get(`/patients/${patientId}/sessions/${s.id}`); base = { ...s, ...data } } catch {}
    }
    setEditing(base); setTitle(base.title || ''); setContentText(base.contentText || base.content_text || '')
    setAiTidyText(base.aiTidyText || base.ai_tidy_text || ''); setAiOpinionText(base.aiOpinionText || base.ai_opinion_text || '')
    setEditing(s)
    setTitle(s.title || '')
    setContentText(s.contentText || '')
    setAiTidyText(s.aiTidyText || '')
    setAiOpinionText(s.aiOpinionText || '')
    if (allLabels.length === 0) await fetchOrgLabels()
    try {
      setLabelsLoading(true)
      const resp = await SessionsApi.getLabelsFor(s.id ?? s.sessionId ?? s.session_id)
      const mine = Array.isArray(resp?.items) ? resp.items : []
      setAssigned(new Set(mine.map(x => x.id)))
    } catch {
      setAssigned(new Set())
    } finally {
      setLabelsLoading(false)
    }
    setOpen(true)
    await loadAiQuota()
    await loadSessionHashtags(s.id)
  }

  const closeModal = () => {
    setAutoOpenId(null)
    setOpen(false)
    setEditing(null)
    setTitle('')
    setContentText('')
    setAiTidyText('')
    setAiOpinionText('')
    setAssigned(new Set())
    setSessionTags([])
    setAiBusy(false)
    setSaving(false)
    setSavingTagsSession(false)
    setNewTagSession('')
    didInitForKey.current = null;
    try {
       const u = new URL(window.location.href)
      if (u.searchParams.has('session_id')) {
        u.searchParams.delete('session_id')
        window.history.replaceState({}, '', u.pathname + u.search)
      }
     } catch {}
     autoOpenedRef.current = true
  }

  // Guardar (crear o actualizar)
  const onSave = async () => {
    if (!title.trim()) { toaster.error({ title: 'El título es obligatorio' }); return }
    try {
      setSaving(true)
      if (editing) {
        await SessionsApi.update(patientId, editing.id, { title: title.trim(), contentText })
        await loadSessionHashtags(editing.id)
      } else {
        const dto = await SessionsApi.create(patientId, { title: title.trim(), contentText })
        const ids = Array.from(assigned)
        if (ids.length) {
          setLabelsSaving(true)
          try {
            await Promise.allSettled(ids.map(id => SessionsApi.assignLabel(dto.id, id)))
            // reflejar en tabla
            const mine = allLabels.filter(l => ids.includes(l.id))
            setLabelsBySession(prev => {
              const map = new Map(prev); map.set(dto.id, mine); return map
            })
          } finally {
            setLabelsSaving(false)
          }
        }
        if (dto?.id) await loadSessionHashtags(dto.id)
        setEditing(dto)
      }
      // ⬇️ Forzar recarga antes de cerrar, para que la tabla se actualice de inmediato
      await load(true)
      toaster.success({ title: 'Sesión guardada' })
      closeModal()
    } catch (e) {
      toaster.error({ title: 'No se pudo guardar', description: e?.message || 'Error' })
    } finally {
      setSaving(false)
    }
  }

  // IA: si es nueva, autoguarda primero
  const ensureSessionExists = useCallback(async () => {
    if (editing && editing.id) return editing
    if (!title.trim()) {
      toaster.error({ title: 'Agrega un título para crear el borrador antes de usar IA.' })
      throw new Error('missing title')
    }
    const dto = await SessionsApi.create(patientId, { title: title.trim(), contentText })
    setEditing(dto)
    await load(true)
    return dto
  }, [editing, title, contentText, patientId, load])

  const runAiTidy = async () => {
    try {
      setBusyTidy(true)
      const s = await ensureSessionExists()
      const dto = await SessionsApi.aiTidy(patientId, s.id, null)
      setAiTidyText(dto?.aiTidyText || dto?.ai_tidy_text || '')
      await load(true)
      toaster.success({ title: 'Texto ordenado (IA) guardado' })
      await loadAiQuota()
      await loadSessionHashtags(s.id)
    } catch (e) {
      if (e?.message !== 'missing title')
        toaster.error({ title: 'No se pudo ejecutar IA (ordenar)', description: e?.message || 'Error' })
    } finally {
      setBusyTidy(false)
    }
  }

  const runAiOpinion = async () => {
    try {
      setAiBusy(true)
      const s = await ensureSessionExists()
      const dto = await SessionsApi.aiOpinion(patientId, s.id, null)
      setAiOpinionText(dto?.aiOpinionText || dto?.ai_opinion_text || '')
      await load(true)
      toaster.success({ title: 'Opinión IA guardada' })
      await loadAiQuota()
      await loadSessionHashtags(s.id)
    } catch (e) {
      if (e?.message !== 'missing title')
        toaster.error({ title: 'No se pudo ejecutar IA (opinión)', description: e?.message || 'Error' })
    } finally {
      setAiBusy(false)
    }
  }

  // Etiquetas dentro del modal
  const toggleLabel = async (lbl) => {
    const hasId = !!editing?.id
    const isOn = assigned.has(lbl.id)

    // 1) Siempre reflejar en UI local:
    setAssigned(prev => {
      const next = new Set(prev)
      if (isOn) next.delete(lbl.id); else next.add(lbl.id)
      return next
    })

    // 2) Si no existe sesión todavía, no llamamos a la API (se hará post-creación)
    if (!hasId) return

    try {
      setLabelsSaving(true)
      if (isOn) {
        await SessionsApi.unassignLabel(editing.id, lbl.id)
        // reflejar en la lista
        setLabelsBySession(prev => {
          const arr = [...(prev.get(editing.id) || [])]
          const idx = arr.findIndex(x => x.id === lbl.id)
          if (idx >= 0) arr.splice(idx, 1)
          const map = new Map(prev); map.set(editing.id, arr); return map
        })
      } else {
        await SessionsApi.assignLabel(editing.id, lbl.id)
        setLabelsBySession(prev => {
          const arr = [...(prev.get(editing.id) || [])]
          if (!arr.some(x => x.id === lbl.id)) arr.push(lbl)
          const map = new Map(prev); map.set(editing.id, arr); return map
        })
      }
    } catch (e) {
      // Revert UI si falló
      setAssigned(prev => {
        const next = new Set(prev)
        if (isOn) next.add(lbl.id); else next.delete(lbl.id)
        return next
      })
      toaster.error({ title: isOn ? 'No se pudo quitar etiqueta' : 'No se pudo asignar etiqueta', description: e?.message || 'Error' })
    } finally {
      setLabelsSaving(false)
    }
  }


  // Eliminar
  const onDelete = async (row) => {
    const sessionId = row?.id
    if (!sessionId) return
    try {
      setBusyId(sessionId)
      await SessionsApi.remove(patientId, sessionId)
      await load(true)
      toaster.success({ title: 'Sesión eliminada' })
    } catch (e) {
      toaster.error({ title: 'No se pudo eliminar', description: e?.message || 'Error' })
    } finally {
      setBusyId(null)
    }
  }

  // Exportar PDF
  const onExport = async (row) => {
    try {
      const sessionId = row?.id ?? row?.sessionId ?? row?.session_id
      if (!sessionId) {
        toaster.error({ title: 'No se pudo exportar', description: 'ID de sesión no disponible.' })
        return
      }
      setBusyId(sessionId)

      // Intentar cargar detalle (ruta antigua válida en tu backend)
      let session = null
      try {
        const { data } = await client.get(`/patients/${patientId}/sessions/${sessionId}`)
        session = data
      } catch {
        session = row
      }

      let labels = []
      try {
        const r = await ProfileApi.getLabelsFor({ type: 'session', id: sessionId })
        labels = Array.isArray(r?.items) ? r.items : []
      } catch {}

      const blob = generateSessionPdf({
        patient: { id: patientId, fullName: patientName },
        session,
        labels
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `sesion_${sessionId}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      toaster.success({ title: 'PDF generado' })
    } catch (e) {
      toaster.error({ title: 'No se pudo exportar', description: e?.message || 'Error' })
    } finally {
      setBusyId(null)
    }
  }

  const filteredItems = useMemo(() => {
    if (!q) return items
    const test = q.toLowerCase()
    return items.filter(s =>
      (s.title || '').toLowerCase().includes(test) ||
      (s.contentText || '').toLowerCase().includes(test)
    )
  }, [items, q])

  const renderSwatches = (sessionId) => {
    const arr = labelsBySession.get(sessionId) || []
    if (!arr.length) return <span style={{ color: 'var(--chakra-colors-fg-muted)' }}>—</span>
    return (
      <div style={{ display: 'flex', justifyContent: 'center', gap: 6 }}>
        {arr.slice(0, 8).map((lbl) => (
          <span
            key={`${sessionId}-${lbl.id}`}
            title={`${lbl.code} — ${lbl.name}`}
            style={{
              width: 12, height: 12, minWidth: 12, minHeight: 12,
              borderRadius: 4,
              border: `2px solid ${lbl.colorHex}`,
              background: lbl.colorHex,
            }}
          />
        ))}
        {arr.length > 8 && (
          <span style={{
            fontSize: 11, padding: '0 4px', borderRadius: 4,
            background: 'var(--chakra-colors-blackAlpha-100)'
          }}>+{arr.length - 8}</span>
        )}
      </div>
    )
  }

  useEffect(() => {
    if (!autoOpenId || autoOpenedRef.current || items.length === 0) return
    const id = String(autoOpenId).toLowerCase()
    const target = items.find(s => String(s.id ?? s.sessionId ?? s.session_id).toLowerCase() === id)

    if (target) {
      setBusyId(id)
      autoOpenedRef.current = true;
      openEdit(target);
      try {
        const u = new URL(window.location.href)
        if (u.searchParams.get('session_id')?.toLowerCase() === id) {
          u.searchParams.delete('session_id')
          window.history.replaceState({}, '', u.pathname + u.search)
        }
      } catch {}
      setAutoOpenId(null)
      setBusyId(null)
    }
  }, [autoOpenId, items])

  return (
    <VStack align="stretch" gap="3">
      <HStack justify="space-between" wrap="wrap" gap="2">
        <HStack gap="2">
          <Input placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} minW="220px" />
          <Button onClick={() => load(true)} variant="subtle">Actualizar</Button>
        </HStack>
        <HStack gap="2">
          <Button onClick={openNew} colorPalette="brand">Nueva sesión</Button>
          <Badge variant="subtle">{filteredItems.length} registro(s)</Badge>
        </HStack>
      </HStack>

      <Separator />
      {/* Tabla */}
      <Box borderWidth="1px" borderRadius="md" overflow="hidden">
        <Box maxH="50vh" overflowY="auto">
          <Table.Root size="sm" variant="outline">
            <Table.Header position="sticky" top="0" bg="bg" zIndex="1">
              <Table.Row>
                <Table.ColumnHeader minW="240px">Título</Table.ColumnHeader>
                <Table.ColumnHeader minW="200px">Fecha</Table.ColumnHeader>
                <Table.ColumnHeader minW="200px">Actualizado</Table.ColumnHeader>
                <Table.ColumnHeader minW="110px" textAlign="center">Etiquetas</Table.ColumnHeader>
                <Table.ColumnHeader minW="140px" textAlign="right">Acciones</Table.ColumnHeader>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {loading ? (
                <Table.Row><Table.Cell colSpan={5}><Text color="fg.muted" py="4">Cargando…</Text></Table.Cell></Table.Row>
              ) : filteredItems.length === 0 ? (
                <Table.Row><Table.Cell colSpan={5}><Text color="fg.muted" py="4">Sin sesiones.</Text></Table.Cell></Table.Row>
              ) : (
                filteredItems.map(s => (
                  <Table.Row key={s.id}>
                    <Table.Cell><Text fontWeight="semibold">{s.title}</Text></Table.Cell>
                    <Table.Cell>{s.createdAtUtc ? new Date(s.createdAtUtc).toLocaleString() : '—'}</Table.Cell>
                    <Table.Cell>{s.updatedAtUtc ? new Date(s.updatedAtUtc).toLocaleString() : '—'}</Table.Cell>
                    <Table.Cell textAlign="center">{renderSwatches(s.id)}</Table.Cell>
                    <Table.Cell>
                      <HStack justify="flex-end" gap="1">
                        <IconButton size="xs" variant="ghost" aria-label="Editar" title="Editar" onClick={() => openEdit(s)}>
                          <PencilIcon />
                        </IconButton>
                        <IconButton size="xs" variant="ghost" aria-label="Descargar PDF" title="Descargar PDF" onClick={() => onExport(s)} isLoading={busyId === s.id}>
                          <LuDownload />
                        </IconButton>
                        <IconButton size="xs" variant="ghost" colorPalette="red" aria-label="Eliminar" title="Eliminar" onClick={() => onDelete(s)} isLoading={busyId === s.id}>
                          <LuTrash2 />
                        </IconButton>
                      </HStack>
                    </Table.Cell>
                  </Table.Row>
                ))
              )}
            </Table.Body>
          </Table.Root>
        </Box>
      </Box>

      {/* STANDALONE MODAL */}
      <Dialog.Root
        open={isOpen}
        onOpenChange={(e) => e.open ? null : closeModal()}
        initialFocusEl={() => cancelRef.current}
        placement="center"
      >
        <Portal>
          <Dialog.Backdrop bg="blackAlpha.500" backdropFilter="blur(1px)" zIndex="var(--chakra-zIndices-modal, 1000)" />
          <Dialog.Positioner>
            <Dialog.Content
              maxW={{ base: '96vw', md: '70vw' }}
              maxH={{ base: '92vh', md: '80vh' }}
              display="flex"
              flexDirection="column"
              bg="white"
              _dark={{ bg: 'gray.800' }}
              shadow="2xl"
              rounded="xl"
              borderWidth="1px"
              borderColor="blackAlpha.300"
              zIndex="var(--chakra-zIndices-modal, 1000)"
            >
              <Dialog.Header position="sticky" top="0" zIndex="1" bg="bg" borderBottomWidth="1px">
                <Dialog.Title>{editing ? 'Editar sesión' : 'Nueva sesión'}</Dialog.Title>
              </Dialog.Header>

              <Dialog.Body flex="1" overflowY="auto" minH={0}>
                <VStack align="stretch" gap="3">
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título de la sesión" />

                  {/* Etiquetas (permitir preselección en nueva sesión) */}
                  <VStack align="stretch" gap="2" borderWidth="1px" borderRadius="md" p="3" bg="bg.subtle">
                    <HStack justify="space-between">
                      <Text fontWeight="medium">Etiquetas</Text>
                      {labelsLoading && <HStack><Spinner size="sm" /><Text textStyle="sm">Cargando…</Text></HStack>}
                    </HStack>
                    {allLabels.length === 0 ? (
                      <Text color="fg.muted">No hay etiquetas en la organización.</Text>
                    ) : (
                      <Wrap spacing="2">
                        {allLabels.map(lbl => {
                          const active = assigned.has(lbl.id)
                          return (
                            <WrapItem key={lbl.id}>
                              <Button
                                size="xs"
                                variant={active ? 'solid' : 'outline'}
                                onClick={() => toggleLabel(lbl)}
                                isDisabled={labelsSaving}
                                style={{
                                  borderColor: lbl.colorHex,
                                  background: active ? lbl.colorHex : 'transparent',
                                  color: active ? '#fff' : 'inherit'
                                }}
                                title={lbl.name}
                              >
                                {lbl.code}
                              </Button>
                            </WrapItem>
                          )
                        })}
                      </Wrap>
                    )}
                    {!editing?.id && (
                      <Text textStyle="xs" color="fg.muted">
                        Se asignarán al crear la sesión.
                      </Text>
                    )}
                  </VStack>

                  <Textarea
                    value={contentText}
                    onChange={(e) => setContentText(e.target.value)}
                    minH={{ base: '36vh', md: '38vh' }}
                    placeholder="Notas de sesión…"
                  />

                  {/* Hashtags (editables) */}
                  {editing?.id && (
                    <VStack align="stretch" gap="2" borderWidth="1px" borderRadius="md" p="3" bg="bg.subtle">
                      <HStack justify="space-between" wrap="wrap">
                        <Text fontWeight="medium">Hashtags</Text>
                        {(loadingTags || savingTagsSession) && (
                          <HStack color="fg.muted" fontSize="sm"><Spinner size="sm" /><Text>Procesando…</Text></HStack>
                        )}
                      </HStack>

                      {sessionTags.length > 0 ? (
                        <Wrap spacing="2">
                          {sessionTags.map((t) => (
                            <WrapItem key={t}>
                              <HStack borderWidth="1px" rounded="full" px="2" py="1">
                                <Badge variant="subtle">#{t}</Badge>
                                <Button size="xs" variant="ghost" onClick={() => removeTagSession(t)} disabled={anyBusy}>✕</Button>
                              </HStack>
                            </WrapItem>
                          ))}
                        </Wrap>
                      ) : (
                        <Text textStyle="sm" color="fg.muted">—</Text>
                      )}

                      <HStack>
                        <Input
                          placeholder="#ansiedad"
                          value={newTagSession}
                          onChange={(e) => setNewTagSession(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') addTagSession() }}
                          disabled={anyBusy}
                        />
                        <Button onClick={addTagSession} disabled={anyBusy}>Añadir</Button>
                      </HStack>
                      <Text mt="1" textStyle="xs" color="fg.muted">
                        Formato: letras/números/_/- (2–64). Se guardan sin “#”.
                      </Text>
                    </VStack>
                  )}

                  {/* Resultados IA (solo lectura) */}
                  <VStack align="stretch" gap="2">
                    <Text textStyle="sm" color="fg.muted">Texto ordenado (IA)</Text>
                    <Textarea readOnly value={aiTidyText || ''} minH="120px" placeholder="Aún no has generado el texto ordenado." />
                    <Text textStyle="sm" color="fg.muted" mt="2">Opinión IA</Text>
                    <Textarea readOnly value={aiOpinionText || ''} minH="120px" placeholder="Aún no has generado la opinión IA." />
                  </VStack>
                </VStack>
              </Dialog.Body>

              <Dialog.Footer position="sticky" bottom="0" zIndex="1" bg="bg" borderTopWidth="1px">
                <HStack gap="2" flex="1">
                  <Button
                    variant="subtle"
                    onClick={runAiTidy}
                    isLoading={busyTidy}
                    isDisabled={iaQuota.limit != null && Number(iaQuota.remaining) <= 0}
                  >
                    Ordenar (IA)
                  </Button>
                  <Button
                    variant="subtle"
                    onClick={runAiOpinion}
                    isLoading={aiBusy}
                    isDisabled={iaQuota.limit != null && Number(iaQuota.remaining) <= 0}
                  >
                    Opinión (IA)
                  </Button>
                  <QuotaStrip show={['ai.credits.monthly']} showHints />
                </HStack>
                <Button ref={cancelRef} variant="subtle" onClick={closeModal}>Cancelar</Button>
                <Button onClick={onSave} isLoading={saving}>{editing ? 'Guardar' : 'Crear'}</Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>

      {/* Busy overlay global: por encima del modal */}
      <Portal>
        {(aiBusy || busyTidy || saving || busyId) && (
          <Box
            position="fixed"
            inset="0"
            bg="blackAlpha.400"
            style={{ backdropFilter: 'blur(1px)', cursor: 'progress' }}
            zIndex="calc(var(--chakra-zIndices-modal, 1000) + 1)"
          />
        )}
      </Portal>
    </VStack>
  )
}
