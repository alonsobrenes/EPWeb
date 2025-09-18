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
import { useBillingStatus, pickEntitlement } from '../../hooks/useBilling'

// Helpers
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

// Banner simple
function Banner({ kind = 'warning', children, mb = '3' }) {
  const bg = kind === 'error' ? 'red.50' : 'yellow.50'
  const border = kind === 'error' ? 'red.200' : 'yellow.200'
  const color = kind === 'error' ? 'red.800' : 'yellow.800'
  return (
    <Box bg={bg} borderWidth="1px" borderColor={border} color={color} rounded="md" p="2" mb={mb}>
      <Text fontSize="sm">{children}</Text>
    </Box>
  )
}

// ===== Scoring fallback =====
function computeResultsFallback({ questions, answers, serverScales = null }) {
  const qByCodeNum = new Map()
  for (const q of questions) {
    const m = (q.code ? String(q.code) : '').match(/(\d+)/)
    if (m) qByCodeNum.set(Number(m[1]), q)
  }
  const isIPA = (questions.length === 45)
  let scaleSkeleton = []
  if (Array.isArray(serverScales) && serverScales.length) {
    scaleSkeleton = serverScales.map(s => ({ code: s.code || s.scaleCode, name: s.name || s.scaleName }))
  } else if (isIPA) {
    scaleSkeleton = [
      { code: 'culpabilidad', name: 'Culpabilidad' },
      { code: 'etiquetas_globales', name: 'Etiquetas globales' },
      { code: 'falacia_de_cambio', name: 'Falacia de cambio' },
      { code: 'falacia_de_control', name: 'Falacia de control' },
      { code: 'falacia_de_justicia', name: 'Falacia de justicia' },
      { code: 'falacia_de_razon', name: 'Falacia de razón' },
      { code: 'falacia_de_recompensa_divina', name: 'Falacia de recompensa divina' },
      { code: 'filtraje', name: 'Filtraje' },
      { code: 'interpretacion_del_pensamiento', name: 'Interpretación del pensamiento' },
      { code: 'los_deberia', name: 'Los “debería”' },
      { code: 'pensamiento_polarizado', name: 'Pensamiento polarizado' },
      { code: 'personalizacion', name: 'Personalización' },
      { code: 'razonamiento_emocional', name: 'Razonamiento emocional' },
      { code: 'sobregeneralizacion', name: 'Sobregeneralización' },
      { code: 'vision_catastrofica', name: 'Visión catastrófica' },
    ]
  }

  function coerceNum(x) { const n = Number(x); return Number.isFinite(n) ? n : null }
  function getMinMax(q) {
    if (q?.options?.length) {
      const nums = q.options.map(o => coerceNum(o?.value)).filter(v => v != null)
      if (nums.length) return { min: Math.min(...nums), max: Math.max(...nums) }
    }
    return { min: 1, max: 4 }
  }
  function valueForQuestion(q, rawVal) {
    if (Array.isArray(rawVal) && rawVal.length) {
      const nums = rawVal.map(coerceNum).filter(v => v != null)
      if (nums.length) return nums.reduce((a,b)=>a+b,0)
    }
    const n = coerceNum(rawVal)
    if (n != null) return n
    if (q?.options && typeof rawVal === 'string') {
      const byLabel = q.options.find(o => String(o.label) === rawVal)
      const n2 = coerceNum(byLabel?.value)
      if (n2 != null) return n2
    }
    return null
  }

  const outScales = []
  let totalRaw = 0, totalMin = 0, totalMax = 0

  for (let i = 0; i < scaleSkeleton.length; i++) {
    const s = scaleSkeleton[i]
    let scaleRaw = 0, scaleMin = 0, scaleMax = 0
    const itemCodes = isIPA ? [i + 1, i + 16, i + 31] : []

    for (const num of itemCodes) {
      const q = qByCodeNum.get(num)
      if (!q) continue
      const { min, max } = getMinMax(q)
      const ans = answers[q.id]
      const val = valueForQuestion(q, ans)
      const scored = (val != null) ? val : min
      scaleRaw += scored
      scaleMin += min
      scaleMax += max
    }

    totalRaw += scaleRaw
    totalMin += scaleMin
    totalMax += scaleMax

    const percent = (scaleMax > scaleMin) ? ((scaleRaw - scaleMin) / (scaleMax - scaleMin)) * 100 : null
    outScales.push({
      scaleCode: s.code, scaleName: s.name,
      raw: Number(scaleRaw.toFixed(4)),
      min: Number(scaleMin.toFixed(4)),
      max: Number(scaleMax.toFixed(4)),
      percent: (percent == null) ? null : Number(percent.toFixed(4)),
    })
  }

  const totalPercent = (totalMax > totalMin) ? ((totalRaw - totalMin) / (totalMax - totalMin)) * 100 : null
  return {
    totalRaw: Number(totalRaw.toFixed(4)),
    totalPercent: (totalPercent == null) ? null : Number(totalPercent.toFixed(4)),
    scales: outScales,
  }
}

