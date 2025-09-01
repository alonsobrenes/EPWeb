// src/pages/clinic/ReviewSacksReadOnly.jsx
import { useEffect, useMemo, useState } from "react"
import { useLocation, useNavigate, useParams } from "react-router-dom"
import {
  Box, Card, HStack, VStack, Heading, Text, Button,
  Separator, Spinner, Badge,
} from "@chakra-ui/react"
import ClinicianApi from "../../api/clinicianApi"
import { toaster } from "../../components/ui/toaster"

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

export default function ReviewSacksReadOnly() {
  const { attemptId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()

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
  const [sum, setSum] = useState({
    areasConflicto: "", interrelacion: "", estructura: "",
    estructuraImpulsos: "", estructuraAjuste: "", estructuraMadurez: "",
    estructuraRealidad: "", estructuraExpresion: "",
  })

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

                {/* === NUEVO: Notas interpretativas por categoría === */}
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

      {/* === NUEVO: Sumario interpretativo final === */}
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
    </VStack>
  )
}
