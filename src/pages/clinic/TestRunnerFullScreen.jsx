// src/pages/clinic/TestRunnerFullScreen.jsx
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Box, HStack, VStack, Heading, Text, Button, IconButton, Input, Textarea, Spinner, Badge, Table
} from '@chakra-ui/react'
import { FiX, FiChevronLeft, FiChevronRight, FiSave, FiCheckCircle } from 'react-icons/fi'
import { toaster } from '../../components/ui/toaster'
import { TestsApi } from '../../api/testsApi'
import ClinicianApi from '../../api/clinicianApi'
import client from '../../api/client'
import { useNavigate } from 'react-router-dom'

function getErrorMessage(error) {
  const data = error?.response?.data
  if (typeof data === 'string') return data
  if (data?.message) return data.message
  return error?.message || 'Error'
}

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
    const a = parseInt(m[1], 10)
    const b = parseInt(m[2], 10)
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

const DEFAULT_SCHEMES = {
  likert4: [
    { value: 1, label: 'Nunca', order: 1 },
    { value: 2, label: 'Algunas veces', order: 2 },
    { value: 3, label: 'Bastante', order: 3 },
    { value: 4, label: 'Siempre', order: 4 },
  ],
  yesno: [
    { value: 1, label: 'Sí', order: 1 },
    { value: 0, label: 'No', order: 2 },
  ],
}

function storageKey({ testId, patientId, assignmentId }) {
  return `ep:test:${testId}:patient:${patientId}${assignmentId ? `:assign:${assignmentId}` : ''}`
}

