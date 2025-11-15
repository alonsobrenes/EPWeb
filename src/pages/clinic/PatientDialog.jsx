// src/pages/clinic/PatientDialog.jsx
import { useEffect, useRef, useState, useCallback } from 'react'
import {
  Dialog, Portal, Button, HStack, VStack, Input, Text, Switch, Grid, GridItem,
  Tabs, Table, Badge, Separator, IconButton, Textarea, Wrap, WrapItem, Spinner, Box
} from '@chakra-ui/react'
import { useNavigate, useLocation } from 'react-router-dom'
import { toaster } from '../../components/ui/toaster'
import ClinicianApi from '../../api/clinicianApi'
import { TestsApi } from '../../api/testsApi'
import { LuExternalLink, LuTrash2, LuDownload } from 'react-icons/lu'
import { generateAttemptPdf } from '../../reports/generateAttemptPdf'
import { InterviewApi } from '../../api/interviewApi'
import { PatientAttachmentsApi } from '../../api/patientAttachmentsApi'
import { generateInterviewPdf } from '../../utils/generateInterviewPdf'
import QuotaStrip from '../../components/billing/QuotaStrip'
import PaywallCTA from "../../components/billing/PaywallCTA"
import { ProfileApi } from '../../api/profileApi'
import PatientSessionsTab from './PatientSessionsTab'
import EditableInterviewHashtags from "../../components/hashtags/EditableInterviewHashtags"
import PatientConsentTab from './PatientConsentTab'

function FieldLabel({ children }) {
  return <Text textStyle="sm" color="fg.muted" mb="1">{children}</Text>
}

const ID_TYPES = [
  { value: 'cedula', label: 'Cédula (CR)' },
  { value: 'dimex', label: 'DIMEX' },
  { value: 'pasaporte', label: 'Pasaporte' },
]

