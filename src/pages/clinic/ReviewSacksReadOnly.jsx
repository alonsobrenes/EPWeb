// src/pages/clinic/ReviewSacksReadOnly.jsx
import { useEffect, useMemo, useState } from "react"
import { useLocation, useNavigate, useParams } from "react-router-dom"
import {
  Box, Card, HStack, VStack, Heading, Text, Button,
  Separator, Spinner, Badge, Wrap, WrapItem, Table
} from "@chakra-ui/react"
import ClinicianApi from "../../api/clinicianApi"
import { ProfileApi } from "../../api/profileApi"
import { toaster } from "../../components/ui/toaster"
import TestProfileChart from "../../components/tests/TestProfileChart"

function toDisplayAnswer(a) {
  if (!a || typeof a !== "object") return ""
  const text = a.answerText ?? a.text
  if (text && String(text).trim()) return String(text).trim()
  if (Array.isArray(a.values) && a.values.length) return a.values.map(String).join(", ")
  if (typeof a.answerValuesJson === "string") {
    try { const arr = JSON.parse(a.answerValuesJson); if (Array.isArray(arr)) return arr.join(", ") } catch {}
  }
  const v = a.answerValue ?? a.value
  return v == null ? "" : String(v)
}

function ScoreRead({ value }) {
  const v = value == null ? null : String(value)
  const items = ["0", "1", "2", "X"]
  return (
    <HStack gap="1">
      {items.map(k => (
        <Badge
          key={k}
          variant={v === k ? "solid" : "outline"}
          colorPalette={k === "X" ? "red" : "blue"}
        >
          {k}
        </Badge>
      ))}
    </HStack>
  )
}