export default function TestRunnerFullScreen({ open, onClose, test, patient, assignmentId = null }) {
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

  // IA Opinion (auto)
  const [aiText, setAiText] = useState('')
  const [loadingAi, setLoadingAi] = useState(false)
  const [savingAi, setSavingAi] = useState(false)
  const [attemptIdAuto, setAttemptIdAuto] = useState(null)
  const [aiLimitReached, setAiLimitReached] = useState(false)

  // Billing (solo para tests auto)
  const { data: billing, refresh: refreshBilling } = useBillingStatus()
  const testsEnt = pickEntitlement(billing, 'tests.auto.monthly')

  // Predicción + valor "congelado" para el banner post-envío
  const predictedRemainingAfterSubmitRef = useRef(null)
  const firstRemainingAfterRef = useRef(null) // ← fix: congelamos el primer remaining visto en Resultados

  // scoring_mode
  const [scoringMode, setScoringMode] = useState(() => (test?.scoring_mode ?? test?.scoringMode ?? null))
  useEffect(() => {
    const sm = test?.scoring_mode ?? test?.scoringMode ?? null
    if (sm && sm !== scoringMode) setScoringMode(sm)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [test?.scoring_mode, test?.scoringMode])

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
        // Resolver testId/patientId desde asignación si hace falta
        let tid = testId, pid = patientId
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
            id: q.id, code: q.code, text: q.text,
            rawType: rawType || '', type: finalType,
            isOptional: !!q.isOptional, order: q.orderNo || q.order_no || 0,
            options,
          }
        }).sort((a, b) => (a.order - b.order))

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
        setError(getErrorMessage(e))
      } finally {
        if (alive) setLoading(false)
      }
    }
    load()
    return () => { alive = false }
  }, [open, testId, patientId, assignmentId])

  function persist(toast = false) {
    try {
      const effTestId =
        (resolvedTestIdRef?.current) || testId || (test?.id ?? null)
      const effPatientId =
        (resolvedPatientIdRef?.current) || patientId || null
      const effAssignmentId = assignmentId ?? null

      const key = storageKey({ testId: effTestId, patientId: effPatientId, assignmentId: effAssignmentId })
      const payload = { testId: effTestId, patientId: effPatientId, assignmentId: effAssignmentId, index, answers, updatedAt: new Date().toISOString(), version: 1 }
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

  // Modo clínico (SACKS / todo-open / explicit)
  const allOpenNoOptions = useMemo(
    () => questions.length > 0 && questions.every(q => q.type === 'open' && (!q.options || q.options.length === 0)),
    [questions]
  )
  const isSacksName = useMemo(() => (test?.name || '').toUpperCase().includes('SACKS'), [test?.name])
  const isClinicianRun = useMemo(
    () => (String(scoringMode ?? '').toLowerCase() === 'clinician') || isSacksName || allOpenNoOptions,
    [scoringMode, isSacksName, allOpenNoOptions]
  )

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
      // 1) respuestas normalizadas
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

      // 2) SACKS / clínico
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
          state: { reviewAttemptId: attemptId, testId, testName: test?.name ?? null, answers: built, patientId: patientId ?? null, assignmentId: assignmentId ?? null },
        })
        return
      }

      // 3) Automático
      let data
      try {
        // antes de enviar, calculamos remaining pre
        const preRemaining = (testsEnt && testsEnt.limit !== null) ? (testsEnt.remaining ?? null) : null
        if (preRemaining != null) {
          predictedRemainingAfterSubmitRef.current = Math.max(0, preRemaining - 1)
        } else {
          predictedRemainingAfterSubmitRef.current = null
        }

        data = await TestsApi.submitRun(payload)
            } catch (e) {
        const status = e?.response?.status ?? e?.status
        if (status === 402) {
          // Gracia: permitimos “aterrizar” mostrando resultados locales y registrando intento clínico
          toaster.error({
            title: 'Límite del plan',
            description: 'Has alcanzado el límite mensual de Tests automáticos. Guardaremos este test para revisión clínica.'
          })

          // 1) Resultados locales (fallback) para que el usuario vea algo
          const fb = computeResultsFallback({ questions, answers, serverScales: null })
          setResult(fb)

          // 2) Registrar intento clínico  respuestas, como en el bloque normal más abajo
          try {
            const { attemptId } = await ClinicianApi.createAttempt({
              testId: (resolvedTestIdRef?.current || testId || test?.id),
              patientId: (resolvedPatientIdRef?.current || patientId) ?? null,
              answers: built
            })
            setAttemptIdAuto(attemptId)

            const norm = built.map(a => ({
              questionId: a.questionId,
              text: a.text ?? null,
              value: a.value != null ? String(a.value) : null,
              valuesJson: Array.isArray(a.values) && a.values.length ? JSON.stringify(a.values.map(String)) : null,
            }))
            await ClinicianApi.saveAttemptAnswers(attemptId, norm)

            // 3) Intentar IA (respetando su propia cuota)
            try {
              setLoadingAi(true)
              const gen = await ClinicianApi.generateAttemptAiOpinion?.(attemptId, { model: 'gpt-4o-mini', promptVersion: 'v1.0' })
              const text = gen?.opinionText || gen?.text || ''
              if (text) setAiText(text)
              else {
                try {
                  const ai = await ClinicianApi.getAttemptAiOpinion(attemptId)
                  const t = ai?.opinionText || ai?.text || ''
                  if (t) setAiText(t)
                } catch {}
              }
            } catch (err2) {
              const st2 = err2?.response?.status ?? err2?.status
              if (st2 === 402) {
                setAiLimitReached(true)
                setAiText('Límite del plan: Opiniones IA agotadas este mes.')
              } else {
                console.debug('No se pudo generar/leer opinión IA (fallback 402):', err2)
              }
            } finally {
              setLoadingAi(false)
            }
          } catch (logErr) {
            console.debug('No se pudo loggear intento clínico tras 402:', logErr)
          }

          try { localStorage.removeItem(storageKey({ testId: (resolvedTestIdRef?.current || testId || test?.id), patientId: (resolvedPatientIdRef?.current || patientId), assignmentId })) } catch {}
          if (typeof refreshBilling === 'function') refreshBilling()
          // IMPORTANTE: no retornamos; dejamos que el flujo continúe con el ResultsView ya montado
          return
        }
        throw e
      }

      // resultados
      const invalid = !data || !Array.isArray(data.scales) || data.scales.length === 0 ||
                      data.scales.every(s => Number(s.min) === 0 && Number(s.max) === 0)
      setResult(invalid ? computeResultsFallback({ questions, answers, serverScales: data?.scales || null }) : data)
      toaster.success({ title: 'Resultados calculados' })

      // log y opinión IA
      try {
        const { attemptId } = await ClinicianApi.logAutoAttempt({
          testId: (resolvedTestIdRef?.current || testId || test?.id),
          patientId: (resolvedPatientIdRef?.current || patientId) ?? null,
          startedAtUtc: startedAtRef.current || new Date().toISOString(),
        })
        setAttemptIdAuto(attemptId)
        const norm = built.map(a => ({
          questionId: a.questionId,
          text: a.text ?? null,
          value: a.value != null ? String(a.value) : null,
          valuesJson: Array.isArray(a.values) && a.values.length ? JSON.stringify(a.values.map(String)) : null,
        }))
        await ClinicianApi.saveAttemptAnswers(attemptId, norm)

        try {
          setLoadingAi(true)
          const gen = await ClinicianApi.generateAttemptAiOpinion?.(attemptId, { model: 'gpt-4o-mini', promptVersion: 'v1.0' })
          const text = gen?.opinionText || gen?.text || ''
          if (text) setAiText(text)
          else {
            try {
              const ai = await ClinicianApi.getAttemptAiOpinion(attemptId)
              const t = ai?.opinionText || ai?.text || ''
              if (t) setAiText(t)
            } catch {}
          }
        } catch (e) {
          const status = e?.response?.status ?? e?.status
          if (status === 402) {
            setAiLimitReached(true)
            setAiText('Límite del plan: Opiniones IA agotadas este mes.')
            if (typeof refreshBilling === 'function') refreshBilling()
          } else {
            console.debug('No se pudo generar/leer opinión IA:', e)
          }
        } finally {
          setLoadingAi(false)
        }
      } catch (e) {
        console.log('No se pudo loggear el intento auto:', e)
      }

      try { localStorage.removeItem(storageKey({ testId: (resolvedTestIdRef?.current || testId || test?.id), patientId: (resolvedPatientIdRef?.current || patientId), assignmentId })) } catch {}
      if (typeof refreshBilling === 'function') refreshBilling()
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

  async function saveAiOpinion() {
    try {
      if (!attemptIdAuto) { toaster.error({ title: 'Aún no hay intento registrado' }); return }
      const pid = (resolvedPatientIdRef?.current || patientId) ?? null
      if (!pid) { toaster.error({ title: 'Falta paciente', description: 'No se puede guardar sin patientId' }); return }
      setSavingAi(true)
      await ClinicianApi.upsertAttemptAiOpinion(attemptIdAuto, { patientId: pid, text: aiText })
      toaster.success({ title: 'Opinión de IA guardada' })
    } catch (e) {
      toaster.error({ title: 'No se pudo guardar opinión', description: getErrorMessage(e) })
    } finally {
      setSavingAi(false)
    }
  }

  function ResultsView() {
    const totalRaw = result?.totalRaw ?? null
    const totalPercent = result?.totalPercent ?? null
    const scales = result?.scales || []

    // Calculamos el remaining post-envío. Tomamos el PRIMER valor y lo "congelamos" para evitar parpadeo.
    const entNow = pickEntitlement(billing, 'tests.auto.monthly')
    const currentRemaining = (entNow && entNow.limit !== null && typeof entNow.remaining === 'number')
      ? entNow.remaining
      : predictedRemainingAfterSubmitRef.current

    if (firstRemainingAfterRef.current === null) {
      firstRemainingAfterRef.current = currentRemaining
    }
    const frozenRemaining = firstRemainingAfterRef.current
    const showYellowRemaining1 = frozenRemaining === 1

    return (
      <Box maxW="980px" mx="auto" borderWidth="1px" rounded="lg" p={{ base: 3, md: 5 }} bg="white">
        <HStack mb="3" align="center" gap="2">
          <FiCheckCircle />
          <Heading size="md">Resultados</Heading>
        </HStack>

        {showYellowRemaining1 && (
          <Banner kind="warning" mb="2">
            Te queda 1 test automático este mes.
          </Banner>
        )}

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
                  <Table.Row key={s.scaleId || s.code || s.scaleCode}>
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

        {/* Opinión IA */}
        <Box mt="6" borderWidth="1px" rounded="md" p="3" position="relative">
          <Heading size="sm" mb="3">Opinión del asistente de IA</Heading>

          {aiLimitReached && (
            <Banner kind="error" mb="2">
              Límite mensual de Opiniones IA agotado para tu plan.
            </Banner>
          )}

          {loadingAi && (
            <HStack position="absolute" inset="0" bg="whiteAlpha.700" justify="center" align="center" zIndex="1">
              <Spinner />
              <Text fontSize="sm" ml="2">Generando opinión…</Text>
            </HStack>
          )}
          <textarea
            style={{
              width: '100%',
              minHeight: '260px',
              maxHeight: '60vh',
              resize: 'vertical',
              padding: '12px',
              boxSizing: 'border-box',
              border: '1px solid rgba(0,0,0,0.2)',
              borderRadius: '8px',
              fontSize: '14px',
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
              overflowY: 'auto'
            }}
            placeholder="Síntesis generada por IA (solo lectura)"
            value={aiText}
            onChange={(e) => setAiText(e.target.value)}
            disabled={loadingAi}
            readOnly
          />
          <HStack justify="flex-end" mt="12px" display="none">
            <Button onClick={saveAiOpinion} isLoading={savingAi} disabled={loadingAi || !attemptIdAuto}>Guardar</Button>
          </HStack>
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

  // Envío auto: deshabilitar cuando ya no hay cupo.
  const submitDisabled =
    (!isClinicianRun) && (testsEnt?.limit !== null) && (testsEnt?.remaining <= 0)

  // No mostramos near-limit en preguntas
  const submitNearLimit = false

  return (
    <Box position="fixed" inset="0" bg="white" zIndex="modal" h="100vh" overflowY="auto" style={{ WebkitOverflowScrolling: "touch" }}>
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

      <Box px={{ base: 3, md: 6 }} py={{ base: 3, md: 6 }} pb={{ base: 24, md: 12 }}>
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

            {/* sin near-limit en preguntas */}
            {!isClinicianRun && submitNearLimit && !submitDisabled && (
              <Banner>Te quedan {testsEnt?.remaining} tests automáticos este mes.</Banner>
            )}
            {!isClinicianRun && submitDisabled && (
              <Banner kind="error">Límite mensual de Tests automáticos agotado para tu plan.</Banner>
            )}

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
              <Button
                colorPalette="green"
                onClick={handleSubmit}
                isLoading={saving}
                disabled={submitDisabled}
              >
                {isClinicianRun ? 'Terminar y revisar' : 'Terminar y calcular'}
              </Button>
            </HStack>
          </Box>
        )}
      </Box>
    </Box>
  )
}
