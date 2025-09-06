// ===============================
// src/pages/clinic/ReviewSimpleReadOnly.jsx
// ===============================
import { useEffect, useMemo, useState } from "react"
import { useLocation, useNavigate, useParams } from "react-router-dom"
import {
  Box, Card, HStack, VStack, Heading, Text, Button,
  Spinner, Badge, Table
} from "@chakra-ui/react"
import ClinicianApi from "../../api/clinicianApi"
import { TestsApi } from "../../api/testsApi"
import { toaster } from "../../components/ui/toaster"

function normalizeType(qtRaw) {
  const t = String(qtRaw || "").toLowerCase().trim()
  if (!t) return "open"
  if (t === "open_text" || t === "open" || t === "text" || t === "open-ended" || t === "written" || t === "essay") return "open"
  if (t.includes("multi")) return "multi"
  if (t === "single" || t === "choice" || t.includes("radio")) return "single"
  if (t === "yesno" || t === "yes-no" || t === "yes_no" || t === "yn" || t === "bool" || t === "boolean") return "single"
  if (t === "likert" || t.startsWith("likert")) return "single"
  return "open"
}
function parseLikertSpec(rawType) {
  const t = String(rawType || "").toLowerCase().trim()
  if (!t.startsWith("likert")) return null
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
  if (start === 0 && end === 3) return ["Nunca", "A veces", "A menudo", "Siempre"]
  if (start === 1 && end === 4) return ["Nunca", "Algunas veces", "Bastante", "Siempre"]
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
    { id: `${qid}-yesno-1`, value: 1, label: "Sí", order: 1 },
    { id: `${qid}-yesno-0`, value: 0, label: "No", order: 2 },
  ]
}
function toDisplayAnswer(a) {
  if (!a || typeof a !== "object") return ""
  const t = a.answerText ?? a.text
  if (t && String(t).trim()) return String(t).trim()
  if (Array.isArray(a.values) && a.values.length) return a.values.map(String).join(", ")
  if (typeof a.answerValuesJson === "string") {
    try { const arr = JSON.parse(a.answerValuesJson); if (Array.isArray(arr)) return arr.join(", ") } catch {}
  }
  const v = a.answerValue ?? a.value
  return v == null ? "" : String(v)
}



// ===== Fallback local para calcular resultados por escalas =====
// Objetivo: restaurar el comportamiento previo y hacerlo más robusto sin romper nada.
// - Usa s.items si está presente (forma antigua que funcionaba)
// - Acepta variantes: scaleItems, itemIds/itemsIds, questionIds/question_ids
// - Si no hay items y es IPA (45 q / 15 escalas), aplica triadas (1,16,31…)
// - Si no hay metadatos por ítem, asume Likert 1–4 para min/max