function PatientLabelsSection({ patientId, readOnly }) {
  const [allLabels, setAllLabels] = useState([])
  const [assigned, setAssigned] = useState(new Set())
  const [assignedList, setAssignedList] = useState([]) 
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    // Si no hay patientId (caso "Nuevo paciente"), apaga el loading y no muestres nada
    if (!patientId) {
      setAllLabels([])
      setAssigned(new Set())
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const labelsResp = await ProfileApi.getLabels()
      const all = Array.isArray(labelsResp?.items) ? labelsResp.items : []
      setAllLabels(all)
      const assignedResp = await ProfileApi.getLabelsFor({ type: 'patient', id: patientId })
      let mine = Array.isArray(assignedResp?.items) ? assignedResp.items : []
      if (readOnly && mine.length > 0 && all.length > 0) {
        const sameSize = mine.length === all.length
        const sameIds =
          sameSize &&
          mine.every(m => all.some(a => a.id === m.id)) &&
          all.every(a => mine.some(m => m.id === a.id))
        if (sameIds) {
          // Falso positivo: no hay etiquetas del paciente, sólo vino el catálogo
          mine = []
        }
      }
      setAssigned(new Set(mine.map(x => x.id)))
      setAssignedList(mine)
    } catch (e) {
      toaster.error({ title: 'No se pudieron cargar las etiquetas', description: e?.message || 'Error' })
      // En caso de error, no bloquees la UI
      setAllLabels([])
      setAssigned(new Set())
      setAssignedList([])
    } finally {
      setLoading(false)
    }
  }, [patientId])

  useEffect(() => { load() }, [load])

  const toggleLabel = async (lbl) => {
    if (!patientId) return
    const isOn = assigned.has(lbl.id)
    try {
      setSaving(true)
      if (isOn) {
        await ProfileApi.unassignLabel({ labelId: lbl.id, targetType: 'patient', targetId: patientId })
        const next = new Set(assigned); next.delete(lbl.id); setAssigned(next)
      } else {
        await ProfileApi.assignLabel({ labelId: lbl.id, targetType: 'patient', targetId: patientId })
        const next = new Set(assigned); next.add(lbl.id); setAssigned(next)
      }
    } catch (e) {
      toaster.error({ title: isOn ? 'No se pudo quitar etiqueta' : 'No se pudo asignar etiqueta', description: e?.message || 'Error' })
    } finally {
      setSaving(false)
    }
  }

  // Reglas de visibilidad:
  // - Mientras carga y HAY patientId => muestra spinner en línea.
  // - Si ya no carga y no hay etiquetas => no muestres nada (oculta toda la sección).
  const listToRender = readOnly ? assignedList : allLabels

  if (!loading && listToRender.length === 0) {
    return null
  }

  return (
    <Box ml="6" mt="6">
      <HStack justify="space-between" mb="2">
        <Text fontWeight="medium">Etiquetas del paciente</Text>
        {patientId && loading && (
          <HStack><Spinner size="sm" /><Text>Cargando…</Text></HStack>
        )}
      </HStack>

      {allLabels.length > 0 && (
        <Wrap spacing="2">
          {listToRender.map(lbl => {
            const active = readOnly ? true : assigned.has(lbl.id)
            const disabled = !!readOnly || saving || lbl.isSystem === true
            return (
              <WrapItem key={lbl.id}>
                <Button
                  size="xs"
                  variant={active ? 'solid' : 'outline'}
                  onClick={() => {
                    if (disabled) return // ⬅️ cortocircuito HARD
                    toggleLabel(lbl)
                  }}
                  isDisabled={disabled}            // ⬅️ deshabilita la interacción
                  aria-disabled={disabled}         // ⬅️ semántica accesible
                  tabIndex={disabled ? -1 : 0}     // ⬅️ evita focus con teclado
                  style={{
                    borderColor: lbl.colorHex,
                    background: active ? lbl.colorHex : 'transparent',
                    color: active ? '#fff' : 'inherit',
                    pointerEvents: disabled ? 'none' : 'auto', // ⬅️ opcional: bloquea clicks al 100%
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
    </Box>
  )
}


// ================== TAB: Primera Entrevista (resumen) ==================
function PatientFirstInterviewTab({ patientId, patientName }) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null) // { interviewId, startedAtUtc, status, transcriptText, draftContent }
  const [error, setError] = useState(null)
  const [busyPdf, setBusyPdf] = useState(false)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setLoading(true)
        setError(null)
        const d = await InterviewApi.getFirstByPatient(patientId)
        if (!alive) return
        setData(d || null)
      } catch (e) {
        if (e?.response?.status === 404) {
          setData(null)
          setError(null)
        } else {
          setError(e?.message || 'Error')
        }
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [patientId])

  const goInterview = () => {
    const backTo = encodeURIComponent(`/app/clinic/pacientes?openPatientId=${patientId}&tab=inter`)
    navigate(`/app/clinic/entrevista?patientId=${patientId}&backTo=${backTo}`)
  }

  const exportPdf = async () => {
    try {
      setBusyPdf(true)
      const blob = generateInterviewPdf({
        patient: { id: patientId, name: patientName },
        transcript: data?.transcriptText || '',
        draft: data?.draftContent || '',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `entrevista_${patientId}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      /* noop visual handled elsewhere if needed */
    } finally {
      setBusyPdf(false)
    }
  }

  if (loading) return <Text color="fg.muted">Cargando…</Text>

  if (error) {
    return (
      <VStack align="stretch" gap="3">
        <Text color="red.600">No se pudo cargar la entrevista: {error}</Text>
        <HStack><Button onClick={goInterview} colorPalette="brand">Abrir entrevista</Button></HStack>
      </VStack>
    )
  }

  if (!data) {
    return (
      <VStack align="stretch" gap="3">
        <QuotaStrip show={['ai.credits.monthly', 'storage.gb']} showHints />
        <Text color="fg.muted">Este paciente no tiene una primera entrevista registrada.</Text>
        <HStack><Button onClick={goInterview} colorPalette="brand">Crear / Abrir entrevista</Button></HStack>
      </VStack>
    )
  }

  return (
    <VStack align="stretch" gap="3">
      <HStack justify="space-between" wrap="wrap">
        <HStack gap="2">
          <Badge variant="subtle">Entrevista</Badge>
          <Text textStyle="sm" color="fg.muted">
            {data.startedAtUtc ? new Date(data.startedAtUtc).toLocaleString() : 'sin fecha'} — {data.status || '—'}
          </Text>
        </HStack>
        <HStack gap="2">
          <Button onClick={goInterview} variant="subtle">Abrir</Button>
          <Button onClick={exportPdf} variant="outline" isLoading={busyPdf} loadingText="Generando…">Exportar PDF</Button>
        </HStack>
      </HStack>

      <Text textStyle="sm" color="fg.muted">Transcripción (extracto)</Text>
      <Textarea readOnly minH="120px" value={data.transcriptText || ''} placeholder="Sin transcripción guardada"/>

      <Text textStyle="sm" color="fg.muted" mt="2">Diagnóstico (borrador IA)</Text>
      <Textarea readOnly minH="120px" value={data.draftContent || ''}  placeholder="Sin borrador IA guardado" />

      <Text textStyle="sm" color="fg.muted" mt="2">Diagnóstico del profesional</Text>
      <Textarea readOnly minH="120px" value={data.clinicianDiagnosis || data.clinician_diagnosis || ''} placeholder="Sin diagnóstico profesional guardado" />
      <EditableInterviewHashtags interviewId={data?.interviewId} disabled={loading}
/>

    </VStack>
  )
}

// Barra de cuota simple (sin Chakra Progress)
function QuotaBar({ value = 0 }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0))
  return (
    <div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}
         style={{
           width: '100%',
           height: 8,
           borderRadius: 6,
           background: 'var(--chakra-colors-blackAlpha-200)'
         }}>
      <div style={{
        width: `${pct}%`,
        height: '100%',
        borderRadius: 6,
        background: 'var(--chakra-colors-blue-500)',
        transition: 'width 200ms ease'
      }} />
    </div>
  )
}

// ====================== TAB: Adjuntos (nuevo, sin tocar lo demás) ======================
function PatientAttachmentsTab({ patientId, highlightAttachmentId, readOnly }) {
  const [items, setItems] = useState([])
  const [allLabels, setAllLabels] = useState([])
  //const [assignedMap, setAssignedMap] = useState(new Map()) // fileId -> Set(labelId)
  const [assignedByFile, setAssignedByFile] = useState(new Map())

  const [savingLabelFor, setSavingLabelFor] = useState(null) // fileId
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [file, setFile] = useState(null)
  const [comment, setComment] = useState('')
  const [limitBytes, setLimitBytes] = useState(null)
  const [paywall, setPaywall] = useState(false)
  const [ownershipError, setOwnershipError] = useState(false)

  const rowRefAttachments = useRef(null)
  

  const sumUsedBytes = (arr) =>
    (arr || []).reduce((acc, it) => acc + (Number(it.size ?? it.byteSize ?? 0) || 0), 0)

  const toHuman = (bytes) => {
    if (!Number.isFinite(bytes)) return '—'
    const u = ['B','KB','MB','GB','TB']; let i=0, v=bytes
    while (v >= 1024 && i < u.length-1) { v/=1024; i++ }
    return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${u[i]}`
  }

  const bytesToHuman = (n) => {
    if (!Number.isFinite(n)) return '—'
    const u = ['B','KB','MB','GB','TB']
    let i = 0, v = n
    while (v >= 1024 && i < u.length-1) { v /= 1024; i++ }
    return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${u[i]}`
  }

  const toggleAttachmentLabel = async (fileIdRaw, lbl) => {
  const fileId = String(fileIdRaw)
  if (!fileId || !lbl?.id) return
  try {
    setSavingLabelFor(fileId)
    const current = assignedByFile.get(fileId) || []
    const has = current.some(x => x.id === lbl.id)

    if (has) {
      await ProfileApi.unassignLabel({ labelId: lbl.id, targetType: 'attachment', targetId: fileId })
    } else {
      await ProfileApi.assignLabel({ labelId: lbl.id, targetType: 'attachment', targetId: fileId })
    }

    const next = new Map(assignedByFile)
    next.set(fileId, has ? current.filter(x => x.id !== lbl.id) : [...current, lbl])
    setAssignedByFile(next)
  } finally {
    setSavingLabelFor(null)
  }
}

  const load = async () => {
    try {
      setLoading(true)
      setOwnershipError(false)
      const list = await PatientAttachmentsApi.list(patientId)
      const arr = Array.isArray(list) ? list : []
      setItems(arr)
      try {
        const labelsResp = await ProfileApi.getLabels()
        const all = Array.isArray(labelsResp?.items) ? labelsResp.items : []
        setAllLabels(all)
      } catch { setAllLabels([]) }

      try {
       const pairs = await Promise.all(arr.map(async (it) => {
  const fileId = String(it.fileId || it.file_id)
  try {
    const resp = await ProfileApi.getLabelsFor({ type: 'attachment', id: fileId })
    const mine = Array.isArray(resp?.items) ? resp.items : []   // objetos Label
    return [fileId, mine]
  } catch {
    return [fileId, []]
  }
}))
setAssignedByFile(new Map(pairs))

      } catch { setAssignedByFile(new Map()) }

      try {
        const lb = await PatientAttachmentsApi.storageLimitBytes()
        setLimitBytes(lb) // puede ser null si no hay entitlements
      } catch { /* opcional: no hacemos nada */ }

    } catch (e) {
      toaster.error({ title: 'No se pudieron cargar los adjuntos', description: e?.message || 'Error' })
      const st = e?.response?.status
      const msg = e?.response?.data?.message || e?.message || ''
      if (st === 404 && msg.includes('no pertenece a su organización'))
        {
            setOwnershipError(true)
             setItems([])
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!patientId) { setItems([]); setLoading(false); return }
    let alive = true
    ;(async () => { await load() })()
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId])

  const onUpload = async () => {
    if (!file) {
      toaster.error({ title: 'Seleccione un archivo' })
      return
    }
    if (ownershipError)
    {
        toaster.error({ title: 'Paciente de otra organización', description: 'Seleccione o cree un paciente de su organización actual.' })
      return
    }
    try {
      setUploading(true)
      await PatientAttachmentsApi.upload(patientId, file, comment || null)
      setFile(null); setComment('')
      await load()
      toaster.success({ title: 'Archivo subido' })
    } catch (e) {
      const st = e?.response?.status
      if (st === 402) {
        toaster.error({ title: 'Cuota alcanzada', description: 'Ha alcanzado la cuota de almacenamiento de su plan.' })
        const msg = e?.response?.data?.message || 'Tu período de prueba expiró o alcanzaste la cuota de tu plan.'
        toaster.error({ title: 'Necesitas un plan activo', description: msg })
        setPaywall(true)
      } else if (st === 404 && (e?.response?.data?.message || '').includes('no pertenece a su organización'))
        {
            setOwnershipError(true)
             toaster.error({ title: 'Paciente de otra organización', description: 'Seleccione o cree un paciente de su organización actual.' })
       }
        else if (st === 413) {
        toaster.error({ title: 'Archivo muy grande', description: 'El archivo excede el tamaño máximo permitido.' })
      } else if (st === 400) {
        toaster.error({ title: 'Tipo de archivo no permitido' })
      } else {
        toaster.error({ title: 'No se pudo subir', description: e?.message || 'Error' })
      }
    } finally {
      setUploading(false)
    }
  }

  const onDownload = async (fileId, name) => {
    try {
      const { blob, filename } = await PatientAttachmentsApi.download(fileId, name)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      toaster.error({ title: 'No se pudo descargar', description: e?.message || 'Error' })
    }
  }


  const onDelete = async (fileId) => {
    const ok = window.confirm('¿Eliminar este archivo?')
    if (!ok) return
    try {
      await PatientAttachmentsApi.remove(fileId)
      setItems(prev => prev.filter(x => (x.fileId || x.file_id) !== fileId))
      //await load()
      toaster.success({ title: 'Archivo eliminado' })
    } catch (e) {
      toaster.error({ title: 'No se pudo eliminar', description: e?.message || 'Error' })
    }
  }

  if (!patientId) {
    return <Text color="fg.muted">Guarde el paciente antes de gestionar adjuntos.</Text>
  }

  // if (!loading && allLabels.length === 0) {
  // return null;
  // }

  return (
    <VStack align="stretch" gap="3">
      {ownershipError && (
        <div style = { { border: '1px solid var(--chakra-colors-red-200)', background: 'var(--chakra-colors-red-50)', padding: 10, borderRadius: 8 } }>
          <div style = { { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 } }>
            <span>Este paciente pertenece a otra organización.Seleccione o cree un paciente de su organización actual.</span>
            <button onClick ={ () => window.location.assign('/app/clinic/pacientes')}
style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--chakra-colors-red-300)', background: 'white' }}>
              Cambiar paciente
            </button>
          </div>
        </div>
      )}
      {paywall && <PaywallCTA />}
      {!readOnly && (
      <VStack align = "stretch" gap="2" borderWidth="1px" borderRadius="md" p="3" bg="bg.subtle"
        opacity={ownershipError? 0.6 : 1} pointerEvents={ownershipError? 'none' : 'auto'}>

        <Text fontWeight="semibold">Subir archivo</Text>
        <HStack gap="2" wrap="wrap">
          <input
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            accept=".pdf,image/png,image/jpeg"
            style={{ padding: '8px' }}
          />
          <Input
            placeholder="Comentario (opcional)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          <Button onClick={onUpload} isLoading={uploading} loadingText="Subiendo…">
            Subir
          </Button>
          <Button variant="ghost" onClick={load}>
            Actualizar
          </Button>
        </HStack>
        <Text textStyle="xs" color="fg.muted">Permitidos: PDF, PNG, JPG. El servidor valida tipo/tamaño y cuotas.</Text>
        {/* Barra de cuota */}
            {(() => {
          const used = sumUsedBytes(items)
          if (typeof limitBytes === 'number' && limitBytes > 0) {
            //const pct = Math.min(100, Math.round((used / limitBytes) * 100))
            const pct = (Number.isFinite(used) && Number.isFinite(limitBytes) && limitBytes > 0)
          ? ((used / limitBytes) * 100).toFixed(2)
          : null

          const barColor = storageColorFromPct(pct)
        return (
              <VStack align="stretch" gap="1" mt="2">
                <HStack justify="space-between">
                  <Text textStyle="sm">Almacenamiento</Text>
                  <Text textStyle="sm" color="fg.muted">
                    {toHuman(used)} / {toHuman(limitBytes)} ({pct}%)
                  </Text>
                </HStack>
                <QuotaBar value={pct ?? 0} color={barColor} />
              </VStack>
            )
          }
          return (
            <Text textStyle="sm" color="fg.muted" mt="2">
              Usado: {toHuman(used)}
            </Text>
          )
        })()}


      </VStack>
       )}
      {!readOnly && (<Separator />)}
      <Table.Root size="sm" variant="outline">
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeader minW="200px" w="200px">Nombre</Table.ColumnHeader>
            <Table.ColumnHeader w="80px"  minW="80px"  textAlign="center">Tamaño</Table.ColumnHeader>
            <Table.ColumnHeader w="140px" minW="140px" textAlign="center">Fecha</Table.ColumnHeader>
            <Table.ColumnHeader minW="220px" w="1fr">Comentario</Table.ColumnHeader>
            <Table.ColumnHeader minW="140px" w="140px" textAlign="center">Etiquetas</Table.ColumnHeader>
            <Table.ColumnHeader textAlign="right" minW="96px" w="96px">Acción</Table.ColumnHeader>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {loading ? (
            <Table.Row><Table.Cell colSpan={5}><Text color="fg.muted" py="4">Cargando…</Text></Table.Cell></Table.Row>
          ) : items.length === 0 ? (
            <Table.Row><Table.Cell colSpan={5}><Text color="fg.muted" py="4">Sin adjuntos.</Text></Table.Cell></Table.Row>
          ) : (
            items.map(it => {
              const fileId = it.fileId || it.file_id
              const name = it.name || it.originalName || 'archivo'
              const size = it.size ?? it.byteSize ?? 0
              const dt = it.uploadedAtUtc || it.uploaded_at_utc
              const note = it.comment || ''
              const downloadUrl = PatientAttachmentsApi.getDownloadUrl(fileId)

              return (
                <Table.Row key={fileId}
                   ref={ String(fileId) === String(highlightAttachmentId) ? rowRefAttachments : undefined }
                   style={ String(fileId) === String(highlightAttachmentId)
                          ? { outline: '2px solid var(--chakra-colors-blue-500)', background: 'var(--chakra-colors-blue-50)' }
                          : undefined }
                >
                  <Table.Cell><Text>{name}</Text></Table.Cell>
                  {/* <Table.Cell>{bytesToHuman(size)}</Table.Cell>
                  <Table.Cell>{dt ? new Date(dt).toLocaleString() : '—'}</Table.Cell>
                   */}
                   <Table.Cell textAlign="center" w="80px"  minW="80px"  style={{whiteSpace:'nowrap'}}>{bytesToHuman(size)}</Table.Cell>
                   <Table.Cell textAlign="center" w="140px" minW="140px" style={{whiteSpace:'nowrap'}}>{dt ? new Date(dt).toLocaleString() : '—'}</Table.Cell>
                  <Table.Cell><Text textStyle="sm" color="fg.muted">{note}</Text></Table.Cell>
                  {/* tu celda actual de etiquetas */}
 <Table.Cell>
   <div
     style={{
       maxWidth: 140,                // más angosto
       margin: '0 auto',            // centra el bloque en su columna
       display: 'flex',
       justifyContent: 'center',    // centra los swatches
       alignItems: 'center',
       gap: 6,
       padding: '2px 0',
       overflowX: 'auto',           // scroll solo aquí
       scrollbarWidth: 'thin'       // Firefox: scrollbar delgada
     }}
   >
     {(() => {
      const key = String(fileId)
      const assigned = assignedByFile.get(key) || [] // ← SOLO etiquetas asignadas

      if (assigned.length === 0) {
        return <span style={{ color: 'var(--chakra-colors-fg-muted)' }}>—</span>
      }

      const disabled = !!readOnly || !!savingLabelFor || ownershipError || paywall

      return assigned.map((lbl) => (
        <button
          key={`lbl-${key}-${lbl.id}`}
          onClick={() => { if (!disabled) toggleAttachmentLabel(key, lbl) }}
          disabled={disabled}
          aria-disabled={disabled}
          tabIndex={disabled ? -1 : 0}
          title={`${lbl.code} — ${lbl.name}`}
          style={{
            width: 14, height: 14, minWidth: 14, minHeight: 14,
            borderRadius: 4,
            border: `2px solid ${lbl.colorHex}`,
            background: lbl.colorHex,
            cursor: disabled ? 'auto' : 'pointer'
          }}
          aria-label={`Etiqueta ${lbl.code} (asignada)`}
        />
      ))
    })()}
   </div>
 </Table.Cell>

<Table.Cell>
  <HStack justify="flex-end" gap="1">
   <IconButton
     size="xs"
     variant="ghost"
     aria-label="Descargar"
     title="Descargar"
     onClick={() => onDownload(fileId, name)}
   ><LuDownload /></IconButton>
   {!readOnly && (
              <IconButton
                size="xs"
                variant="ghost"
                colorPalette="red"
                aria-label="Eliminar"
                title="Eliminar"
                onClick={() => onDelete(fileId)}
              ><LuTrash2 />
              </IconButton>
  )}
 </HStack>
                  </Table.Cell>
                </Table.Row>
              )
            })
          )}
        </Table.Body>
      </Table.Root>
    </VStack>
  )
}


// ====================== Historial del paciente ======================
 function PatientHistory({ patientId, patientName, onClose, highlightAttemptId = null, backTo, readOnly }) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState([])
  const [downloadingId, setDownloadingId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [allLabels, setAllLabels] = useState([])
  const [labelsByAttempt, setLabelsByAttempt] = useState(new Map())
  const rowRefAttempts = useRef(null)
  const fetchOrgLabels = useCallback(async () => {
  try {
    const resp = await ProfileApi.getLabels()
    const arr = Array.isArray(resp?.items) ? resp.items : []
    setAllLabels(arr)
  } catch {
    setAllLabels([])
  }
  }, [])

  useEffect(() => { fetchOrgLabels() }, [fetchOrgLabels])


  //const rowRef = useRef(null)

  async function fetchItems() {
    try {
      setLoading(true)
      const data = await ClinicianApi.listAssessmentsByPatient(patientId)      
      const arr = data?.items || []
      setItems(arr)

      try
        {
            const pairs = await Promise.all((arr || []).map(async (it) => {
            const attemptId = it.attemptId ?? it.attempt_id ?? it.id
              if (!attemptId) return [null, new Set()]
              try
            {
                const resp = await ProfileApi.getLabelsFor({ type: 'test_attempt', id: attemptId })
                const mine = Array.isArray(resp?.items) ? resp.items : []
            //return [attemptId, new Set(mine.map(x => x.id))]
            return [attemptId, mine]
          }
        catch
        {
            //return [attemptId, new Set()]
            return [attemptId, []]
          }
    }))
        setLabelsByAttempt(new Map(pairs.filter(([k]) => !!k)))
      } catch {
        setLabelsByAttempt(new Map())
      }
      // cargar etiquetas para las filas traídas
      //await loadAttemptLabels(arr)

    } catch (e) {
      toaster.error({ title: 'No se pudo cargar el historial', description: e?.message || 'Error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { 
  fetchItems() 
}, [patientId])

useEffect(() => {
    if (!highlightAttemptId) return

    const found = items.some(it => String(it.attemptId) === String(highlightAttemptId))

    if (found) {
      try {
        const item = items.filter(it => String(it.attemptId) === String(highlightAttemptId))[0];
        openRow(item);
        rowRefAttempts.current.scrollIntoView({ block: 'center', behavior: 'smooth' });
    } catch {}
    }
  }, [items, highlightAttemptId])

  function openRow(row) {
    const status    = String(row.status || row.attemptStatus || "").toLowerCase()
    const attemptId = row.attemptId ?? row.attempt_id
    const testId    = row.testId ?? row.test_id
    const testName  = row.testName ?? row.test_name ?? row.testCode ?? row.test_code ?? "Test"
    const isDraft   = status === "in_progress" || status === "review_pending"
    const isSacks   = (row.testName || row.test_name || row.testCode || row.test_code || "").toUpperCase().includes("SACKS")
    //const backTo = `/app/clinic/pacientes?openPatientId=${patientId}&tab=hist`
    const defaultBackTo = `/app/clinic/pacientes?openPatientId=${patientId}&tab=hist`
    // const target = backTo ?? defaultBackTo
    // const enc = encodeURIComponent(target)

    //

    const raw = backTo ?? defaultBackTo

    // Normaliza para el caso "profesionales": agrega tab=pacientes y openPatientId=<GUID>
    let normalized = raw
    try {
      // Construimos URL absoluta temporal para poder manipular searchParams
      const base = window.location.origin
      const u = new URL(raw.startsWith('http') ? raw : base + raw)

      // Si el path contiene "/app/clinic/profesionales", forzamos tab=pacientes
      if (u.pathname.includes('/app/clinic/profesionales')) {
        if (!u.searchParams.get('tab')) u.searchParams.set('tab', 'pacientes')
        if (!u.searchParams.get('openPatientId') && patientId) {
          u.searchParams.set('openPatientId', String(patientId))
        }

        if (!u.searchParams.get('patientTab')) {
          u.searchParams.set('patientTab', 'hist')
        }
      }

      normalized = u.pathname + (u.search ? `?${u.searchParams.toString()}` : '')
    } catch {
      // Si algo falla, seguimos con raw tal cual (mejor fallback que romper)
      normalized = raw
    }

    const enc = encodeURIComponent(normalized)

    if (!attemptId || !testId) {
      navigate(`/app/clinic/evaluaciones?patientId=${patientId}`)
      return
    }

    const ro = readOnly ? '1' : '0'

    if (isSacks) {
      if (isDraft){
        navigate(`/app/clinic/review/${attemptId}?testId=${testId}&backTo=${enc}`, { state: { testId, testName } })
      } else {
        navigate(`/app/clinic/review/${attemptId}/read?testId=${testId}&backTo=${enc}&ro=${ro}`, { state: { testId, testName, readOnly  } })
      }
    } else {
      navigate(`/app/clinic/review/${attemptId}/simple?testId=${testId}&backTo=${enc}&ro=${ro}`, { state: { testId, testName, readOnly  } })
    }
  }


  // --- helpers locales para normalizar tipos/opciones (igual que en review) ---
function normalizeType(qtRaw) {
  const t = String(qtRaw || '').toLowerCase().trim()
  if (!t) return 'open'
  if (t === 'open_text' || t === 'open' || t === 'text' || t === 'open-ended' || t === 'written' || t === 'essay') return 'open'
  if (t.includes('multi')) return 'multi'
  if (t === 'single' || t === 'choice' || t.includes('radio')) return 'single'
  if (t === 'yesno' || t === 'yes-no' || t === 'yes_no' || t === 'yn' || t === 'bool' || t === 'boolean') return 'single'
  if (t === 'likert' || t.startsWith('likert')) return 'single'
  return 'open'
}

function parseLikertSpec(rawType) {
  const t = String(rawType || '').toLowerCase().trim()
  if (!t.startsWith('likert')) return null
  let m = t.match(/likert[\s_-]*?(\d+)[\s_-]+(\d+)/)
  if (m) {
    const a = parseInt(m[1], 10), b = parseInt(m[2], 10)
    if (Number.isFinite(a) && Number.isFinite(b) && b >= a) return { start: a, end: b }
  }
  m = t.match(/likert[\s_-]*?(\d+)/)
  if (m) {
    const n = parseInt(m[1], 10)
    if (Number.isFinite(n) && n >= 2) return { start: 1, end: n }
  }
  return { start: 1, end: 4 }
}
function defaultLikertLabels(start, end) {
  const count = end - start + 1
  if (start === 0 && end === 3) return ['Nunca', 'A veces', 'A menudo', 'Siempre']
  if (start === 1 && end === 4) return ['Nunca', 'Algunas veces', 'Bastante', 'Siempre']
  return Array.from({ length: count }, (_, i) => `${start + i}`)
}
function buildLikertOptions(rawType, qid) {
  const spec = parseLikertSpec(rawType) || { start: 1, end: 4 }
  const { start, end } = spec
  const labels = defaultLikertLabels(start, end)
  return Array.from({ length: end - start + 1 }, (_, i) => {
    const value = start + i
    return { id: `${qid}-likert-${value}`, value, label: labels[i] ?? String(value), order: i + 1 }
  })
}
function buildYesNoOptions(qid) {
  return [
    { id: `${qid}-yesno-1`, value: 1, label: 'Sí', order: 1 },
    { id: `${qid}-yesno-0`, value: 0, label: 'No', order: 2 },
  ]
}

async function downloadRow(row) {
  try {
    const attemptId = row.attemptId ?? row.attempt_id
    const testId    = row.testId ?? row.test_id
    const testName  = row.testName ?? row.test_name ?? row.testCode ?? row.test_code ?? 'Test'
    const scoring   = String(row.scoringMode ?? row.scoring_mode ?? '').toLowerCase()
    const dateIso   =
      row.finishedAt ?? row.finished_at ??
      row.updatedAt  ?? row.updated_at  ??
      row.startedAt  ?? row.started_at  ??
      new Date().toISOString()

    setDownloadingId(attemptId)

    // 1) Respuestas del intento (siempre)
    const answersPayload = await ClinicianApi.getAttemptAnswers(attemptId)
    const answersRaw = answersPayload?.answers ?? answersPayload ?? []
    const answersByQ = {}
    for (const a of answersRaw) {
      const qid = a.questionId ?? a.question_id ?? a.id
      answersByQ[qid] = {
        text: a.answerText ?? a.text ?? null,
        value: a.answerValue ?? a.value ?? null,
        values: Array.isArray(a.values)
          ? a.values
          : (typeof a.answerValuesJson === 'string' ? (() => { try { return JSON.parse(a.answerValuesJson) } catch { return [] } })() : []),
      }
    }

    // 2) Construir un "pdfModel" según sea SACKS o NO-SACKS
    const isSacks = (testName || '').toUpperCase().includes('SACK')
    let pdfModel = null

    if (isSacks || scoring === 'clinician') {
      // ---- SACKS: necesitamos grupos/ítems para el orden y los títulos ----
      const scWrap = await ClinicianApi.getScalesWithItems(testId) // {scales:[{name,code,items:[{id,code,text}]}]}
      const scales = scWrap?.scales || []
      const sections = scales.map(sc => ({
        code: sc.code || '',
        name: sc.name || '',
        rows: (sc.items || []).map(it => ({
          code: it.code || '',
          text: it.text || '',
          answerText: (answersByQ[it.id]?.text ?? '') || ''
        }))
      }))
      pdfModel = { kind: 'sacks', sections }
    } else {
      // ---- NO-SACKS: preguntas + opciones ----
      const [qsRun, optsRun] = await Promise.all([
        TestsApi.getQuestions(testId),
        TestsApi.getQuestionOptionsByTest(testId),
      ])

      const byQ = new Map()
      for (const o of (optsRun || [])) {
        if (o.isActive === false) continue
        const qid = o.questionId || o.question_id
        if (!byQ.has(qid)) byQ.set(qid, [])
        byQ.get(qid).push({ id: o.id, label: o.label, value: o.value, order: o.orderNo || o.order_no || 0 })
      }
      for (const arr of byQ.values()) arr.sort((a, b) => (a.order - b.order))

      const questions = (qsRun || []).map((q) => {
        const rawType = q.questionType || q.question_type
        const baseType = normalizeType(rawType)
        const options = (byQ.get(q.id) || []).slice()
        const rtl = String(rawType || '').toLowerCase()
        if (rtl.startsWith('likert') && options.length === 0) buildLikertOptions(rawType, q.id).forEach(o => options.push(o))
        if ((rtl === 'yesno' || rtl === 'yes-no' || rtl === 'yes_no' || rtl === 'yn' || rtl === 'bool' || rtl === 'boolean') && options.length === 0)
          buildYesNoOptions(q.id).forEach(o => options.push(o))
        const finalType =
          (baseType === 'open')  ? 'open'  :
          (baseType === 'multi') ? 'multi' :
          (options.length > 0)   ? 'single' : baseType
        return {
          id: q.id,
          code: q.code,
          text: q.text,
          rawType: rawType || '',
          type: finalType,
          order: q.orderNo || q.order_no || 0,
          options,
        }
      }).sort((a, b) => (a.order - b.order))

      // detectar CDI/triadas (3 opciones en casi todas las preguntas)
      const with3 = questions.filter(q => (q.type === 'single' || q.type === 'multi') && (q.options?.length === 3)).length
      const isTriads = questions.length > 0 && with3 >= Math.max(3, Math.floor(questions.length * 0.9))

      if (isTriads) {
        // Modelo "triadas"
        const rows = questions.map(q => {
          const a = answersByQ[q.id] || {}
          const val = a.value != null ? String(a.value) : null
          const opts = (q.options || []).slice(0, 3)
          while (opts.length < 3) opts.push({ id: `${q.id}-empty-${opts.length}`, value: '', label: '' })
          const selected = [0,1,2].map(i => (val != null && String(opts[i].value) === val))
          return {
            code: q.code,
            optionTexts: opts.map(o => o.label || ''),
            marks: selected, // [bool,bool,bool]
          }
        })
        pdfModel = { kind: 'triads', rows }
      } else {
        // Modelo general (Sí/No, Likert, multi)
        // columnas canónicas: unión ordenada de labels de todas las opciones
        const seen = new Set(), columns = []
        for (const q of questions) {
          if ((q.type === 'single' || q.type === 'multi') && q.options?.length) {
            for (const o of q.options) {
              const k = String(o.label)
              if (!seen.has(k)) { seen.add(k); columns.push(k) }
            }
          }
        }
        const rows = questions.map(q => {
          const a = answersByQ[q.id] || {}
          const openText = q.type === 'open' ? (a.text ?? '') : ''
          const marks = {}
          if (q.type === 'single') {
            const val = a.value != null ? String(a.value) : null
            const opt = q.options?.find(o => String(o.value) === val)
            if (opt) marks[String(opt.label)] = true
          } else if (q.type === 'multi') {
            const arr = Array.isArray(a.values) ? a.values.map(String) : []
            for (const o of (q.options || [])) {
              if (arr.includes(String(o.value))) marks[String(o.label)] = true
            }
          }
          return { code: q.code, text: q.text, marks, openText }
        })
        pdfModel = { kind: 'general', columns, rows }
      }
    }

    // 3) Generar PDF (sin resultados ni sumarios)
    await generateAttemptPdf({
      scoringMode: scoring,
      patientName,
      patientId,
      testName,
      attemptId,
      dateIso,
      answers: answersRaw,   // se mantiene por compatibilidad
      pdfModel,              // NUEVO: layout de respuestas
    })
  } catch (e) {
    toaster.error({ title: 'No se pudo generar el PDF', description: e?.message || 'Error' })
  } finally {
    setDownloadingId(null)
  }
}


  async function deleteDraft(row) {
    const attemptId = row.attemptId ?? row.attempt_id
    const isFinal   = !!(row.isFinal ?? row.finalized ?? row.reviewFinalized)
    if (isFinal) return
    const ok = window.confirm('¿Eliminar este borrador? Esta acción no se puede deshacer.')
    if (!ok) return
    try {
      setDeletingId(attemptId)
      await ClinicianApi.deleteAttempt(attemptId)
      toaster.success({ title: 'Borrador eliminado' })
      await fetchItems()
    } catch (e) {
      toaster.error({ title: 'No se pudo eliminar', description: e?.message || 'Error' })
    } finally {
      setDeletingId(null)
    }
  }

  const renderSwatches = (attemptIdRaw) => {
  // Normaliza la clave (por si llega como GUID en distinto casing/tipo)
  const key = attemptIdRaw != null ? String(attemptIdRaw).toLowerCase() : null
  const list = key ? (labelsByAttempt.get(key) || labelsByAttempt.get(attemptIdRaw) || []) : []

  if (list.length === 0) {
    return <span style={{ color: 'var(--chakra-colors-fg-muted)' }}>—</span>
  }

  return (
    <div style={{
      display: 'flex',
      gap: 6,
      justifyContent: 'center',
      alignItems: 'center',
      maxWidth: 120,
      margin: '0 auto'
    }}>
      {list.map(lbl => (
        <span
          key={lbl.id}
          title={`${lbl.code} — ${lbl.name}`}
          style={{
            width: 12, height: 12, minWidth: 12, minHeight: 12,
            borderRadius: 4,
            border: `2px solid ${lbl.colorHex}`,
            background: lbl.colorHex
          }}
        />
      ))}
    </div>
  )
}

  return (
    <VStack align="stretch" gap="3">
      <HStack justify="space-between">
        <Text fontWeight="semibold">Evaluaciones del paciente</Text>
        <Badge variant="subtle">{items.length} registro(s)</Badge>
      </HStack>

      <Separator />

      <Table.Root size="sm" variant="outline">
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeader minW="180px">Fecha</Table.ColumnHeader>
            <Table.ColumnHeader minW="260px">Test</Table.ColumnHeader>
            <Table.ColumnHeader minW="110px">Tipo</Table.ColumnHeader>
            <Table.ColumnHeader minW="110px">Estado</Table.ColumnHeader>
            <Table.ColumnHeader minW="80px">Etiquetas</Table.ColumnHeader>
            <Table.ColumnHeader minW="120px" textAlign="right">Acción</Table.ColumnHeader>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {loading ? (
            <Table.Row>
              <Table.Cell colSpan={6}>
                <Text color="fg.muted" py="4">Cargando…</Text>
              </Table.Cell>
            </Table.Row>
          ) : items.length === 0 ? (
            <Table.Row>
              <Table.Cell colSpan={6}>
                <Text color="fg.muted" py="4">Sin evaluaciones registradas.</Text>
              </Table.Cell>
            </Table.Row>
          ) : (
            items.map((r) => {
              const started   = r.startedAt  ?? r.started_at  ?? r.created_at
              const finished  = r.finishedAt ?? r.finished_at ?? null
              const updated   = r.updatedAt  ?? r.updated_at  ?? null
              const dateText  = finished || started || updated || '—'
              const testName  = r.testName || r.test_name || r.testCode || r.test_code || 'Test'
              const scoring   = String(r.scoringMode ?? r.scoring_mode ?? '').toLowerCase()
              const isFinal   = !!(r.isFinal ?? r.finalized ?? r.reviewFinalized)
              const attemptId = r.attemptId ?? r.attempt_id ?? r.id

              return (
                <Table.Row key={attemptId}
                  ref={ String(attemptId) === String(highlightAttemptId) ? rowRefAttempts : undefined }
                   style={ String(attemptId) === String(highlightAttemptId)
                          ? { outline: '2px solid var(--chakra-colors-blue-500)', background: 'var(--chakra-colors-blue-50)' }
                          : undefined }
                >
                  <Table.Cell>{new Date(dateText).toLocaleString()}</Table.Cell>
                  <Table.Cell>{testName}</Table.Cell>
                  <Table.Cell>
                    <Badge variant="subtle">{scoring === 'clinician' ? 'Clinician' : 'Automático'}</Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge variant={isFinal ? 'solid' : 'outline'} colorPalette={isFinal ? 'green' : 'gray'}>
                      {isFinal ? 'Finalizado' : 'Borrador'}
                    </Badge>
                  </Table.Cell>
                   <Table.Cell textAlign="center">
                    {renderSwatches(attemptId)}
                  </Table.Cell>
                  <Table.Cell>
                    <HStack justify="flex-end" gap="1">
                      <IconButton
                        aria-label="Abrir"
                        size="xs"
                        variant="ghost"
                        onClick={() => openRow(r)}
                        title="Abrir"
                      >
                        <LuExternalLink />
                      </IconButton>
                      <IconButton
                        aria-label="Descargar PDF"
                        size="xs"
                        variant="ghost"
                        onClick={() => downloadRow(r)}
                        isLoading={downloadingId === attemptId}
                        title="Descargar PDF"
                      >
                        <LuDownload />
                      </IconButton>
                      {!isFinal && (
                        <IconButton
                          aria-label="Eliminar borrador"
                          size="xs"
                          variant="ghost"
                          colorPalette="red"
                          onClick={() => deleteDraft(r)}
                          isLoading={deletingId === attemptId}
                          title="Eliminar borrador"
                        >
                          <LuTrash2 />
                        </IconButton>
                      )}
                    </HStack>
                  </Table.Cell>
                </Table.Row>
              )
            })
          )}
        </Table.Body>
      </Table.Root>
    </VStack>
  )
}

// Color para barra de almacenamiento según porcentaje usado:
function storageColorFromPct(pct) {
  if (isNaN(pct)) return undefined
  if (!Number.isFinite( Number.parseFloat(pct))) return undefined
  if (pct >= 100) return "red"
  if (pct >= 80)  return "orange"
  if (pct < 80)  return "blue"
  return undefined
}


// ====================== Dialog principal ======================
export default function PatientDialog({
  isOpen,
  onClose,
  onSubmit,
  initialValues,
  initialTab = 'datos',
  readOnly = false,
  backTo = null,
}) {
  const cancelRef = useRef(null)
  const location = useLocation() 
  // Derivar tab inicial desde: prop -> location.state.tab -> ?tab=...
  const params = new URLSearchParams(location.search)
  const routerTab = location.state?.tab ?? params.get('tab') ?? null
  const computedInitialTab = initialTab || routerTab || 'datos'

  const qsSessionId = params.get('session_id') || null
  const qsAttachmentId  = params.get('attachment_id') || null
  const qsAttemptId  = params.get('attempt_id') || null
  const [innerSessionId, setInnerSessionId] = useState(qsSessionId)
  useEffect(() => {
    setInnerSessionId(qsSessionId)
  }, [qsSessionId])

  const [innerAttachmentId, setInnerAttachmentId] = useState(qsAttachmentId)
  useEffect(() => {
    setInnerAttachmentId(qsAttachmentId)
  }, [qsAttachmentId])

  const [innerAttemptId, setInnerAttemptId] = useState(qsAttemptId)
  useEffect(() => {
    setInnerAttemptId(qsAttemptId)
  }, [qsAttemptId])

  const EMPTY_FORM = {
    identificationType: 'cedula',
    identificationNumber: '',
    firstName: '',
    lastName1: '',
    lastName2: '',
    dateOfBirth: '',
    sex: '',
    contactEmail: '',
    contactPhone: '',
    isActive: true,
  };

  // Tabs controladas (Chakra v3: value / onValueChange)
  const [tabValue, setTabValue] = useState(computedInitialTab)
  useEffect(() => { setTabValue(computedInitialTab) }, [computedInitialTab])
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    if (initialValues) {
      setForm({
        identificationType: initialValues.identificationType || 'cedula',
        identificationNumber: initialValues.identificationNumber || '',
        firstName: initialValues.firstName || '',
        lastName1: initialValues.lastName1 || '',
        lastName2: initialValues.lastName2 || '',
        dateOfBirth: initialValues.dateOfBirth ? initialValues.dateOfBirth.substring(0,10) : '',
        sex: initialValues.sex || '',
        contactEmail: initialValues.contactEmail || '',
        contactPhone: initialValues.contactPhone || '',
        isActive: initialValues.isActive ?? true,
      })
    } else {
      setForm(EMPTY_FORM);
    }
  }, [isOpen, initialValues])

  useEffect(() => {
    if (!isOpen) return
    if (tabValue !== 'sess') {
    if (innerSessionId !== null) setInnerSessionId(null)
      return
    }
    if (innerSessionId == null) return

    const u = new URL(window.location.href)
    if (u.searchParams.get('session_id')?.toLowerCase() === innerSessionId) {
      u.searchParams.delete('session_id')
      window.history.replaceState({}, '', u.pathname + u.search)
    }
    }, [isOpen, tabValue, params,innerSessionId])

    useEffect(() => {
    if (!isOpen) return
    if (tabValue !== 'adj') {
    if (innerAttachmentId !== null) setInnerAttachmentId(null)
      return
    }
    if (innerAttachmentId == null) return

    const u = new URL(window.location.href)
    if (u.searchParams.get('attachment_id')?.toLowerCase() === innerAttachmentId) {
      u.searchParams.delete('attachment_id')
      window.history.replaceState({}, '', u.pathname + u.search)
    }
    }, [isOpen, tabValue, params,innerAttachmentId])

    useEffect(() => {
    if (!isOpen) return
    if (tabValue !== 'hist') {
    if (innerAttemptId !== null) setInnerAttemptId(null)
      return
    }
    if (innerAttemptId == null) return

    const u = new URL(window.location.href)
    if (u.searchParams.get('attempt_id')?.toLowerCase() === innerAttemptId) {
      u.searchParams.delete('attempt_id')
      window.history.replaceState({}, '', u.pathname + u.search)
    }
    }, [isOpen, tabValue, params,innerAttemptId])

  const change = (k, v) => setForm((prev) => ({ ...prev, [k]: v }))

  const submit = async () => {
    if (!form.identificationNumber.trim()) {
      toaster.error({ title: 'Falta número de identificación' })
      return
    }
    if (!form.firstName.trim() || !form.lastName1.trim()) {
      toaster.error({ title: 'Nombre y primer apellido son obligatorios' })
      return
    }
    await onSubmit({
      ...form,
      dateOfBirth: form.dateOfBirth || null,
      lastName2: form.lastName2 || null,
      contactEmail: form.contactEmail || null,
      contactPhone: form.contactPhone || null,
    })
  }

  const patientId = initialValues?.id || null
  const patientName = [form.firstName, form.lastName1, form.lastName2].filter(Boolean).join(' ')
  const hasId = !!patientId

  return (
    <Dialog.Root
      key={patientId || 'new'}
      role="dialog"
      open={isOpen}
      onOpenChange={(e) => e.open ? null : onClose?.()}
      initialFocusEl={() => cancelRef.current}
      placement="center"
    >
      <Portal>
        <Dialog.Backdrop bg="blackAlpha.400" backdropFilter="blur(1px)" />
        <Dialog.Positioner>
          <Dialog.Content
            maxW="960px"
            maxH="90vh"
            display="flex"
            flexDirection="column"
            bg="white"                         // <- fondo sólido (evita “mezcla” con la tabla atrás)
            _dark={{ bg: "gray.800" }}         // <- equivalente en modo oscuro
            shadow="2xl"                       // <- más elevación
            rounded="xl"
            borderWidth="1px"
            borderColor="blackAlpha.300"       // <- separador del entorno
          >


            <Dialog.Header bg="brand.50" _dark={{ bg: "gray.800" }} position="sticky" top="0" zIndex="1" borderBottomWidth="1px" borderColor="blackAlpha.200">
              <Dialog.Title>{initialValues ? 'Editar paciente' : 'Nuevo paciente'}</Dialog.Title>
            </Dialog.Header>
            {readOnly && (
              <Box px="4" py="2" bg="yellow.50" borderBottomWidth="1px">
                <Text fontSize="sm" color="fg.muted">Solo lectura</Text>
              </Box>
            )}
            {readOnly && (
                <Box
                  position="absolute"
                  inset="0"
                  // deja un pequeño padding transparente para que el scroll del contenedor funcione
                  bg="transparent"
                  pointerEvents="auto"
                />
              )}
            <PatientLabelsSection patientId={patientId} readOnly={readOnly}/>
            {/* El body crece y hace scroll interno */}
            <Dialog.Body flex="1" overflowY="hidden" minH={0}>
              <Tabs.Root
                value={tabValue}
                onValueChange={(e) => setTabValue(e.value)}  // <-- importante
                lazyMount
                unmountOnExit
              >
                <Tabs.List>
                  <Tabs.Trigger value="datos">Datos</Tabs.Trigger>
                  <Tabs.Trigger value="consent" disabled={!hasId}>Consentimiento</Tabs.Trigger>
                  <Tabs.Trigger value="inter" disabled={!hasId}>Entrevista</Tabs.Trigger>
                  <Tabs.Trigger value="hist" disabled={!hasId}>Historial</Tabs.Trigger>
                  <Tabs.Trigger value="adj" disabled={!hasId}>Archivos Adjuntos</Tabs.Trigger>
                  <Tabs.Trigger value="sess" disabled={!hasId}>Sesiones</Tabs.Trigger>
                </Tabs.List>

                <VStack align="stretch" gap="4" mt="3">
                  <Tabs.Content value="datos">
                    <VStack align="stretch" gap="3">
                      <Grid templateColumns={{ base: '1fr', md: '1fr 1fr' }} gap={3}>
                        <GridItem>
                          <FieldLabel>Tipo de identificación</FieldLabel>
                          <select
                            value={form.identificationType}
                            onChange={(e) => change('identificationType', e.target.value)}
                            disabled={readOnly}
                            style={{ padding: '8px', width: '100%', borderRadius: 6, border: '1px solid var(--chakra-colors-border)' }}
                          >
                            {ID_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                          </select>
                        </GridItem>
                        <GridItem>
                          <FieldLabel>Número de identificación</FieldLabel>
                          <Input
                            value={form.identificationNumber}
                            onChange={(e) => change('identificationNumber', e.target.value)}
                            disabled={readOnly}
                            placeholder="Ej. 1-2345-6789"
                          />
                        </GridItem>
                      </Grid>

                      <Grid templateColumns={{ base: '1fr', md: '1fr 1fr 1fr' }} gap={3}>
                        <GridItem>
                          <FieldLabel>Nombre</FieldLabel>
                          <Input
                            value={form.firstName}
                            onChange={(e) => change('firstName', e.target.value)}
                            disabled={readOnly}
                          />
                        </GridItem>
                        <GridItem>
                          <FieldLabel>Primer apellido</FieldLabel>
                          <Input
                            value={form.lastName1}
                            onChange={(e) => change('lastName1', e.target.value)}
                            disabled={readOnly}
                          />
                        </GridItem>
                        <GridItem>
                          <FieldLabel>Segundo apellido (opcional)</FieldLabel>
                          <Input
                            value={form.lastName2 || ''}
                            onChange={(e) => change('lastName2', e.target.value)}
                            disabled={readOnly}
                          />
                        </GridItem>
                      </Grid>

                      <Grid templateColumns={{ base: '1fr', md: '1fr 1fr 1fr' }} gap={3}>
                        <GridItem>
                          <FieldLabel>Fecha nacimiento</FieldLabel>
                          <Input
                            type="date"
                            value={form.dateOfBirth || ''}
                            onChange={(e) => change('dateOfBirth', e.target.value)}
                            disabled={readOnly}
                          />
                        </GridItem>
                        <GridItem>
                          <FieldLabel>Sexo</FieldLabel>
                          <Input
                            value={form.sex || ''}
                            onChange={(e) => change('sex', e.target.value)}
                            disabled={readOnly}
                            placeholder="M/F/X"
                          />
                        </GridItem>
                        <GridItem>
                          <FieldLabel>Estado</FieldLabel>
                          <Switch.Root
                            checked={!!form.isActive}
                            onCheckedChange={(e) => change('isActive', !!e.checked)}
                            disabled={readOnly}
                          >
                            <HStack>
                              <Switch.Control />
                              <Text>{form.isActive ? 'Activo' : 'Inactivo'}</Text>
                            </HStack>
                          </Switch.Root>
                        </GridItem>
                      </Grid>

                      <Grid templateColumns={{ base: '1fr', md: '1fr 1fr' }} gap={3}>
                        <GridItem>
                          <FieldLabel>Email</FieldLabel>
                          <Input
                            type="email"
                            value={form.contactEmail || ''}
                            onChange={(e) => change('contactEmail', e.target.value)}
                            disabled={readOnly}
                          />
                        </GridItem>
                        <GridItem>
                          <FieldLabel>Teléfono</FieldLabel>
                          <Input
                            value={form.contactPhone || ''}
                            onChange={(e) => change('contactPhone', e.target.value)}
                            disabled={readOnly}
                          />
                        </GridItem>
                      </Grid>
                    </VStack>
                  </Tabs.Content>

                  <Tabs.Content value="consent">
                    <PatientConsentTab
                    patientId={patientId}
                    patientName={patientName}
                    readOnly={readOnly}
                    />
                    </Tabs.Content>

                  <Tabs.Content value="inter">
                    <PatientFirstInterviewTab
                      patientId={patientId}
                      patientName={patientName}
                    />
                  </Tabs.Content>

                  <Tabs.Content value="hist">
                    <PatientHistory
                      patientId={patientId}
                      patientName={patientName}
                      highlightAttemptId={innerAttemptId}
                      onClose={onClose}
                      backTo={backTo}
                      readOnly={readOnly}
                    />
                  </Tabs.Content>

                 <Tabs.Content value="adj">
                    <PatientAttachmentsTab patientId={patientId} highlightAttachmentId={innerAttachmentId} readOnly={readOnly}/>
                </Tabs.Content>
                <Tabs.Content value="sess">
                <PatientSessionsTab patientId={patientId} patientName={patientName} autoOpenSessionId={innerSessionId} readOnly={readOnly} />
      </Tabs.Content>
                </VStack>
              </Tabs.Root>
            </Dialog.Body>
            <Dialog.Footer bg="white" _dark={{ bg: "gray.800" }} position="sticky" bottom="0" zIndex="1" borderTopWidth="1px" borderColor="blackAlpha.200">
              <Button ref={cancelRef} onClick={onClose}>Cancelar</Button>
              {!readOnly && (
              <Button colorPalette="blue" ml={2} onClick={submit}>
                {initialValues ? 'Guardar' : 'Crear'}
              </Button>
              )}
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}