export default function TestRunnerFullScreen({
  open,
  onClose,
  test,
  patient,
  assignmentId = null,
}) {
  const navigate = useNavigate()

  const testId = test?.id
  const patientId = patient?.id

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [questions, setQuestions] = useState([])
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState({})
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState(null)
  const startedAtRef = useRef(null)
  const resolvedTestIdRef = useRef(testId || null)
  const resolvedPatientIdRef = useRef(patientId || null)

  // scoring_mode (si viene del prop o backend)
  const [scoringMode, setScoringMode] = useState(() => (test?.scoring_mode ?? test?.scoringMode ?? null))
  useEffect(() => {
    const sm = test?.scoring_mode ?? test?.scoringMode ?? null
    if (sm && sm !== scoringMode) setScoringMode(sm)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [test?.scoring_mode, test?.scoringMode])

  // (eliminado) NO deducimos 'clinician' solo por existencia de escalas

  useEffect(() => {
    if (!open ) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  useEffect(() => {
    if (!open || (!testId && !assignmentId)) return
    let alive = true
    async function load() {
      setLoading(true); setError(null); setResult(null)
      try {
        // Resolver testId/patientId desde la asignación si hace falta
        let tid = testId
        let pid = patientId
        if (!tid && assignmentId) {
          try {
            const { data: a } = await client.get(`/assignments/${assignmentId}`)
            tid = a?.testId ?? a?.test_id ?? tid
            pid = pid ?? a?.patientId ?? a?.patient_id ?? null
          } catch (_) {
            try {
              const { data: a2 } = await client.get(`/clinician/assignments/${assignmentId}`)
              tid = a2?.testId ?? a2?.test_id ?? tid
              pid = pid ?? a2?.patientId ?? a2?.patient_id ?? null
            } catch (_) {}
          }
          if (tid) resolvedTestIdRef.current = tid
          if (pid) resolvedPatientIdRef.current = pid
        }
        const effTestId = resolvedTestIdRef.current || tid
        const effPatientId = resolvedPatientIdRef.current || pid
        if (!effTestId) { setError('No se pudo resolver el test de la asignación'); return }

        const [qs, opts] = await Promise.all([
          TestsApi.getQuestions(effTestId),
          TestsApi.getQuestionOptionsByTest(effTestId),
        ])

        const byQ = new Map()
        for (const o of (opts || [])) {
          if (o.isActive === false) continue
          const qid = o.questionId || o.question_id
          if (!byQ.has(qid)) byQ.set(qid, [])
          byQ.get(qid).push({ id: o.id, label: o.label, value: o.value, order: o.orderNo || o.order_no || 0 })
        }
        for (const arr of byQ.values()) arr.sort((a, b) => (a.order - b.order))

        const norm = (qs || []).map((q) => {
          const rawType = q.questionType || q.question_type
          const baseType = normalizeType(rawType)
          const options = (byQ.get(q.id) || []).slice()
          const rtl = String(rawType || '').toLowerCase()

          if (rtl.startsWith('likert') && options.length === 0) buildLikertOptions(rawType, q.id).forEach(o => options.push(o))
          if ((rtl === 'yesno' || rtl === 'yes-no' || rtl === 'yes_no' || rtl === 'yn' || rtl === 'bool' || rtl === 'boolean') && options.length === 0)
            buildYesNoOptions(q.id).forEach(o => options.push(o))

          const forceTriadSingle = (baseType === 'multi' && options.length === 3)
          const finalType = (baseType === 'open') ? 'open'
            : (forceTriadSingle ? 'single'
              : (baseType === 'multi') ? 'multi'
              : (options.length > 0 ? 'single' : baseType))

          return {
            id: q.id,
            code: q.code,
            text: q.text,
            rawType: rawType || '',
            type: finalType,
            isOptional: !!q.isOptional,
            order: q.orderNo || q.order_no || 0,
            options,
          }
        }).sort((a, b) => (a.order - b.order))

        if (!alive) return
        setQuestions(norm)
        startedAtRef.current = new Date().toISOString()

        const raw = localStorage.getItem(storageKey({ testId: (effTestId ?? testId), patientId: (effPatientId ?? patientId), assignmentId }))
        if (raw) {
          try {
            const parsed = JSON.parse(raw)
            setAnswers(parsed.answers || {})
            setIndex(parsed.index ?? 0)
          } catch { setAnswers({}); setIndex(0) }
        } else {
          setAnswers({}); setIndex(0)
        }
      } catch (e) {
        if (!alive) return
        setError(getErrorMessage(e))
      } finally {
        if (alive) setLoading(false)
      }
    }
    load()
    return () => { alive = false }
  }, [open, testId, patientId, assignmentId])

  // Reemplaza tu persist() por este
function persist(toast = false) {
  try {
    // IDs efectivos (con defensas, NO dependen de variables locales de load())
    const effTestId =
      (typeof resolvedTestIdRef !== 'undefined' && resolvedTestIdRef?.current) ||
      testId ||
      (test?.id ?? null)

    const effPatientId =
      (typeof resolvedPatientIdRef !== 'undefined' && resolvedPatientIdRef?.current) ||
      patientId ||
      null

    const effAssignmentId = assignmentId ?? null

    const key = storageKey({
      testId: effTestId,
      patientId: effPatientId,
      assignmentId: effAssignmentId,
    })
    // Guarda el estado actual, NO uses "built" aquí
    const payload = {
      testId: effTestId,
      patientId: effPatientId,
      assignmentId: effAssignmentId,
      index,
      answers, // <- este es tu estado actual
      updatedAt: new Date().toISOString(),
      version: 1,
    }

    localStorage.setItem(key, JSON.stringify(payload))
    if (toast) toaster.success({ title: 'Progreso guardado' })
  } catch (e) {
    console.error(e)
    toaster.error({ title: 'No se pudo guardar progreso', description: String(e) })
  }
}


  const saveTimer = useRef(null)
  useEffect(() => {
    if (!open) return
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => persist(false), 300)
    return () => clearTimeout(saveTimer.current)
  }, [answers, index, open])

  // ---- HEURÍSTICA ROBUSTA PARA MODO CLÍNICO ----
  const allOpenNoOptions = useMemo(
    () => questions.length > 0 && questions.every(q => q.type === 'open' && (!q.options || q.options.length === 0)),
    [questions]
  )
  const isSacksName = useMemo(
    () => (test?.name || '').toUpperCase().includes('SACKS'),
    [test?.name]
  )
  const isClinicianRun = useMemo(
    () => (String(scoringMode ?? '').toLowerCase() === 'clinician') || isSacksName || allOpenNoOptions,
    [scoringMode, isSacksName, allOpenNoOptions]
  )
  // -----------------------------------------------

  if (!open) return null

  function go(delta) {
    const next = Math.min(Math.max(index + delta, 0), Math.max(0, questions.length - 1))
    setIndex(next)
  }
  function setAnswer(qid, value) { setAnswers(prev => ({ ...prev, [qid]: value })) }
  function answeredCount() {
    let n = 0
    for (const q of questions) {
      const v = answers[q.id]
      if (v == null) continue
      if (Array.isArray(v)) { if (v.length) n++ } else if (String(v).trim() !== '') n++
    }
    return n
  }

  async function handleSaveExit() {
    setSaving(true)
    try { persist(false); toaster.success({ title: 'Progreso guardado localmente' }); onClose?.() }
    finally { setSaving(false) }
  }

  async function handleSubmit() {
    try {
      setSaving(true)
      // 1) construir respuestas normalizadas
      const built = []
      for (const q of questions) {
        const val = answers[q.id]
        if (q.type === 'open') built.push({ questionId: q.id, value: null, values: null, text: String(val ?? '').trim() || null })
        else if (q.type === 'single') built.push({ questionId: q.id, value: val != null ? String(val) : null, values: null, text: null })
        else if (q.type === 'multi') {
          const arr = Array.isArray(val) ? val.map(x => String(x)) : []
          built.push({ questionId: q.id, value: null, values: arr.length ? arr : null, text: null })
        }
      }

      const payload = {
        testId: (resolvedTestIdRef.current || testId), patientId: (resolvedPatientIdRef.current || patientId), assignmentId: assignmentId || null,
        startedAtUtc: startedAtRef.current || new Date().toISOString(),
        finishedAtUtc: new Date().toISOString(),
        answers: built,
      }

      // 2) Rama clínica (SACKS / explícito / todo-open)
      if (isClinicianRun) {
        const { attemptId } = await ClinicianApi.createAttempt({
          testId: (resolvedTestIdRef?.current || testId || test?.id),
          patientId: (resolvedPatientIdRef?.current || patientId) ?? null,
          answers: built
        })

        try { localStorage.removeItem(storageKey({ testId: (resolvedTestIdRef?.current || testId || test?.id), patientId: (resolvedPatientIdRef?.current || patientId), assignmentId })) } catch {}

        toaster.success({ title: 'Respuestas registradas. Abriendo hoja de calificación…' })

        navigate(`/app/clinic/review/${attemptId}?testId=${(resolvedTestIdRef?.current || testId || test?.id)}${(resolvedPatientIdRef?.current || patientId) ? `&patientId=${(resolvedPatientIdRef?.current || patientId)}` : ''}`, {
          replace: true,
          state: {
            reviewAttemptId: attemptId,
            testId,
            testName: test?.name ?? null,
            answers: built,
            patientId: patientId ?? null,
            assignmentId: assignmentId ?? null,
          },
        })
        return
      }

      // 3) Rama automática (mostrar Resultados)
      const data = await TestsApi.submitRun(payload)
      setResult(data)
      toaster.success({ title: 'Resultados calculados' })

      // (opcional) loggear intento auto y persistir respuestas para historial/PDF
      try {
        const { attemptId } = await ClinicianApi.logAutoAttempt({
          testId: (resolvedTestIdRef?.current || testId || test?.id),
          patientId: (resolvedPatientIdRef?.current || patientId) ?? null,
          startedAtUtc: startedAtRef.current || new Date().toISOString(),
        })
        const norm = built.map(a => ({
          questionId: a.questionId,
          text: a.text ?? null,
          value: a.value != null ? String(a.value) : null,
          valuesJson: Array.isArray(a.values) && a.values.length ? JSON.stringify(a.values.map(String)) : null,
        }))
        await ClinicianApi.saveAttemptAnswers(attemptId, norm)
      } catch (e) {
        console.log('No se pudo loggear el intento auto:', e)
      }

      try { localStorage.removeItem(storageKey({ testId: (resolvedTestIdRef?.current || testId || test?.id), patientId: (resolvedPatientIdRef?.current || patientId), assignmentId })) } catch {}
    } catch (e) {
      toaster.error({ title: 'No se pudo enviar el test', description: getErrorMessage(e) })
    } finally {
      setSaving(false)
    }
  }

  function renderQuestion(q) {
    const val = answers[q.id]
    const toKey = (x) => (x == null ? '' : String(x))

    if (q.type === 'single' && q.options?.length) {
      const valueStr = toKey(val)
      return (
        <VStack align="stretch" gap="2">
          {q.options.map(opt => {
            const key = toKey(opt.value ?? opt.id)
            const checked = valueStr === key
            return (
              <label key={opt.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="radio" name={`q-${q.id}`} checked={checked} onChange={() => setAnswer(q.id, key)} />
                <Text>{opt.label}</Text>
              </label>
            )
          })}
        </VStack>
      )
    }

    if (q.type === 'multi' && q.options?.length) {
      const arr = Array.isArray(val) ? val : []
      return (
        <VStack align="stretch" gap="2">
          {q.options.map(opt => {
            const key = toKey(opt.value ?? opt.id)
            const checked = arr.includes(key)
            return (
              <label key={opt.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => {
                    const next = new Set(arr)
                    if (e.target.checked) next.add(key); else next.delete(key)
                    setAnswer(q.id, Array.from(next))
                  }}
                />
                <Text>{opt.label}</Text>
              </label>
            )
          })}
        </VStack>
      )
    }

    return (
      <Textarea
        value={String(val ?? '')}
        onChange={(e) => setAnswer(q.id, e.target.value)}
        placeholder="Escribe tu respuesta…"
        rows={6}
      />
    )
  }

  function ResultsView() {
    const totalRaw = result?.totalRaw ?? null
    const totalPercent = result?.totalPercent ?? null
    const scales = result?.scales || []
    return (
      <Box maxW="980px" mx="auto" borderWidth="1px" rounded="lg" p={{ base: 3, md: 5 }} bg="white">
        <HStack mb="3" align="center" gap="2">
          <FiCheckCircle />
          <Heading size="md">Resultados</Heading>
        </HStack>
        {totalRaw != null && (
          <Box mb="4">
            <Text><b>Total bruto:</b> {Number(totalRaw).toFixed(2)}</Text>
            {totalPercent != null && <Text><b>Total %:</b> {Number(totalPercent).toFixed(2)}%</Text>}
          </Box>
        )}
        <Box borderWidth="1px" rounded="md" overflow="hidden">
          <Table.Root size="sm" variant="outline">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeader minW="180px">Escala</Table.ColumnHeader>
                <Table.ColumnHeader minW="100px">Raw</Table.ColumnHeader>
                <Table.ColumnHeader minW="120px">Min / Max</Table.ColumnHeader>
                <Table.ColumnHeader minW="100px">% (0–100)</Table.ColumnHeader>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {scales.length === 0 ? (
                <Table.Row>
                  <Table.Cell colSpan={4}>
                    <Box py="4" textAlign="center" color="fg.muted">Sin escalas calculadas.</Box>
                  </Table.Cell>
                </Table.Row>
              ) : (
                scales.map(s => (
                  <Table.Row key={s.scaleId || s.code}>
                    <Table.Cell><Text><b>{s.code || s.scaleCode}</b> — {s.name || s.scaleName}</Text></Table.Cell>
                    <Table.Cell>{Number(s.raw).toFixed(2)}</Table.Cell>
                    <Table.Cell>{Number(s.min).toFixed(2)} / {Number(s.max).toFixed(2)}</Table.Cell>
                    <Table.Cell>{(s.max > s.min && s.percent != null) ? `${Number(s.percent).toFixed(2)}%` : '—'}</Table.Cell>
                  </Table.Row>
                ))
              )}
            </Table.Body>
          </Table.Root>
        </Box>
        <HStack justify="flex-end" mt="4">
          <Button onClick={onClose}>Cerrar</Button>
        </HStack>
      </Box>
    )
  }

  const total = questions.length
  const progress = total ? Math.round((answeredCount() / total) * 100) : 0
  const q = questions[index]

  return (
    <Box position="fixed" inset="0" bg="white" zIndex="modal">
      <Box position="sticky" top="0" bg="white" zIndex="1" borderBottomWidth="1px" px="4" py="3">
        <HStack justify="space-between" align="center">
          <HStack gap="3" align="center" overflow="hidden">
            <IconButton aria-label="Cerrar" onClick={onClose}><FiX /></IconButton>
            <VStack align="start" gap="0" minW={0}>
              <Heading size="sm" noOfLines={1}>{test?.name || 'Test'}</Heading>
              <Text fontSize="xs" color="fg.muted">
                {patient?.name ? `Paciente: ${patient.name}` : `Paciente: ${patient?.id ?? '—'}`}
              </Text>
            </VStack>
          </HStack>

          {!result && (
            <HStack gap="3" align="center">
              <Text fontSize="sm" color="fg.muted">{answeredCount()} / {total} respondidas</Text>
              <Box minW="180px" h="8px" bg="blackAlpha.200" rounded="full" overflow="hidden">
                <Box h="100%" w={`${progress}%`} bg="blue.500" transition="width 160ms ease" />
              </Box>
              <Button leftIcon={<FiSave />} variant="outline" onClick={() => persist(true)} isLoading={saving}>
                Guardar
              </Button>
            </HStack>
          )}
        </HStack>
      </Box>

      <Box px={{ base: 3, md: 6 }} py={{ base: 3, md: 6 }}>
        {loading ? (
          <Box h="60vh" display="grid" placeItems="center">
            <HStack color="fg.muted"><Spinner /><Text>Cargando preguntas…</Text></HStack>
          </Box>
        ) : error ? (
          <Box borderWidth="1px" rounded="md" p="4" bg="red.50" borderColor="red.200">
            <Heading size="sm" mb="2" color="red.700">No se pudieron cargar las preguntas</Heading>
            <Text color="red.700">{error}</Text>
          </Box>
        ) : total === 0 ? (
          <Box borderWidth="1px" rounded="md" p="4">
            <Text color="fg.muted">Este test no tiene preguntas configuradas.</Text>
          </Box>
        ) : result ? (
          <ResultsView />
        ) : (
          <Box maxW="980px" mx="auto" borderWidth="1px" rounded="lg" p={{ base: 3, md: 5 }} bg="white">
            <HStack justify="space-between" align="start" mb="3">
              <HStack gap="2" align="center">
                <Badge variant="solid">Pregunta {index + 1} / {total}</Badge>
                {q?.code && <Badge variant="subtle">{q.code}</Badge>}
                {q?.isOptional && <Badge variant="outline">Opcional</Badge>}
                {!!q?.rawType && <Badge variant="subtle">{q.rawType}</Badge>}
              </HStack>
            </HStack>

            <Heading size="md" mb="3">{q?.text}</Heading>
            {renderQuestion(q)}

            <Box my="4" h="1px" bg="blackAlpha.200" />

            <HStack justify="space-between">
              <Button leftIcon={<FiChevronLeft />} onClick={() => go(-1)} disabled={index === 0}>Anterior</Button>
              <HStack>
                <Input
                  type="number" min={1} max={total} value={index + 1}
                  onChange={(e) => {
                    const n = Math.max(1, Math.min(total, parseInt(e.target.value || '1', 10)))
                    setIndex(n - 1)
                  }}
                  w="80px"
                />
                <Text fontSize="sm" color="fg.muted">/ {total}</Text>
              </HStack>
              <Button rightIcon={<FiChevronRight />} onClick={() => go(+1)} disabled={index === total - 1}>Siguiente</Button>
            </HStack>

            <Box my="4" h="1px" bg="blackAlpha.200" />

            <HStack justify="space-between">
              <Button variant="outline" onClick={handleSaveExit} isLoading={saving}>Guardar y salir</Button>
              <Button colorPalette="green" onClick={handleSubmit} isLoading={saving}>
                {isClinicianRun ? 'Terminar y revisar' : 'Terminar y calcular'}
              </Button>
            </HStack>
          </Box>
        )}
      </Box>
    </Box>
  )
}