// ===== Fallback local para calcular resultados por escalas (robusto y retrocompatible) =====
// ===== Fallback EXÁCTO para calcular resultados por escalas =====
// Usar *tal cual* en lugar de la versión actual.
async function computeResultsFallback(effectiveTestId, questions, answersByQ) {
  // 1) Traer escalas con items (preguntas por escala)
  const sw = await ClinicianApi.getScalesWithItems(effectiveTestId)
  const scales = Array.isArray(sw?.scales) ? sw.scales : []
  const qById = new Map(questions.map(q => [q.id, q]))

  // Helpers numéricos seguros
  const toNum = (v) => {
    if (v == null) return null
    if (typeof v === 'number' && Number.isFinite(v)) return v
    const s = String(v).trim()
    if (/^-?\d+(?:[.,]\d+)?$/.test(s)) return Number(s.replace(',', '.'))
    return null
  }

  // Min/Max por pregunta a partir de opciones (si no hay, se infiere por tipo)
  function getQMinMax(q) {
    const opts = Array.isArray(q.options) ? q.options : []
    const nums = opts.map(o => toNum(o.value)).filter(n => n != null)

    if (q.type === 'multi') {
      // multi: min 0, max = suma de valores positivos únicos
      const pos = nums.filter(n => n > 0)
      const max = pos.reduce((a, b) => a + b, 0)
      return { min: 0, max: max || 0 }
    }

    if (nums.length > 0) {
      return { min: Math.min(...nums), max: Math.max(...nums) }
    }

    // Likert inferido por rawType (si quedó algo en rawType con rango)
    const spec = parseLikertSpec(q.rawType || '')
    if (spec) return { min: spec.start, max: spec.end }

    // Sí/No sin opciones
    const t = (q.rawType || '').toLowerCase()
    if (t === 'yesno' || t === 'yes-no' || t === 'yes_no' || t === 'yn' || t === 'bool' || t === 'boolean') {
      return { min: 0, max: 1 }
    }

    // Triadas sin valores: asumimos 3 categorías equiespaciadas 1..3
    if ((q.type === 'single' || q.type === 'multi') && (opts.length === 3 || t.includes('triad'))) {
      return { min: 1, max: 3 }
    }

    // Último recurso: 1..4 (no debería ocurrir si ya construimos opciones arriba)
    return { min: 1, max: 4 }
  }

  // Valor numérico de la respuesta de una pregunta
  function getAnswerNumeric(q) {
    const ans = answersByQ[q.id] || {}

    // SINGLE
    if (q.type === 'single') {
      // intento directo con value
      const nv = toNum(ans.value)
      if (nv != null) return nv

      // mapear por label → value
      if (ans.text && Array.isArray(q.options)) {
        const opt = q.options.find(o => String(o.label) === String(ans.text))
        const nv2 = toNum(opt?.value)
        if (nv2 != null) return nv2
      }

      // mapear por value string → opción
      if (ans.value != null && Array.isArray(q.options)) {
        const opt = q.options.find(o => String(o.value) === String(ans.value))
        const nv3 = toNum(opt?.value)
        if (nv3 != null) return nv3
      }

      // sin dato: devolver null (se contará como min)
      return null
    }

    // MULTI → suma de valores seleccionados
    if (q.type === 'multi') {
      // vector ya normalizado
      let values = Array.isArray(ans.values) ? ans.values.slice() : []
      // o JSON crudo
      if (!values.length && typeof ans.answerValuesJson === 'string') {
        try { const tmp = JSON.parse(ans.answerValuesJson); if (Array.isArray(tmp)) values = tmp } catch {}
      }

      if (!values.length) return 0
      const set = new Set(values.map(v => String(v))) // para deduplicar

      let sum = 0
      for (const opt of (q.options || [])) {
        const pick = set.has(String(opt.value)) || set.has(String(opt.id)) || set.has(String(opt.label))
        if (pick) {
          const nv = toNum(opt.value)
          if (nv != null) sum += nv
        }
      }
      return sum
    }

    // OPEN → sin puntaje
    return 0
  }

  // 2) Recorrer escalas y acumular con min/max exactos por ítem
  const outScales = []
  let totalRaw = 0, totalMin = 0, totalMax = 0

  for (const s of scales) {
    const items = Array.isArray(s.items) ? s.items : []
    let raw = 0, min = 0, max = 0

    for (const it of items) {
      const q = qById.get(it.id)
      if (!q) continue

      const mm = getQMinMax(q)
      const val = getAnswerNumeric(q)

      // si no hay respuesta, tomar el mínimo de la pregunta
      const use = (val == null ? mm.min : val)

      raw += use
      min += mm.min
      max += mm.max
    }

    totalRaw += raw
    totalMin += min
    totalMax += max

    const percent = (max > min) ? ((raw - min) / (max - min)) * 100 : null
    outScales.push({
      scaleId: s.id,
      scaleCode: s.code,
      scaleName: s.name,
      raw: Number(raw.toFixed(4)),
      min: Number(min.toFixed(4)),
      max: Number(max.toFixed(4)),
      percent: percent == null ? null : Number(percent.toFixed(4)),
    })
  }

  const totalPercent = (totalMax > totalMin) ? ((totalRaw - totalMin) / (totalMax - totalMin)) * 100 : null
  return {
    totalRaw: Number(totalRaw.toFixed(4)),
    totalPercent: totalPercent == null ? null : Number(totalPercent.toFixed(4)),
    scales: outScales,
  }
}

