// src/app/review/ClinicianReviewReadOnly.jsx
import { useEffect, useMemo, useState } from "react"
import { useLocation, useParams, useNavigate } from "react-router-dom"
import { Box, Card, HStack, VStack, Heading, Text, Button, Separator, Spinner, Badge, Table } from "@chakra-ui/react"
import ClinicianApi from "../../api/clinicianApi"
import { TestsApi } from "../../api/testsApi"
import { toaster } from "../../components/ui/toaster"

// -------- helpers ----------
const normStr = (s) => String(s ?? "").trim()
const isYesNoLabel = (label) => {
  const t = normStr(label).toLowerCase()
  return t === "sí" || t === "si" || t === "no"
}
const isYesNoPair = (opts) => {
  if (!Array.isArray(opts) || opts.length !== 2) return false
  const labels = opts.map(o => normStr(o.label).toLowerCase())
  const hasSi = labels.includes("sí") || labels.includes("si")
  const hasNo = labels.includes("no")
  return hasSi && hasNo
}
const sameOptionsSet = (optsA, optsB) => {
  if (!Array.isArray(optsA) || !Array.isArray(optsB) || optsA.length !== optsB.length) return false
  for (let i = 0; i < optsA.length; i++) {
    const a = optsA[i], b = optsB[i]
    if (normStr(a.label) !== normStr(b.label)) return false
    // comparamos por texto; los values pueden variar (1/0 vs "1"/"0")
  }
  return true
}
function parseAnswerDisplay(a) {
  // a: AttemptAnswerRow o runner-shape
  const text = a?.answerText ?? a?.text
  if (text && normStr(text)) return normStr(text)
  if (Array.isArray(a?.values)) return a.values.map(String).join(", ")
  if (typeof a?.answerValuesJson === "string") {
    try { const arr = JSON.parse(a.answerValuesJson); if (Array.isArray(arr)) return arr.join(", ") } catch {}
  }
  const v = a?.answerValue ?? a?.value
  return v == null ? "" : String(v)
}

