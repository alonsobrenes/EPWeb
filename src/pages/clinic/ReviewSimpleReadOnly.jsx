// src/pages/clinic/ReviewSimpleReadOnly.jsx
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

export default function ReviewSimpleReadOnly() {
  const { attemptId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()

  const qs = new URLSearchParams(location.search)
  const testIdQS = qs.get("testId") || location.state?.testId || null
  const testName = location.state?.testName || null

  const [loading, setLoading] = useState(true)
  const [meta, setMeta] = useState(null)
  const [questions, setQuestions] = useState([])
  const [answersByQ, setAnswersByQ] = useState({})
  const [result, setResult] = useState(null)

  // Borde vertical utilitario (aplícalo a cada header/celda que NO sea la primera)
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

        try {
          const built = norm.map(q => {
            const r = map[q.id] || {}
            if (q.type === "open")   return { questionId: q.id, text: (r.text ?? null), value: null, values: null }
            if (q.type === "single") return { questionId: q.id, text: null, value: r.value != null ? String(r.value) : null, values: null }
            const arr = Array.isArray(r.values) ? r.values.map(String) : []
            return { questionId: q.id, text: null, value: null, values: arr.length ? arr : null }
          })
          const nowIso = new Date().toISOString()
          const res = await TestsApi.submitRun({
            testId: effectiveTestId,
            patientId: m?.patientId ?? null,
            startedAtUtc: m?.startedAtUtc ?? nowIso,
            finishedAtUtc: m?.updatedAtUtc ?? nowIso,
            answers: built,
          })
          if (!alive) return
          setResult(res || null)
        } catch (e) {
          console.log("No se pudieron recalcular resultados para lectura:", e)
          setResult(null)
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
                <Table.ColumnHeader {...colBorder} minW="100px">Raw</Table.ColumnHeader>
                <Table.ColumnHeader {...colBorder} minW="120px">Min / Max</Table.ColumnHeader>
                <Table.ColumnHeader {...colBorder} minW="100px">% (0–100)</Table.ColumnHeader>
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
                    <Table.Cell {...colBorder}>{Number(s.raw).toFixed(2)}</Table.Cell>
                    <Table.Cell {...colBorder}>{Number(s.min).toFixed(2)} / {Number(s.max).toFixed(2)}</Table.Cell>
                    <Table.Cell {...colBorder}>{(s.max > s.min && s.percent != null) ? `${Number(s.percent).toFixed(2)}%` : "—"}</Table.Cell>
                  </Table.Row>
                ))
              )}
            </Table.Body>
          </Table.Root>
        </Box>
      </Box>
    )
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
                  <Table.ColumnHeader {...colBorder} minW="520px">Opciones (elige una)</Table.ColumnHeader>
                  <Table.ColumnHeader {...colBorder} textAlign="center" minW="70px"></Table.ColumnHeader>
                  <Table.ColumnHeader {...colBorder} textAlign="center" minW="70px"></Table.ColumnHeader>
                  <Table.ColumnHeader {...colBorder} textAlign="center" minW="70px"></Table.ColumnHeader>
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
                      <Table.Cell {...colBorder}>
                        <VStack align="start" gap="1">
                          {opts.map((opt, idx) => (
                            <Text key={`${q.id}-line-${idx}`} fontSize="sm">{opt.label}</Text>
                          ))}
                        </VStack>
                      </Table.Cell>
                      {opts.map((opt, idx) => {
                        const selected = val != null && String(opt.value) === val
                        return (
                          <Table.Cell {...colBorder} key={`${q.id}-mark-${idx}`} textAlign="center">
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
                  <Table.ColumnHeader {...colBorder} minW="360px">Pregunta</Table.ColumnHeader>
                  {optionColumns.map((lbl, i) => (
                    <Table.ColumnHeader {...colBorder} key={`col-${lbl}`} textAlign="center" minW="90px">
                      {lbl}
                    </Table.ColumnHeader>
                  ))}
                  {hasOpen && <Table.ColumnHeader {...colBorder} minW="240px">Respuesta (texto)</Table.ColumnHeader>}
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {questions.map(q => {
                  const a = answersByQ[q.id] || {}
                  const openText = q.type === "open" ? (a.text ?? toDisplayAnswer(a)) : ""
                  return (
                    <Table.Row key={q.id}>
                      <Table.Cell>{q.code}</Table.Cell>
                      <Table.Cell {...colBorder}>{q.text}</Table.Cell>
                      {optionColumns.map(lbl => (
                        <Table.Cell {...colBorder} key={`cell-${q.id}-${lbl}`} textAlign="center">
                          {(q.type === "single" || q.type === "multi") && isSelected(q, lbl) ? "✓" : ""}
                        </Table.Cell>
                      ))}
                      {hasOpen && <Table.Cell {...colBorder}>{openText}</Table.Cell>}
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
    </VStack>
  )
}