// ================== Sección de etiquetas para este intento (read-only page) ==================
// BEGIN CHANGE: Etiquetas (componente local para asignar labels)
function TestAttemptLabelsSection({ patientId, attemptId }) {
  const [allLabels, setAllLabels] = useState([])
  const [assigned, setAssigned] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = async () => {
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

      const assignedResp = await ProfileApi.getLabelsFor({ type: 'test_attempt', id: attemptId })
      const mine = Array.isArray(assignedResp?.items) ? assignedResp.items : []
      setAssigned(new Set(mine.map(x => x.id)))
    } catch (e) {
      toaster.error({ title: 'No se pudieron cargar las etiquetas', description: e?.message || 'Error' })
      setAllLabels([])
      setAssigned(new Set())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [patientId, attemptId])

  const toggleLabel = async (lbl) => {
    if (!patientId) return
    const isOn = assigned.has(lbl.id)
    try {
      setSaving(true)
      if (isOn) {
        await ProfileApi.unassignLabel({ labelId: lbl.id, targetType: 'test_attempt', targetId: attemptId })
        const next = new Set(assigned); next.delete(lbl.id); setAssigned(next)
      } else {
        await ProfileApi.assignLabel({ labelId: lbl.id, targetType: 'test_attempt', targetId: attemptId })
        const next = new Set(assigned); next.add(lbl.id); setAssigned(next)
      }
    } catch (e) {
      toaster.error({ title: isOn ? 'No se pudo quitar etiqueta' : 'No se pudo asignar etiqueta', description: e?.message || 'Error' })
    } finally {
      setSaving(false)
    }
  }

  if (!loading && allLabels.length === 0) return null

  return (
    <Box mb="2">
      <HStack justify="space-between" mb="2">
        <Text fontWeight="medium">Etiquetas de esta evaluación</Text>
        {patientId && loading && (
          <HStack><Spinner size="sm" /><Text>Cargando…</Text></HStack>
        )}
      </HStack>

      {allLabels.length > 0 && (
        <Wrap spacing="2">
          {allLabels.map(lbl => {
            const active = assigned.has(lbl.id)
            return (
              <WrapItem key={lbl.id}>
                <Button
                  size="xs"
                  variant={active ? 'solid' : 'outline'}
                  onClick={() => toggleLabel(lbl)}
                  isDisabled={saving || lbl.isSystem === true}
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
    </Box>
  )
}
// END CHANGE: Etiquetas
export default function ReviewSacksReadOnly() {
  function ResultsBlock() {
  const totalRaw = result?.totalRaw ?? null
  const totalPercent = result?.totalPercent ?? null
  const scalesArr = result?.scales || []
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
              <Table.ColumnHeader>Escala</Table.ColumnHeader>
              <Table.ColumnHeader>Raw</Table.ColumnHeader>
              <Table.ColumnHeader>Min / Max</Table.ColumnHeader>
              <Table.ColumnHeader>%</Table.ColumnHeader>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {scalesArr.length === 0 ? (
              <Table.Row>
                <Table.Cell colSpan={4}>
                  <Box py="4" textAlign="center" color="fg.muted">Sin escalas calculadas.</Box>
                </Table.Cell>
              </Table.Row>
            ) : (
              scalesArr.map(s => (
                <Table.Row key={s.scaleId || s.scaleCode}>
                  <Table.Cell><Text><b>{s.scaleCode || s.code}</b> — {s.scaleName || s.name}</Text></Table.Cell>
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
  const { attemptId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  // Obtener patientId desde backTo (si existe) o desde la URL actual
  // BEGIN CHANGE: Derivar patientId desde backTo o QS actual
  const backToQS = new URLSearchParams(location.search).get("backTo") || null
  const queryParams = new URLSearchParams(window.location.search)
  let patientId = null
  if (backToQS) {
    try {
      const url = new URL(backToQS, window.location.origin)
      patientId = url.searchParams.get("patientId") || url.searchParams.get("openPatientId")
    } catch (err) { console.log(err) }
  } else {
    patientId = queryParams.get("patientId") || queryParams.get("openPatientId")
  // END CHANGE
  }

  const testIdFromQS =
    new URLSearchParams(location.search).get("testId") ||
    location.state?.testId ||
    null
  const testName = location.state?.testName || null

  const [loading, setLoading] = useState(true)
  const [meta, setMeta] = useState(null)
  const [scales, setScales] = useState([])
  const [answersByQ, setAnswersByQ] = useState({})
  const [valsByScaleId, setValsByScaleId] = useState({}) // { [scaleId]: { value, notes } }

  const result = useMemo(() => {
    if (!Array.isArray(scales) || scales.length === 0) return null
    const out = []
    let totalRaw = 0
    let sumPct = 0
    let cntPct = 0
    for (const s of scales) {
      const val = (valsByScaleId[s.id]?.value ?? null)
      const min = 0, max = 2
      let raw = null, percent = null
      if (val === "0" || val === "1" || val === "2") {
        raw = Number(val)
        percent = (raw - min) / (max - min) * 100
        totalRaw += raw
        sumPct += percent
        cntPct++
      }
      out.push({
        scaleId: s.id,
        scaleCode: s.code,
        scaleName: s.name,
        raw: raw ?? 0,
        min, max,
        percent
      })
    }
    const totalPercent = cntPct > 0 ? (sumPct / cntPct) : null
    return { totalRaw, totalPercent, scales: out }
  }, [scales, valsByScaleId])
  
  const chartScales = useMemo(() => {
    if (!Array.isArray(scales) || scales.length === 0) return []
    return scales.map(s => {
      const v = (valsByScaleId[s.id]?.value ?? null)
      let percent = null
      if (v === "0") percent = 0
      else if (v === "1") percent = 50
      else if (v === "2") percent = 100
      return {
        scaleId: s.id,
        scaleCode: s.code || String(s.id),
        scaleName: s.name || s.code || String(s.id),
        raw: v == null || v === "X" ? null : Number(v),
        min: 0,
        max: 2,
        percent,
      }
    })
  }, [scales, valsByScaleId])

  const [sum, setSum] = useState({
    areasConflicto: "", interrelacion: "", estructura: "",
    estructuraImpulsos: "", estructuraAjuste: "", estructuraMadurez: "",
    estructuraRealidad: "", estructuraExpresion: "",
  })

  // === NUEVO: Estado para Opinión IA (solo lectura) ===
  const [aiText, setAiText] = useState("")
  const [loadingAi, setLoadingAi] = useState(true)

  useEffect(() => {
    let alive = true
    async function load() {
      try {
        setLoading(true)

        // Meta (para confirmar testId real)
        const attemptMeta = await ClinicianApi.getAttemptMeta(attemptId)
        if (!alive) return
        setMeta(attemptMeta)

        const effectiveTestId = attemptMeta?.testId || testIdFromQS
        if (!effectiveTestId) throw new Error("No se pudo determinar el test")

        // Escalas + Review + Respuestas
        const [scalesWrap, revWrap, ansWrap] = await Promise.all([
          ClinicianApi.getScalesWithItems(effectiveTestId),
          ClinicianApi.getReview(attemptId),           // -> { review: {...} }
          ClinicianApi.getAttemptAnswers(attemptId),   // -> {items:[...]} o array
        ])
        if (!alive) return

        // 1) Escalas
        setScales(Array.isArray(scalesWrap?.scales) ? scalesWrap.scales : [])

        // 2) Revisión: puntajes + notas por categoría + sumario final
        const rev = revWrap?.review || null
        const nextVals = {}
        if (rev?.scales?.length) {
          for (const r of rev.scales) {
            nextVals[r.scaleId] = {
              value: r.isUncertain ? "X" : (r.score == null ? null : String(r.score)),
              notes: r.notes || "",
            }
          }
        }
        setValsByScaleId(nextVals)

        if (rev) {
          setSum({
            areasConflicto: rev.areasConflicto || "",
            interrelacion: rev.interrelacion || "",
            estructura: rev.estructura || "",
            estructuraImpulsos: rev.estructuraImpulsos || "",
            estructuraAjuste: rev.estructuraAjuste || "",
            estructuraMadurez: rev.estructuraMadurez || "",
            estructuraRealidad: rev.estructuraRealidad || "",
            estructuraExpresion: rev.estructuraExpresion || "",
          })
        }

        // 3) Respuestas
        let rawAnswers = []
        if (Array.isArray(ansWrap)) rawAnswers = ansWrap
        else if (Array.isArray(ansWrap?.items)) rawAnswers = ansWrap.items
        else if (Array.isArray(ansWrap?.answers)) rawAnswers = ansWrap.answers

        const m = {}
        for (const a of rawAnswers) {
          const qid = a.questionId ?? a.question_id ?? a.id
          const disp = toDisplayAnswer(a)
          if (qid && disp) m[qid] = disp
        }
        setAnswersByQ(m)

        // 4) === NUEVO: cargar Opinión IA (no bloquea la pantalla) ===
        try {
          const ai = await ClinicianApi.getAttemptAiOpinion(attemptId)
          if (!alive) return
          const text = ai?.opinionText || ai?.text || ""
          setAiText(text)
        } catch {
          // silencioso: si no hay opinión, dejamos textarea vacío
        } finally {
          if (alive) setLoadingAi(false)
        }
      } catch (e) {
        toaster.error({ title: "No se pudo cargar la vista", description: e?.message || "Error" })
      } finally {
        if (alive) setLoading(false)
      }
    }
    load()
    return () => { alive = false }
  }, [attemptId, testIdFromQS])

  const backTo = new URLSearchParams(location.search).get("backTo")
  const goBackHref =
    backTo ||
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

  return (
    <VStack align="stretch" gap="4">
      <Card.Root p="3" position="sticky" top="0" zIndex="docked" bg="white" borderBottomWidth="1px">
        <HStack justify="space-between" wrap="wrap" gap="3">
          <HStack gap="3">
            <Heading size="sm">Vista de intento — {testName || "SACKS"}</Heading>
            <Badge variant="subtle">{meta?.status}</Badge>
          </HStack>
          <Button onClick={() => navigate(goBackHref, { replace: true })}>Volver</Button>
        </HStack>
      </Card.Root>
      <Card.Root p="4">
        <TestAttemptLabelsSection patientId={patientId} attemptId={attemptId} />
      </Card.Root>
      <Card.Root p="4">
        <VStack align="stretch" gap="4">
          {scales.map((s) => {
            const scoreInfo = valsByScaleId[s.id] || null
            return (
              <Box key={s.id} borderWidth="1px" rounded="md" p="3">
                <HStack justify="space-between" align="start" wrap="wrap" gap="3">
                  <VStack align="start" gap="0.5">
                    <Text fontWeight="semibold">{s.name}</Text>
                    <Text color="fg.muted" fontSize="sm">{s.code}</Text>
                  </VStack>
                  {scoreInfo && <ScoreRead value={scoreInfo.value} />}
                </HStack>

                {s.items?.length ? (
                  <>
                    <Separator my="3" />
                    <VStack align="stretch" gap="2">
                      {s.items.map((it) => {
                        const answer = answersByQ[it.id] || ""
                        return (
                          <Box key={it.id}>
                            <Text fontSize="sm">
                              <Text as="span" fontWeight="medium">{it.code}.</Text> {it.text}
                            </Text>
                            {answer && (
                              <Text mt="1" fontSize="sm" color="fg.muted">
                                <b>Respuesta:</b> {answer}
                              </Text>
                            )}
                          </Box>
                        )
                      })}
                    </VStack>
                  </>
                ) : null}

                {/* === Notas interpretativas por categoría (solo lectura) === */}
                {scoreInfo?.notes && (
                  <Box mt="3" p="2" bg="gray.50" borderWidth="1px" borderColor="gray.200" rounded="md">
                    <Text fontSize="sm"><b>Notas interpretativas:</b> {scoreInfo.notes}</Text>
                  </Box>
                )}
              </Box>
            )
          })}
        </VStack>
      </Card.Root>

      {result && (
        <Card.Root p="4">
          <ResultsBlock />
        </Card.Root>
      )}

      {Array.isArray(chartScales) && chartScales.some(s => s.percent != null) && (
        <Card.Root p="4">
          <Heading size="sm" mb="3">Perfil del test</Heading>
          <TestProfileChart scales={chartScales} />
        </Card.Root>
      )}

      {/* === Sumario interpretativo final === */}
      {(sum.areasConflicto || sum.interrelacion || sum.estructura ||
        sum.estructuraImpulsos || sum.estructuraAjuste || sum.estructuraMadurez ||
        sum.estructuraRealidad || sum.estructuraExpresion) && (
        <Card.Root p="4">
          <Heading size="sm" mb="3">Sumario interpretativo</Heading>
          <VStack align="stretch" gap="3">
            {sum.areasConflicto && <Text><b>Áreas de conflicto:</b> {sum.areasConflicto}</Text>}
            {sum.interrelacion &&  <Text><b>Interrelación:</b> {sum.interrelacion}</Text>}
            {sum.estructura &&     <Text><b>Estructura (general):</b> {sum.estructura}</Text>}
            <Separator />
            {(sum.estructuraImpulsos || sum.estructuraAjuste || sum.estructuraMadurez ||
              sum.estructuraRealidad || sum.estructuraExpresion) && (
              <Heading size="xs">Estructura — dominios</Heading>
            )}
            {sum.estructuraImpulsos && <Text><b>A) Impulsos:</b> {sum.estructuraImpulsos}</Text>}
            {sum.estructuraAjuste &&   <Text><b>B) Ajuste:</b> {sum.estructuraAjuste}</Text>}
            {sum.estructuraMadurez &&  <Text><b>C) Madurez:</b> {sum.estructuraMadurez}</Text>}
            {sum.estructuraRealidad && <Text><b>D) Realidad:</b> {sum.estructuraRealidad}</Text>}
            {sum.estructuraExpresion &&<Text><b>E) Expresión:</b> {sum.estructuraExpresion}</Text>}
          </VStack>
        </Card.Root>
      )}

      {/* === NUEVO: Opinión del asistente de IA (solo lectura) === */}
      <Card.Root p="4">
        <Heading size="sm" mb="3">Opinión del asistente de IA</Heading>
        <Box>
          <textarea
            style={{ width: '100%', minHeight: '160px' }}
            placeholder="Síntesis generada por IA (solo lectura)"
            value={aiText}
            onChange={() => {}}
            disabled={loadingAi}
            readOnly
          />
        </Box>
      </Card.Root>
    </VStack>
  )
}