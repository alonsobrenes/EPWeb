// src/app/review/ClinicianReviewPage.jsx
import { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams, useLocation } from "react-router-dom"
import {
  Box, Card, HStack, VStack, Text, Heading, Button, Badge,
  Separator, Textarea, Spinner,
} from "@chakra-ui/react"
import ClinicianApi from "../../api/clinicianApi"
import { toaster } from "../../components/ui/toaster"
import { LuCheck, LuSave } from "react-icons/lu"

// ===== Picker simple (Chakra v3) — paleta visible =====
function ScorePicker({ value, onChange }) {
  const valueStr = value == null ? "" : String(value)

  const CHOICES = [
    { val: "0", label: "0", activeBg: "blue.500" },
    { val: "1", label: "1", activeBg: "blue.500" },
    { val: "2", label: "2", activeBg: "blue.500" },
    { val: "X", label: "X", activeBg: "red.500"  },
  ]

  return (
    <HStack gap="2">
      {CHOICES.map(({ val, label, activeBg }) => {
        const active = valueStr === val
        return (
          <Button
            key={`score-${val}`}
            size="xs"
            borderWidth="1px"
            borderRadius="md"
            aria-pressed={active}
            bg={active ? activeBg : "white"}
            color={active ? "white" : "gray.700"}
            borderColor={active ? activeBg : "gray.300"}
            _hover={{ bg: active ? activeBg : "gray.50" }}
            _active={{ bg: active ? activeBg : "gray.100" }}
            onClick={() => onChange(val)}
          >
            {label}
          </Button>
        )
      })}
    </HStack>
  )
}

// ===== util: normaliza un item de respuesta a string visible =====
function toDisplayAnswer(a) {
  if (!a || typeof a !== "object") return ""
  const text = (a.answerText ?? a.text ?? null)
  if (text != null && String(text).trim() !== "") return String(text).trim()

  const valuesRaw =
    a.values ??
    (typeof a.answerValuesJson === "string"
      ? (() => { try { return JSON.parse(a.answerValuesJson) } catch { return null } })()
      : null)

  if (Array.isArray(valuesRaw) && valuesRaw.length) {
    return valuesRaw.map(x => String(x)).join(", ")
  }
  const single = a.answerValue ?? a.value ?? null
  if (single != null) return String(single)
  return ""
}

