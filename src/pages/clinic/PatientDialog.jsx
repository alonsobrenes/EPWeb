// src/pages/clinic/PatientDialog.jsx
import { useEffect, useRef, useState } from 'react'
import {
  Dialog, Portal, Button, HStack, VStack, Input, Text, Switch, Grid, GridItem,
  Tabs, Table, Badge, Separator, IconButton, Textarea,
} from '@chakra-ui/react'
import { useNavigate, useLocation } from 'react-router-dom'
import { toaster } from '../../components/ui/toaster'
import ClinicianApi from '../../api/clinicianApi'
import { TestsApi } from '../../api/testsApi'
import { LuExternalLink, LuTrash2, LuDownload } from 'react-icons/lu'
import { generateAttemptPdf } from '../../reports/generateAttemptPdf'
import { InterviewApi } from '../../api/interviewApi'
import { generateInterviewPdf } from '../../utils/generateInterviewPdf'

function FieldLabel({ children }) {
  return <Text textStyle="sm" color="fg.muted" mb="1">{children}</Text>
}

const ID_TYPES = [
  { value: 'cedula', label: 'Cédula (CR)' },
  { value: 'dimex', label: 'DIMEX' },
  { value: 'pasaporte', label: 'Pasaporte' },
]


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
    </VStack>
  )
}

// ====================== Historial del paciente ======================
function PatientHistory({ patientId, patientName, onClose }) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState([])
  const [downloadingId, setDownloadingId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)

  async function fetchItems() {
    try {
      setLoading(true)
      const data = await ClinicianApi.listAssessmentsByPatient(patientId)
      setItems(data?.items || [])
    } catch (e) {
      toaster.error({ title: 'No se pudo cargar el historial', description: e?.message || 'Error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!patientId) { setLoading(false); return }
    let alive = true
    ;(async () => { await fetchItems() })()
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId])

  function openRow(row) {
    const status    = String(row.status || row.attemptStatus || "").toLowerCase()
    const attemptId = row.attemptId ?? row.attempt_id
    const testId    = row.testId ?? row.test_id
    const testName  = row.testName ?? row.test_name ?? row.testCode ?? row.test_code ?? "Test"
    const isDraft   = status === "in_progress" || status === "review_pending"
    const isSacks   = (row.testName || row.test_name || row.testCode || row.test_code || "").toUpperCase().includes("SACKS")

    const backTo = encodeURIComponent(`/app/clinic/pacientes?openPatientId=${patientId}&tab=hist`)

    if (!attemptId || !testId) {
      navigate(`/app/clinic/evaluaciones?patientId=${patientId}`)
      return
    }

    if (isSacks) {
      if (isDraft) {
        navigate(`/app/clinic/review/${attemptId}?testId=${testId}&backTo=${backTo}`, { state: { testId, testName } })
      } else {
        navigate(`/app/clinic/review/${attemptId}/read?testId=${testId}&backTo=${backTo}`, { state: { testId, testName } })
      }
    } else {
      // NO-SACKS: siempre read-only (tabla)
      navigate(`/app/clinic/review/${attemptId}/simple?testId=${testId}&backTo=${backTo}`, { state: { testId, testName } })
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
      console.log(scWrap)
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
            <Table.ColumnHeader minW="120px">Tipo</Table.ColumnHeader>
            <Table.ColumnHeader minW="120px">Estado</Table.ColumnHeader>
            <Table.ColumnHeader minW="220px" textAlign="right">Acción</Table.ColumnHeader>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {loading ? (
            <Table.Row>
              <Table.Cell colSpan={5}>
                <Text color="fg.muted" py="4">Cargando…</Text>
              </Table.Cell>
            </Table.Row>
          ) : items.length === 0 ? (
            <Table.Row>
              <Table.Cell colSpan={5}>
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
                <Table.Row key={attemptId}>
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

// ====================== Dialog principal ======================
export default function PatientDialog({
  isOpen,
  onClose,
  onSubmit,
  initialValues,
  initialTab = 'datos',   // <- prop externa sigue existiendo
}) {
  const cancelRef = useRef(null)
  const location = useLocation() // <-- usar router location

  // Derivar tab inicial desde: prop -> location.state.tab -> ?tab=...
  const params = new URLSearchParams(location.search)
  const routerTab = location.state?.tab ?? params.get('tab') ?? null
  const computedInitialTab = initialTab || routerTab || 'datos'

  // Tabs controladas (Chakra v3: value / onValueChange)
  const [tabValue, setTabValue] = useState(computedInitialTab)
  useEffect(() => { setTabValue(computedInitialTab) }, [computedInitialTab])

  const [form, setForm] = useState({
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
  })

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
      setForm((f) => ({ ...f, identificationType: 'cedula', isActive: true }))
    }
  }, [initialValues])

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

            {/* El body crece y hace scroll interno */}
            <Dialog.Body flex="1" overflowY="auto" minH={0}>
              <Tabs.Root
                value={tabValue}
                onValueChange={(e) => setTabValue(e.value)}  // <-- importante
                lazyMount
                unmountOnExit
              >
                <Tabs.List>
                  <Tabs.Trigger value="datos">Datos</Tabs.Trigger>
                  <Tabs.Trigger value="hist" disabled={!hasId}>Historial</Tabs.Trigger>
                  <Tabs.Trigger value="inter" disabled={!hasId}>Entrevista</Tabs.Trigger>
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
                          />
                        </GridItem>
                        <GridItem>
                          <FieldLabel>Primer apellido</FieldLabel>
                          <Input
                            value={form.lastName1}
                            onChange={(e) => change('lastName1', e.target.value)}
                          />
                        </GridItem>
                        <GridItem>
                          <FieldLabel>Segundo apellido (opcional)</FieldLabel>
                          <Input
                            value={form.lastName2 || ''}
                            onChange={(e) => change('lastName2', e.target.value)}
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
                          />
                        </GridItem>
                        <GridItem>
                          <FieldLabel>Sexo</FieldLabel>
                          <Input
                            value={form.sex || ''}
                            onChange={(e) => change('sex', e.target.value)}
                            placeholder="M/F/X"
                          />
                        </GridItem>
                        <GridItem>
                          <FieldLabel>Estado</FieldLabel>
                          <Switch.Root
                            checked={!!form.isActive}
                            onCheckedChange={(e) => change('isActive', !!e.checked)}
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
                          />
                        </GridItem>
                        <GridItem>
                          <FieldLabel>Teléfono</FieldLabel>
                          <Input
                            value={form.contactPhone || ''}
                            onChange={(e) => change('contactPhone', e.target.value)}
                          />
                        </GridItem>
                      </Grid>
                    </VStack>
                  </Tabs.Content>

                  <Tabs.Content value="hist">
                    <PatientHistory
                      patientId={patientId}
                      patientName={patientName}
                      onClose={onClose}
                    />
                  </Tabs.Content>

                  <Tabs.Content value="inter">
                    <PatientFirstInterviewTab
                      patientId={patientId}
                      patientName={patientName}
                    />
                  </Tabs.Content>
                </VStack>
              </Tabs.Root>
            </Dialog.Body>

           <Dialog.Footer bg="white" _dark={{ bg: "gray.800" }} position="sticky" bottom="0" zIndex="1" borderTopWidth="1px" borderColor="blackAlpha.200">
              <Button ref={cancelRef} onClick={onClose}>Cancelar</Button>
              <Button colorPalette="blue" ml={2} onClick={submit}>
                {initialValues ? 'Guardar' : 'Crear'}
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}
