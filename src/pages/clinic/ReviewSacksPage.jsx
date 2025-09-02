// src/pages/clinic/ReviewSacksPage.jsx
import { useEffect, useMemo, useState, useCallback, memo } from "react"
import { useNavigate, useParams, useLocation } from "react-router-dom"
import {
  Box, Card, HStack, VStack, Text, Heading, Button, Badge,
  Separator, Textarea, Spinner,
} from "@chakra-ui/react"
import ClinicianApi from "../../api/clinicianApi"
import { toaster } from "../../components/ui/toaster"
import { LuCheck, LuSave } from "react-icons/lu"

// == Picker de puntaje (memo) ==
const ScorePicker = memo(function ScorePicker({ value, onChange }) {
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
})

// Constante estable para valores por defecto (evita crear {} por render)
const EMPTY_VAL = Object.freeze({ value: null, notes: "" })

// == Lista de ítems (memo) ==
const ScaleItems = memo(function ScaleItems({ items, answersByQ }) {
  if (!Array.isArray(items) || items.length === 0) return null
  return (
    <VStack align="stretch" gap="2">
      {items.map((it) => {
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
  )
})

// == Tarjeta por escala (memo) ==
const ScaleCard = memo(function ScaleCard({ s, v, onChange, answersByQ }) {
  return (
    <Box borderWidth="1px" rounded="md" p="3">
      <HStack justify="space-between" align="start" wrap="wrap" gap="3">
        <VStack align="start" gap="0.5">
          <Text fontWeight="semibold">{s.name}</Text>
          <Text color="fg.muted" fontSize="sm">{s.code}</Text>
        </VStack>
        <ScorePicker
          value={v?.value ?? null}
          onChange={(val) => onChange(s.id, { value: val })}
        />
      </HStack>

      {Array.isArray(s.items) && s.items.length > 0 ? (
        <>
          <Separator my="3" />
          <ScaleItems items={s.items} answersByQ={answersByQ} />
        </>
      ) : null}

      <Box mt="3">
        <Textarea
          value={v?.notes || ""}
          onChange={(e) => onChange(s.id, { notes: e.target.value })}
          placeholder="Notas interpretativas para esta categoría…"
          rows={2}
        />
      </Box>
    </Box>
  )
})

function toDisplayAnswer(a) {
  if (!a || typeof a !== "object") return ""
  const text = (a.answerText ?? a.text ?? null)
  if (text != null && String(text).trim() !== "") return String(text).trim()
  const valuesRaw =
    a.values ??
    (typeof a.answerValuesJson === "string"
      ? (() => { try { return JSON.parse(a.answerValuesJson) } catch { return null } })()
      : null)
  if (Array.isArray(valuesRaw) && valuesRaw.length) return valuesRaw.map(x => String(x)).join(", ")
  const single = a.answerValue ?? a.value ?? null
  if (single != null) return String(single)
  return ""
}

export default function ReviewSacksPage() {
  const { attemptId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [scales, setScales] = useState([])
  const [valsByScaleId, setValsByScaleId] = useState({})
  const [answersByQ, setAnswersByQ] = useState({})
  const [aiText, setAiText] = useState("")
  const [loadingAi, setLoadingAi] = useState(false)
  const [testName, setTestName] = useState(location.state?.testName || null)
  const testIdFromQS = new URLSearchParams(location.search).get("testId") || location.state?.testId || null

  const [sum, setSum] = useState({
    areasConflicto: "", interrelacion: "", estructura: "",
    estructuraImpulsos: "", estructuraAjuste: "", estructuraMadurez: "",
    estructuraRealidad: "", estructuraExpresion: "",
  })

  // Handler estable
  const setScaleValue = useCallback((scaleId, patch) => {
    setValsByScaleId(prev => {
      const curr = prev[scaleId] || { value: null, notes: "" }
      const merged = { ...curr, ...patch }
      if (merged.value != null) merged.value = String(merged.value)
      return { ...prev, [scaleId]: merged }
    })
  }, [])

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        setLoading(true)
        const attemptMeta = await ClinicianApi.getAttemptMeta(attemptId)
        const effectiveTestId = attemptMeta?.testId || testIdFromQS
        if (!effectiveTestId) throw new Error("No se pudo determinar el test")

        const [scalesWrap, revWrap, ansWrap] = await Promise.all([
          ClinicianApi.getScalesWithItems(effectiveTestId),
          ClinicianApi.getReview(attemptId),
          ClinicianApi.getAttemptAnswers(attemptId),
        ])
        if (!mounted) return

        if (!testName && (scalesWrap?.testName || scalesWrap?.name)) {
          setTestName(scalesWrap.testName || scalesWrap.name)
        }

        const sc = scalesWrap?.scales || []
        setScales(sc)

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

        let rawAnswers = []
        if (Array.isArray(ansWrap)) rawAnswers = ansWrap
        else if (Array.isArray(ansWrap?.items)) rawAnswers = ansWrap.items
        else if (Array.isArray(ansWrap?.answers)) rawAnswers = ansWrap.answers
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

        // Cargar opinión IA (no bloquea)
        try {
          setLoadingAi(true)
          const ai = await ClinicianApi.getAttemptAiOpinion(attemptId)
          const text = ai?.opinionText || ai?.text || ""
          setAiText(text)
        } catch {}
        finally { setLoadingAi(false) }
      } catch (e) {
        toaster.error({ title: "No se pudo cargar la hoja", description: e?.message || "Error" })
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [attemptId, testIdFromQS, testName])

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

  async function generateAiOpinion() {
    try {
      setLoadingAi(true)
      const gen = await ClinicianApi.generateAttemptAiOpinion(attemptId, { model: 'gpt-4o-mini', promptVersion: 'v1.0-sacks' })
      const text = gen?.opinionText || gen?.text || ''
      setAiText(text)
      toaster.success({ title: 'Opinión IA generada y guardada' })
    } catch (e) {
      console.log('No se pudo generar opinión IA:', e)
      toaster.error({ title: 'No se pudo generar opinión IA' })
    } finally {
      setLoadingAi(false)
    }
  }

  async function save(isFinal) {
    try {
      setSaving(true)
      const payload = {
        isFinal,
        scales: scales.map(s => {
          const v = valsByScaleId[s.id] || {}
          return { scaleId: s.id, value: v.value ?? "X", notes: v.notes || null }
        }),
        summary: { ...sum },
      }
      await ClinicianApi.upsertReview(attemptId, payload)
      toaster.success({ title: isFinal ? "Revisión finalizada" : "Borrador guardado" })
      if (isFinal) navigate("/app/clinic/evaluaciones", { replace: true })
    } catch (e) {
      toaster.error({ title: "No se pudo guardar", description: e?.message || "Error" })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <HStack color="fg.muted" p="4"><Spinner /><Text>Cargando hoja…</Text></HStack>
  }

  return (
    <VStack align="stretch" gap="4">
      <Card.Root p="3" position="sticky" top="0" zIndex="docked" bg="white" borderBottomWidth="1px">
        <HStack justify="space-between" wrap="wrap" gap="3">
          <HStack gap="3">
            <Heading size="sm">Hoja de Calificación{testName ? ` — ${testName}` : ""}</Heading>
            <Badge variant="subtle">{completas}/{totalEscalas} categorías calificadas</Badge>
          </HStack>
          <HStack gap="2">
            <Button onClick={() => save(false)} isLoading={saving} leftIcon={<LuSave />}>Guardar borrador</Button>
            <Button colorPalette="brand" onClick={() => save(true)} isLoading={saving} leftIcon={<LuCheck />}>Finalizar</Button>
          </HStack>
        </HStack>
      </Card.Root>

      <Card.Root p="4">
        <VStack align="stretch" gap="4">
          {scales.map((s) => (
            <ScaleCard
              key={s.id}
              s={s}
              v={valsByScaleId[s.id] || EMPTY_VAL}
              onChange={setScaleValue}
              answersByQ={answersByQ}
            />
          ))}
        </VStack>
      </Card.Root>

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

      <Card.Root p="4">
        <Heading size="sm" mb="3">Opinión del asistente de IA</Heading>
        <Box position="relative">
          {loadingAi && (
            <HStack position="absolute" inset="0" bg="whiteAlpha.700" justify="center" align="center" zIndex="1">
              <Spinner /><Text fontSize="sm" ml="2">Generando opinión…</Text>
            </HStack>
          )}
          <Textarea
            placeholder="Síntesis generada por IA (solo lectura)"
            value={aiText}
            readOnly
            rows={6}
            style={{
              minHeight: '220px',
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
          />
          <HStack justify="flex-end" mt="12px">
            <Button onClick={generateAiOpinion} isLoading={loadingAi}>Obtener opinión IA</Button>
          </HStack>
        </Box>
      </Card.Root>

    </VStack>
  )
}