export default function ClinicianReviewPage() {
  const params = useParams()
  const location = useLocation()
  const navigate = useNavigate()

  const [meta, setMeta] = useState(null)
  const [testName, setTestName] = useState(location.state?.testName || null)

  const testIdFromQS =
    new URLSearchParams(location.search).get("testId") ||
    location.state?.testId ||
    null

  const attemptId =
    params.attemptId ||
    location.state?.reviewAttemptId ||
    null

  // Cargar meta del attempt (para blindar testId real)
  useEffect(() => {
    if (!attemptId) return
    let alive = true
    ClinicianApi.getAttemptMeta(attemptId)
      .then(m => { if (alive) setMeta(m) })
      .catch(() => {})
    return () => { alive = false }
  }, [attemptId])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [scales, setScales] = useState([])

  // shape: { [scaleId]: { value: "0"|"1"|"2"|"X"|null, notes: string } }
  const [valsByScaleId, setValsByScaleId] = useState({})

  // Respuestas por pregunta: { [questionId]: string }
  const [answersByQ, setAnswersByQ] = useState({})

  const [sum, setSum] = useState({
    areasConflicto: "", interrelacion: "", estructura: "",
    estructuraImpulsos: "", estructuraAjuste: "", estructuraMadurez: "",
    estructuraRealidad: "", estructuraExpresion: "",
  })

  const setScaleValue = (scaleId, patch) => {
    setValsByScaleId(prev => {
      const curr = prev[scaleId] || { value: null, notes: "" }
      const merged = { ...curr, ...patch }
      if (merged.value != null) merged.value = String(merged.value)
      return { ...prev, [scaleId]: merged }
    })
  }

  // ¿Este test usa plantilla clínica (SACKS) o no?
  const isSacks = (testName || "").toUpperCase().includes("SACKS")

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        setLoading(true)
        const effectiveTestId = meta?.testId || testIdFromQS
        if (!effectiveTestId) throw new Error("No se pudo determinar el test")

        const [scalesWrap, revWrap, ansWrap] = await Promise.all([
          ClinicianApi.getScalesWithItems(effectiveTestId),
          ClinicianApi.getReview(attemptId),
          ClinicianApi.getAttemptAnswers(attemptId),
        ])
        if (!mounted) return

        // 0) Nombre del test (si el backend lo retorna en scalesWrap)
        if (!testName && (scalesWrap?.testName || scalesWrap?.name)) {
          setTestName(scalesWrap.testName || scalesWrap.name)
        }

        // 1) Escalas
        const sc = scalesWrap?.scales || []
        setScales(sc)

        // 2) Revisión (puntajes / notas) — sólo tiene sentido para SACKS
        const nextVals = {}
        const rev = revWrap?.review
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

        // 3) Respuestas del paciente — fuente primaria: endpoint
        let rawAnswers = []
        if (Array.isArray(ansWrap)) rawAnswers = ansWrap
        else if (Array.isArray(ansWrap?.items)) rawAnswers = ansWrap.items
        else if (Array.isArray(ansWrap?.answers)) rawAnswers = ansWrap.answers

        // fallback: las que vengan del state (runner)
        if (!rawAnswers.length && Array.isArray(location.state?.answers)) {
          rawAnswers = location.state.answers
        }

        const m = {}
        for (const a of rawAnswers) {
          const qid = a.questionId ?? a.question_id ?? a.id
          const disp = toDisplayAnswer(a)
          if (qid && disp) m[qid] = disp
        }
        setAnswersByQ(m)
      } catch (e) {
        toaster.error({ title: "No se pudo cargar la hoja", description: e?.message || "Error" })
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    // recarga cuando cambia el attempt o cuando logramos conocer el testId real desde meta
  }, [attemptId, testIdFromQS, meta]) 

  const totalEscalas = scales.length
  const completas = useMemo(() => {
    let n = 0
    for (const s of scales) {
      const vv = valsByScaleId[s.id]?.value ?? null
      const v = vv == null ? null : String(vv)
      if (v === "0" || v === "1" || v === "2" || v === "X") n++
    }
    return n
  }, [scales, valsByScaleId])

  async function saveSacks(isFinal) {
    try {
      setSaving(true)
      const payload = {
        isFinal,
        scales: scales.map(s => {
          const v = valsByScaleId[s.id] || {}
          return {
            scaleId: s.id,
            value: v.value ?? "X",
            notes: v.notes || null,
          }
        }),
        summary: { ...sum },
      }
      await ClinicianApi.upsertReview(attemptId, payload)
      toaster.success({ title: isFinal ? "Revisión finalizada" : "Borrador guardado" })
      if (isFinal) {
        navigate("/app/clinic/evaluaciones", { replace: true })
      }
    } catch (e) {
      toaster.error({ title: "No se pudo guardar", description: e?.message || "Error" })
    } finally {
      setSaving(false)
    }
  }

  async function finalizeSimple() {
    try {
      setSaving(true)
      await ClinicianApi.finalizeAttempt(attemptId)
      toaster.success({ title: "Intento finalizado" })
      navigate("/app/clinic/evaluaciones", { replace: true })
    } catch (e) {
      toaster.error({ title: "No se pudo finalizar", description: e?.message || "Error" })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <HStack color="fg.muted" p="4"><Spinner /><Text>Cargando hoja de calificación…</Text></HStack>
    )
  }

  return (
    <VStack align="stretch" gap="4">
      <Card.Root p="3" position="sticky" top="0" zIndex="docked" bg="white" borderBottomWidth="1px">
        <HStack justify="space-between" wrap="wrap" gap="3">
          <HStack gap="3">
            <Heading size="sm">
              Hoja de Calificación{testName ? ` — ${testName}` : ""}
            </Heading>
            {isSacks && (
              <Badge variant="subtle">{completas}/{totalEscalas} categorías calificadas</Badge>
            )}
          </HStack>
          <HStack gap="2">
            {isSacks ? (
              <>
                <Button onClick={() => saveSacks(false)} isLoading={saving} leftIcon={<LuSave />}>
                  Guardar borrador
                </Button>
                <Button colorPalette="brand" onClick={() => saveSacks(true)} isLoading={saving} leftIcon={<LuCheck />}>
                  Finalizar
                </Button>
              </>
            ) : (
              <Button colorPalette="brand" onClick={finalizeSimple} isLoading={saving} leftIcon={<LuCheck />}>
                Finalizar
              </Button>
            )}
          </HStack>
        </HStack>
      </Card.Root>

      <Card.Root p="4">
        <VStack align="stretch" gap="4">
          {scales.map((s) => {
            const v = valsByScaleId[s.id] || {}
            return (
              <Box key={s.id} borderWidth="1px" rounded="md" p="3">
                <HStack justify="space-between" align="start" wrap="wrap" gap="3">
                  <VStack align="start" gap="0.5">
                    <Text fontWeight="semibold">{s.name}</Text>
                    <Text color="fg.muted" fontSize="sm">{s.code}</Text>
                  </VStack>
                  {isSacks && (
                    <ScorePicker
                      value={(valsByScaleId[s.id]?.value) ?? null}
                      onChange={(val) => setScaleValue(s.id, { value: val })}
                    />
                  )}
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

                {isSacks && (
                  <Box mt="3">
                    <Textarea
                      value={v.notes || ""}
                      onChange={(e) => setScaleValue(s.id, { notes: e.target.value })}
                      placeholder="Notas interpretativas para esta categoría…"
                      rows={2}
                    />
                  </Box>
                )}
              </Box>
            )
          })}
        </VStack>
      </Card.Root>

      {isSacks && (
        <Card.Root p="4">
          <Heading size="sm" mb="3">Sumario interpretativo</Heading>
          <VStack align="stretch" gap="3">
            <Textarea rows={2} placeholder="Áreas de conflicto"
              value={sum.areasConflicto} onChange={(e) => setSum(s => ({ ...s, areasConflicto: e.target.value }))} />
            <Textarea rows={2} placeholder="Interrelación"
              value={sum.interrelacion} onChange={(e) => setSum(s => ({ ...s, interrelacion: e.target.value }))} />
            <Textarea rows={2} placeholder="Estructura (comentario general)"
              value={sum.estructura} onChange={(e) => setSum(s => ({ ...s, estructura: e.target.value }))} />
            <Separator />
            <Heading size="xs">Estructura — dominios</Heading>
            <Textarea rows={2} placeholder="A) Impulsos"
              value={sum.estructuraImpulsos} onChange={(e) => setSum(s => ({ ...s, estructuraImpulsos: e.target.value }))} />
            <Textarea rows={2} placeholder="B) Ajuste"
              value={sum.estructuraAjuste} onChange={(e) => setSum(s => ({ ...s, estructuraAjuste: e.target.value }))} />
            <Textarea rows={2} placeholder="C) Madurez"
              value={sum.estructuraMadurez} onChange={(e) => setSum(s => ({ ...s, estructuraMadurez: e.target.value }))} />
            <Textarea rows={2} placeholder="D) Realidad"
              value={sum.estructuraRealidad} onChange={(e) => setSum(s => ({ ...s, estructuraRealidad: e.target.value }))} />
            <Textarea rows={2} placeholder="E) Expresión"
              value={sum.estructuraExpresion} onChange={(e) => setSum(s => ({ ...s, estructuraExpresion: e.target.value }))} />
          </VStack>
        </Card.Root>
      )}
    </VStack>
  )
}