// -------- component ----------
export default function ClinicianReviewReadOnly() {
  const { attemptId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()

  const [meta, setMeta] = useState(null)
  const [loading, setLoading] = useState(true)
  const [scales, setScales] = useState([]) // {id, code, name, items:[{id, code, text, orderNo}]}
  const [answersByQ, setAnswersByQ] = useState({}) // qid -> AttemptAnswerRow
  const [optsByQ, setOptsByQ] = useState(new Map()) // qid -> [{label, value}...]

  const testName = location.state?.testName || null
  const isSacks = (testName || "").toUpperCase().includes("SACKS")

  useEffect(() => {
    let alive = true
    async function load() {
      if (!attemptId) return
      try {
        setLoading(true)

        // 1) meta -> testId/patient
        const m = await ClinicianApi.getAttemptMeta(attemptId)
        if (!alive) return
        setMeta(m)

        // 2) escalas + items
        const sw = await ClinicianApi.getScalesWithItems(m.testId)
        if (!alive) return
        setScales(Array.isArray(sw?.scales) ? sw.scales : [])

        // 3) respuestas del intento
        const ansWrap = await ClinicianApi.getAttemptAnswers(attemptId)
        const raw = Array.isArray(ansWrap) ? ansWrap
          : Array.isArray(ansWrap?.items) ? ansWrap.items
          : Array.isArray(ansWrap?.answers) ? ansWrap.answers : []
        const map = {}
        for (const a of raw) {
          const qid = a.questionId ?? a.question_id ?? a.id
          if (qid) map[qid] = a
        }
        if (!alive) return
        setAnswersByQ(map)

        // 4) opciones de preguntas (para armar columnas cuando son single/multi)
        const qopts = await TestsApi.getQuestionOptionsByTest(m.testId)
        const byQ = new Map()
        for (const o of (qopts || [])) {
          if (o.isActive === false) continue
          const qid = o.questionId || o.question_id
          if (!byQ.has(qid)) byQ.set(qid, [])
          byQ.get(qid).push({
            id: o.id,
            label: o.label,
            value: o.value != null ? String(o.value) : String(o.id),
            order: o.orderNo || o.order_no || 0
          })
        }
        // order
        for (const arr of byQ.values()) arr.sort((a,b)=>a.order-b.order)
        if (!alive) return
        setOptsByQ(byQ)
      } catch (e) {
        toaster.error({ title: "No se pudo cargar el intento", description: String(e?.message || e) })
      } finally {
        if (alive) setLoading(false)
      }
    }
    load()
    return () => { alive = false }
  }, [attemptId])

  // --------- RENDER AUX PARA NO-SACKS ----------
  function renderScaleTable(scale) {
    const items = Array.isArray(scale.items) ? [...scale.items].sort((a,b)=>(a.orderNo||0)-(b.orderNo||0)) : []

    // inspeccionar opciones
    const optionSets = items.map(it => optsByQ.get(it.id) || [])
    const allSingle = optionSets.every(os => os.length > 0) // single/multi con opciones
    const allYesNo = allSingle && optionSets.every(os => isYesNoPair(os))
    const consistent = allSingle && optionSets.every((os, i) => sameOptionsSet(os, optionSets[0]))

    // encabezados y painter por fila
    let headers = []
    let rowRenderer = null

    if (allYesNo) {
      headers = ["Pregunta", "Sí", "No"]
      rowRenderer = (it) => {
        const ans = answersByQ[it.id]
        const v = String(ans?.answerValue ?? ans?.value ?? "")
        const os = optsByQ.get(it.id) || []
        const valSi = (os.find(o => isYesNoLabel(o.label))?.value) // puede ser "1"
        const valNo = (os.find(o => normStr(o.label).toLowerCase()==="no")?.value)
        const mark = (want) => (v !== "" && v === String(want)) ? "✓" : ""
        return [
          <Text key="q"><b>{it.code}.</b> {it.text}</Text>,
          <Text key="si" textAlign="center">{mark(valSi ?? "1")}</Text>,
          <Text key="no" textAlign="center">{mark(valNo ?? "0")}</Text>,
        ]
      }
    } else if (consistent && optionSets[0].length >= 3 && optionSets[0].length <= 7) {
      headers = ["Pregunta", ...optionSets[0].map(o => normStr(o.label))]
      rowRenderer = (it) => {
        const ans = answersByQ[it.id]
        const v = String(ans?.answerValue ?? ans?.value ?? "")
        const os = optionSets[0]
        const cells = os.map((o, idx) => (
          <Text key={`opt-${idx}`} textAlign="center">{v && v === String(o.value) ? "✓" : ""}</Text>
        ))
        return [ <Text key="q"><b>{it.code}.</b> {it.text}</Text>, ...cells ]
      }
    } else {
      headers = ["Pregunta", "Respuesta"]
      rowRenderer = (it) => {
        const ans = answersByQ[it.id]
        const disp = parseAnswerDisplay(ans)
        return [
          <Text key="q"><b>{it.code}.</b> {it.text}</Text>,
          <Text key="a">{disp || "—"}</Text>,
        ]
      }
    }

    return (
      <Card.Root key={scale.id} p="4">
        <VStack align="stretch" gap="2">
          <Heading size="sm">{scale.name}</Heading>
          <Text color="fg.muted" fontSize="sm">{scale.code}</Text>
          <Separator my="2" />

          <Box borderWidth="1px" rounded="md" overflow="hidden">
            <Table.Root size="sm" variant="outline">
              <Table.Header>
                <Table.Row>
                  {headers.map((h, i) => (
                    <Table.ColumnHeader key={`h-${i}`}>{h}</Table.ColumnHeader>
                  ))}
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {items.length === 0 ? (
                  <Table.Row><Table.Cell colSpan={headers.length}><Box py="4" textAlign="center" color="fg.muted">Sin ítems</Box></Table.Cell></Table.Row>
                ) : items.map((it) => (
                  <Table.Row key={it.id}>
                    {rowRenderer(it).map((cell, i) => (
                      <Table.Cell key={`c-${it.id}-${i}`}>{cell}</Table.Cell>
                    ))}
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </Box>
        </VStack>
      </Card.Root>
    )
  }

  // -------- RENDER PRINCIPAL --------
  if (loading) {
    return (
      <HStack color="fg.muted" p="4"><Spinner /><Text>Cargando intento…</Text></HStack>
    )
  }

  const backTo = new URLSearchParams(location.search).get("backTo")
  const goBackHref = backTo || (meta?.patientId
    ? `/app/clinic/pacientes?openPatientId=${meta.patientId}&tab=hist`
    : "/app/clinic/evaluaciones"
  )

  return (
    <VStack align="stretch" gap="4">
      <Card.Root p="3" position="sticky" top="0" zIndex="docked" bg="white" borderBottomWidth="1px">
        <HStack justify="space-between" wrap="wrap" gap="3">
          <HStack gap="3">
            <Heading size="sm">Vista de intento — {testName || "Test"}</Heading>
            <Badge variant="subtle">{meta?.status}</Badge>
          </HStack>
          <Button onClick={() => navigate(goBackHref, { replace: true })}>Volver</Button>
        </HStack>
      </Card.Root>

      {/* SACKS: dejamos el render existente (respuestas bajo cada ítem + notas/summary si quieres). */}
      {isSacks ? (
        <Card.Root p="4">
          <VStack align="stretch" gap="4">
            {scales.map((s) => (
              <Box key={s.id} borderWidth="1px" rounded="md" p="3">
                <VStack align="start" gap="0.5">
                  <Text fontWeight="semibold">{s.name}</Text>
                  <Text color="fg.muted" fontSize="sm">{s.code}</Text>
                </VStack>
                {s.items?.length ? (
                  <>
                    <Separator my="3" />
                    <VStack align="stretch" gap="2">
                      {s.items.map((it) => {
                        const ans = answersByQ[it.id]
                        const disp = parseAnswerDisplay(ans)
                        return (
                          <Box key={it.id}>
                            <Text fontSize="sm">
                              <Text as="span" fontWeight="medium">{it.code}.</Text> {it.text}
                            </Text>
                            {disp && (
                              <Text mt="1" fontSize="sm" color="fg.muted">
                                <b>Respuesta:</b> {disp}
                              </Text>
                            )}
                          </Box>
                        )
                      })}
                    </VStack>
                  </>
                ) : null}
              </Box>
            ))}
          </VStack>
        </Card.Root>
      ) : (
        // NO-SACKS: tablas por escala (Sí/No o K opciones)
        <VStack align="stretch" gap="4">
          {scales.map((s) => renderScaleTable(s))}
        </VStack>
      )}
    </VStack>
  )
}