export default function ReviewSimpleReadOnly() {
  const { attemptId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
console.log("XXXX")
  const qs = new URLSearchParams(location.search)
  const testIdQS = qs.get("testId") || location.state?.testId || null
  const testName = location.state?.testName || null

  const [loading, setLoading] = useState(true)
  const [meta, setMeta] = useState(null)
  const [questions, setQuestions] = useState([])
  const [answersByQ, setAnswersByQ] = useState({})
  const [result, setResult] = useState(null)

  // Opinión de IA
  const [aiText, setAiText] = useState("")
  const [loadingAi, setLoadingAi] = useState(true)
  const [savingAi, setSavingAi] = useState(false)

  // Borde vertical utilitario
  const colBorder = { borderLeftWidth: "1px", borderLeftColor: "blackAlpha.200" }

  const optionColumns = useMemo(() => {
    const cols = []
    const seen = new Set()
    const add = (label) => {
      const key = String(label)
      if (!seen.has(key)) { seen.add(key); cols.push(key) }
    }
    for (const q of questions) {
      if ((q.type === "single" || q.type === "multi") && q.options?.length) {
        for (const o of q.options) add(o.label)
      }
    }
    return cols
  }, [questions])

  const hasOpen = useMemo(
    () => questions.some(q => q.type === "open"),
    [questions]
  )

  const isTriads = useMemo(() => {
    if (questions.length === 0) return false
    const with3 = questions.filter(q =>
      (q.type === "single" || q.type === "multi") && (q.options?.length === 3)
    ).length
    return with3 >= Math.max(3, Math.floor(questions.length * 0.9))
  }, [questions])

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setLoading(true)
        const m = await ClinicianApi.getAttemptMeta(attemptId)
        if (!alive) return
        setMeta(m)
        const effectiveTestId = m?.testId || testIdQS
        if (!effectiveTestId) throw new Error("No se pudo determinar el test")

        const [qsRun, optsRun] = await Promise.all([
          TestsApi.getQuestions(effectiveTestId),
          TestsApi.getQuestionOptionsByTest(effectiveTestId),
        ])

        const byQ = new Map()
        for (const o of (optsRun || [])) {
          if (o.isActive === false) continue
          const qid = o.questionId || o.question_id
          if (!byQ.has(qid)) byQ.set(qid, [])
          byQ.get(qid).push({ id: o.id, label: o.label, value: o.value, order: o.orderNo || o.order_no || 0 })
        }
        for (const arr of byQ.values()) arr.sort((a, b) => (a.order - b.order))

        const norm = (qsRun || []).map((q) => {
          const rawType = q.questionType || q.question_type
          const baseType = normalizeType(rawType)
          const options = (byQ.get(q.id) || []).slice()
          const rtl = String(rawType || "").toLowerCase()

          if (rtl.startsWith("likert") && options.length === 0) buildLikertOptions(rawType, q.id).forEach(o => options.push(o))
          if ((rtl === "yesno" || rtl === "yes-no" || rtl === "yes_no" || rtl === "yn" || rtl === "bool" || rtl === "boolean") && options.length === 0)
            buildYesNoOptions(q.id).forEach(o => options.push(o))

          const finalType =
            (baseType === "open")  ? "open"  :
            (baseType === "multi") ? "multi" :
            (options.length > 0)   ? "single" : baseType

          return {
            id: q.id,
            code: q.code,
            text: q.text,
            rawType: rawType || "",
            type: finalType,
            order: q.orderNo || q.order_no || 0,
            options,
          }
        }).sort((a, b) => (a.order - b.order))

        if (!alive) return
        setQuestions(norm)

        const ansWrap = await ClinicianApi.getAttemptAnswers(attemptId)
        const raw = Array.isArray(ansWrap) ? ansWrap
          : Array.isArray(ansWrap?.items) ? ansWrap.items
          : Array.isArray(ansWrap?.answers) ? ansWrap.answers : []
        const map = {}
        for (const a of raw) {
          const qid = a.questionId ?? a.question_id ?? a.id
          if (!qid) continue
          map[qid] = {
            text: a.answerText ?? a.text ?? null,
            value: a.answerValue ?? a.value ?? null,
            values: (Array.isArray(a.values) ? a.values
              : (typeof a.answerValuesJson === "string" ? (() => { try { return JSON.parse(a.answerValuesJson) } catch { return [] } })() : [])),
          }
        }
        setAnswersByQ(map)

        // Cargar opinión de IA (no bloquea)
        try {
          const ai = await ClinicianApi.getAttemptAiOpinion(attemptId)
          const text = ai?.opinionText || ai?.text || ""
          setAiText(text)
        } catch {}
        finally { setLoadingAi(false) }

        // ==== RECÁLCULO (server) con tolerancia y Fallback local ====
        try {
          const built = norm.map(q => {
            const r = map[q.id] || {}
            if (q.type === "open")   return { questionId: q.id, answerText: (r.text ?? null), value: null, values: null }
            if (q.type === "single") {
              let v = r.value
              if (v != null && typeof v === 'string' && /^\d+(?:\.\d+)?$/.test(v)) v = Number(v)
              return { questionId: q.id, answerValue: v ?? null, value: v ?? null, values: null }
            }
            const arr = Array.isArray(r.values) ? r.values.map(v => (typeof v === 'string' && /^\d+(?:\.\d+)?$/.test(v) ? Number(v) : v)) : []
            return { questionId: q.id, answerValues: arr.length ? arr : null, value: null, values: arr.length ? arr : null }
          })

          const nowIso = new Date().toISOString()
          const effPid = m?.patientId || qs.get("patientId") || location.state?.patientId || null
          const res = await TestsApi.submitRun({
            testId: effectiveTestId,
            patientId: effPid,
            startedAtUtc: m?.startedAtUtc ?? nowIso,
            finishedAtUtc: m?.updatedAtUtc ?? nowIso,
            answers: built,
          })
          if (!alive) return
          // Logs para depurar el submit
          console.log('[submitRun] answers sample', built.slice(0,3))
          console.log('[submitRun] server scales', Array.isArray(res?.scales) ? res.scales.map(s => ({code:s.code, min:s.min, max:s.max, raw:s.raw})) : res?.scales)

          const invalid = !res || !Array.isArray(res.scales) || res.scales.length === 0 ||
                          res.scales.every(s => Number(s.min) === 0 && Number(s.max) === 0)

          if (invalid) {
            console.log('[fallback] submitRun devolvió escalas inválidas; recalculando en cliente')
            const fk = await computeResultsFallback(effectiveTestId, norm, map, res?.scales || null)
            setResult(fk || null)
          } else {
            setResult(res || null)
          }
        } catch (e) {
          console.log("No se pudieron recalcular resultados para lectura (usando Fallback local)", e)
          try {
            const fk = await computeResultsFallback(effectiveTestId, norm, map)
            if (!alive) return
            setResult(fk)
          } catch (inner) {
            console.warn("Fallback local también falló:", inner)
            setResult(null)
          }
        }
      } catch (e) {
        toaster.error({ title: "No se pudo cargar la vista", description: e?.message || "Error" })
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [attemptId, testIdQS])

  const backToRaw = new URLSearchParams(location.search).get("backTo")
  const goBackHref =
    (backToRaw ? decodeURIComponent(backToRaw) : null) ||
    (meta?.patientId
      ? `/app/clinic/pacientes?openPatientId=${meta.patientId}&tab=hist`
      : "/app/clinic/evaluaciones")

  if (loading) {
    return (
      <HStack color="fg.muted" p="4">
        <Spinner /><Text>Cargando intento…</Text>
      </HStack>
    )
  }

  function isSelected(q, colLabel) {
    const a = answersByQ[q.id] || {}
    if (q.type === "single") {
      const val = a.value != null ? String(a.value) : null
      const opt = q.options?.find(o => String(o.value) === val)
      return opt && String(opt.label) === String(colLabel)
    }
    if (q.type === "multi") {
      const arr = Array.isArray(a.values) ? a.values.map(String) : []
      const setVals = new Set(arr)
      return q.options?.some(o => (String(o.label) === String(colLabel) && setVals.has(String(o.value))))
    }
    return false
  }

  function ResultsBlock() {
    const totalRaw = result?.totalRaw ?? null
    const totalPercent = result?.totalPercent ?? null
    const scales = result?.scales || []
    return (
      <Box borderWidth="1px" rounded="lg" p={{ base: 3, md: 4 }} bg="white">
        <HStack mb="3" align="center" gap="2">
          <Heading as="h3" size="sm">Resultados</Heading>
        </HStack>
        {totalRaw != null && (
          <Box mb="3">
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
                    <Table.Cell>{(s.max > s.min && s.percent != null) ? `${Number(s.percent).toFixed(2)}%` : "—"}</Table.Cell>
                  </Table.Row>
                ))
              )}
            </Table.Body>
          </Table.Root>
        </Box>
      </Box>
    )
  }

  async function saveAiOpinion() {
    try {
      const pid = meta?.patientId || meta?.patient_id || new URLSearchParams(location.search).get("patientId") || null
      if (!pid) { toaster.error({ title: "Falta paciente", description: "No se puede guardar sin patientId" }); return }
      setSavingAi(true)
      await ClinicianApi.upsertAttemptAiOpinion(attemptId, { patientId: pid, text: aiText })
      toaster.success({ title: "Opinión de IA guardada" })
    } catch (e) {
      toaster.error({ title: "No se pudo guardar opinión", description: e?.message || "Error" })
    } finally {
      setSavingAi(false)
    }
  }

  return (
    <VStack align="stretch" gap="4">
      <Card.Root p="3" position="sticky" top="0" zIndex="docked" bg="white" borderBottomWidth="1px">
        <HStack justify="space-between" wrap="wrap" gap="3">
          <HStack gap="3">
            <Heading size="sm">Vista de intento — {testName || "Evaluación"}</Heading>
            <Badge variant="subtle">{meta?.status}</Badge>
          </HStack>
          {/* ← SIN state extra ni closeDialog */}
          <Button onClick={() => navigate(goBackHref, { replace: true })}>
            Volver
          </Button>
        </HStack>
      </Card.Root>

      <Card.Root p="4">
        {isTriads ? (
          <Box borderWidth="1px" rounded="md" overflow="auto">
            <Table.Root size="sm" variant="outline">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeader minW="90px">Código</Table.ColumnHeader>
                  <Table.ColumnHeader minW="520px">Opciones (elige una)</Table.ColumnHeader>
                  <Table.ColumnHeader textAlign="center" minW="70px"></Table.ColumnHeader>
                  <Table.ColumnHeader textAlign="center" minW="70px"></Table.ColumnHeader>
                  <Table.ColumnHeader textAlign="center" minW="70px"></Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {questions.map(q => {
                  const a = answersByQ[q.id] || {}
                  const val = a.value != null ? String(a.value) : null
                  const opts = (q.options || []).slice(0, 3)
                  while (opts.length < 3) opts.push({ id: `${q.id}-empty-${opts.length}`, value: "", label: "" })
                  return (
                    <Table.Row key={q.id} verticalAlign="top">
                      <Table.Cell>{q.code}</Table.Cell>
                      <Table.Cell>
                        <VStack align="start" gap="1">
                          {opts.map((opt, idx) => (
                            <Text key={`${q.id}-line-${idx}`} fontSize="sm">{opt.label}</Text>
                          ))}
                        </VStack>
                      </Table.Cell>
                      {opts.map((opt, idx) => {
                        const selected = val != null && String(opt.value) === val
                        return (
                          <Table.Cell key={`${q.id}-mark-${idx}`} textAlign="center">
                            {selected ? "✓" : ""}
                          </Table.Cell>
                        )
                      })}
                    </Table.Row>
                  )
                })}
              </Table.Body>
            </Table.Root>
          </Box>
        ) : (
          <Box borderWidth="1px" rounded="md" overflow="auto">
            <Table.Root size="sm" variant="outline">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeader minW="80px">Código</Table.ColumnHeader>
                  <Table.ColumnHeader minW="360px">Pregunta</Table.ColumnHeader>
                  {optionColumns.map((lbl) => (
                    <Table.ColumnHeader key={`col-${lbl}`} textAlign="center" minW="90px">
                      {lbl}
                    </Table.ColumnHeader>
                  ))}
                  {hasOpen && <Table.ColumnHeader minW="240px">Respuesta (texto)</Table.ColumnHeader>}
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {questions.map(q => {
                  const a = answersByQ[q.id] || {}
                  const openText = q.type === "open" ? (a.text ?? toDisplayAnswer(a)) : ""
                  return (
                    <Table.Row key={q.id}>
                      <Table.Cell>{q.code}</Table.Cell>
                      <Table.Cell>{q.text}</Table.Cell>
                      {optionColumns.map(lbl => (
                        <Table.Cell key={`cell-${q.id}-${lbl}`} textAlign="center">
                          {(q.type === "single" || q.type === "multi") && isSelected(q, lbl) ? "✓" : ""}
                        </Table.Cell>
                      ))}
                      {hasOpen && <Table.Cell>{openText}</Table.Cell>}
                    </Table.Row>
                  )
                })}
              </Table.Body>
            </Table.Root>
          </Box>
        )}
      </Card.Root>

      {result && (
        <Card.Root p="4">
          <ResultsBlock />
        </Card.Root>
      )}

      <Card.Root p="4">
        <Heading size="sm" mb="3">Opinión del asistente de IA</Heading>
        <Table.Root>
          <Table.Body>
            <Table.Row>
              <Table.Cell>
                <Box>
                  <textarea
                    style={{ width: '100%', minHeight: '160px' }}
                    placeholder="Síntesis generada por IA (editable)"
                    value={aiText}
                    onChange={(e) => setAiText(e.target.value)}
                    disabled={loadingAi}
                    readOnly
                  />
                </Box>
                {/* <HStack justify="end" mt="12px">
                  <Button onClick={saveAiOpinion} isLoading={savingAi} disabled={loadingAi}>Guardar</Button>
                </HStack> */}
              </Table.Cell>
            </Table.Row>
          </Table.Body>
        </Table.Root>
      </Card.Root>
    </VStack>
  )
}
