// src/pages/clinic/InterviewPage.jsx
import React, { useEffect, useRef, useState } from "react"
import {
  Box,
  Button,
  Card,
  Heading,
  HStack,
  Input,
  Textarea,
  VStack,
  Text,
  SimpleGrid,
  Badge,
  Spinner,
} from "@chakra-ui/react"
import { useLocation, useNavigate } from "react-router-dom"
import { toaster } from "../../components/ui/toaster"
import Recorder from "../../components/interview/Recorder"
import { InterviewApi } from "../../api/interviewApi"
import { PatientsApi } from "../../api/patientsApi"
import { generateInterviewPdf } from "../../utils/generateInterviewPdf"
import QuotaStrip from '../../components/billing/QuotaStrip'
import PaywallCTA from "../../components/billing/PaywallCTA"
import HashtagsApi from "../../api/hashtagsApi"
import EditableInterviewHashtags from "../../components/hashtags/EditableInterviewHashtags"
import InterviewEstimateCard from "../../components/interview/InterviewEstimateCard"
import TranscriptProgress from "../../components/interview/TranscriptProgress"
import StatusBadge from "../../components/common/StatusBadge"

/* ======================= helpers ======================= */
function getErrorMessage(error) {
  const data = error?.response?.data
  if (typeof data === "string") return data
  if (data?.message) return data.message
  return error?.message || "Error"
}

function fullName(p) {
  return (
    p.fullName ||
    [p.firstName ?? p.first_name, p.lastName1 ?? p.last_name1, p.lastName2 ?? p.last_name2]
      .filter(Boolean)
      .join(" ")
  )
}

/* ================== fila de resultado paciente ================== */
function PatientRow({ p, onSelect }) {
  const name = fullName(p) || "Sin nombre"
  const idType = p.identificationType ?? p.identification_type ?? ""
  const idNum = p.identificationNumber ?? p.identification_number ?? ""
  const idText = [idType, idNum].filter(Boolean).join(": ")

  return (
    <Box
      as="button"
      type="button"
      onClick={() => onSelect?.(p)}
      textAlign="left"
      w="100%"
      p="10px"
      borderRadius="md"
      _hover={{ bg: "blackAlpha.50" }}
    >
      <Text fontWeight="medium" noOfLines={1}>{name}</Text>
      {idText && <Text fontSize="sm" color="fg.muted" noOfLines={1}>{idText}</Text>}
    </Box>
  )
}

/* ============= buscador inline (como TestStartDialog) ============= */
function InlinePatientSearch({ onSelected }) {
  const [q, setQ] = useState("")
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState([])
  const [error, setError] = useState(null)
  const timer = useRef(null)

  // Evita que hotkeys globales “se coman” las teclas del input
  const stopKeys = (e) => {
    e.stopPropagation()
    // e.preventDefault() // si aún no escribe, descomenta
  }

  useEffect(() => {
    clearTimeout(timer.current)
    if (!q || q.trim().length < 2) {
      setResults([])
      setError(null)
      return
    }
    timer.current = setTimeout(async () => {
      setLoading(true)
      setError(null)
      try {
        const { items } = await PatientsApi.list({ page: 1, pageSize: 10, query: q.trim() })
        setResults(Array.isArray(items) ? items : [])
      } catch (e) {
        setError(getErrorMessage(e))
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 400)
    return () => clearTimeout(timer.current)
  }, [q])

  return (
    <VStack align="stretch" gap="8px">
      <Box>
        <Text fontSize="sm" mb="4px">Paciente</Text>
        <Input
          autoFocus
          autoComplete="off"
          placeholder="Selecciona un paciente… (tipea al menos 2 letras)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDownCapture={stopKeys}
          onKeyDown={stopKeys}
          onKeyUp={stopKeys}
          onKeyPress={stopKeys}
        />
      </Box>

      {loading && (
        <HStack color="fg.muted" fontSize="sm"><Spinner size="sm" /><Text>Buscando…</Text></HStack>
      )}

      {error && (
        <Box borderWidth="1px" borderColor="red.200" bg="red.50" p="8px" rounded="md">
          <Text fontSize="sm" color="red.700">No se pudo buscar pacientes: {error}</Text>
        </Box>
      )}

      {results.length > 0 && (
        <Box borderWidth="1px" rounded="md" overflow="hidden" maxH="260px" overflowY="auto">
          {results.map((p) => (
            <PatientRow key={p.id} p={p} onSelect={onSelected} />
          ))}
        </Box>
      )}
    </VStack>
  )
}

/* ===================== página principal ===================== */
export default function InterviewPage() {
  const navigate = useNavigate()
  const { search } = useLocation()
  const qs = new URLSearchParams(search)
  const backTo = qs.get("backTo")
  const DASHBOARD_PATH = "/app/clinic" // <-- ajusta si tu dashboard vive en otra ruta

  const [patient, setPatient] = useState(null)
  const [interviewId, setInterviewId] = useState(null)
  const [transcript, setTranscript] = useState("")
  const [draft, setDraft] = useState("")

  // Busy por acción (solo cosmético)
  const [busy, setBusy] = useState(false)              // transcribir / upload
  const [busyTranscript, setBusyTranscript] = useState(false)
  const [busyGenerate, setBusyGenerate] = useState(false)
  const [busySave, setBusySave] = useState(false)
  const [proDiag, setProDiag] = useState("")
  const [busyPro, setBusyPro] = useState(false)
  const [paywall, setPaywall] = useState(false)
  const [lastAudioFile, setLastAudioFile] = useState(null)
  const pollCancelRef = useRef(false)      // cancela el poll al desmontar/cambiar entrevista
  const [isPollingTranscript, setIsPollingTranscript] = useState(false) // o
  const [transcriptStatus, setTranscriptStatus] = useState(null)
  const [transcriptStartedAtUtc, setTranscriptStartedAtUtc] = useState(null)
  const fileDurationSec = null

  // Hashtags detectados para esta entrevista (editable)
  const [tags, setTags] = useState([])
  const [loadingTags, setLoadingTags] = useState(false)
  const [savingTags, setSavingTags] = useState(false)
  const [newTag, setNewTag] = useState("")

  // Normalizador simple: admite "#tag" o "tag", min 2–64, letras/numeros/_/-
  const rxTag = /#?([\p{L}\p{N}_-]{2,64})/iu
  const norm = (s) => {
    const m = rxTag.exec(String(s || "").trim())
    if (!m) return null
    return m[1].toLowerCase()
  }

  // intenta obtener la transcripción ya guardada (p. ej. vía getFirstByPatient o get(id))
  async function waitForTranscript({ interviewId, patientId, tries = 8, delayMs = 500 }) {
    for (let i = 0; i < tries; i++) {
      try {
        // Si ya tienes un GET por id con el campo transcript, úsalo.
        // Con lo que hay hoy, se puede usar el "first by patient":
        const res = await InterviewApi.getFirstByPatient(patientId) // { transcriptText, ... }
        console.log('res.transcriptText',res.transcriptText)
        const t = (res && res.transcriptText) ? String(res.transcriptText) : ""
        if (t && t.trim().length > 0) return t
      } catch {}
      await new Promise(r => setTimeout(r, delayMs))
    }
    return ""
  }

  async function pollTranscriptionStatusForever(interviewId, onTick) {
    let delay = 1000 // 1s
    while (!pollCancelRef.current) {
      try {
        const s = await InterviewApi.getTranscriptionStatus(interviewId)
        onTick?.(s)

        const status = (s?.status || "").toLowerCase()
        if (status === "done" || status === "failed") {
          return s // salimos solo en done/failed
        }
      } catch {
        // fallos de red: tratarlos como transitorios
      }

      // esperar y subir el delay con techo 30s
      await new Promise(r => setTimeout(r, delay))
      if (delay < 30000) delay = Math.min(Math.round(delay * 1.5), 30000)
    }
    return null // cancelado (unmount / cambio de entrevista)
  }



  async function loadHashtags(interviewIdToLoad) {
    if (!interviewIdToLoad) return
    setLoadingTags(true)
    try {
      const res = await HashtagsApi.getFor({ type: "interview", id: interviewIdToLoad })
      const items = Array.isArray(res?.items) ? res.items : []
      setTags(items.map(x => (x.tag || "").toString()).filter(Boolean))
    } catch {
      setTags([])
    } finally {
      setLoadingTags(false)
    }
  }

  async function persistTags(next) {
    if (!interviewId) return
    setSavingTags(true)
    try {
      const unique = Array.from(new Set(next.filter(Boolean)))
      const res = await HashtagsApi.setFor({ type: 'interview', id: interviewId, tags: unique })
      const items = Array.isArray(res?.items) ? res.items : []
      setTags(items.map(x => (x.tag || '').toString()))
      toaster.success({ title: 'Hashtags actualizados' })
    } catch (e) {
      toaster.error({ title: 'No se pudieron guardar los hashtags' })
    } finally {
      setSavingTags(false)
    }
  }

  async function addTag() {
    const t = norm(newTag)
    if (!t) return
    const next = [...tags, t]
    setNewTag("")
    await persistTags(next)
  }

  async function removeTag(t) {
    const next = tags.filter(x => x !== t)
    await persistTags(next)
  }

  // === Nuevo: si viene desde PatientDialog, preseleccionar el paciente ===
  useEffect(() => {
    const presetId = qs.get("patientId")
    console.log('preset',presetId)
    if (!presetId) return
    let alive = true
    ;(async () => {
      try {
        // Usa la API existente de pacientes para traerlo por Id
        const p = await PatientsApi.getById(presetId)
        if (!alive) return
        setPatient(p) // con esto la UI queda con el paciente ya elegido
      } catch (e) {
        // si no existe, no rompemos nada: simplemente queda el buscador vacío
        // opcional: toaster.warn({ title: 'Paciente no encontrado' })
      }
    })()
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  useEffect(() => {
    pollCancelRef.current = false
    return () => { pollCancelRef.current = true }
  }, [interviewId])

  async function ensureInterview() {
    if (!patient?.id) {
      toaster.warning({ title: "Falta el paciente" })
      throw new Error("no-patient")
    }

    try{
      if (interviewId) return interviewId
      const { id } = await InterviewApi.create({ patientId: patient.id })
      setInterviewId(id)
      toaster.success({ title: "Entrevista creada" })
      return id
    }catch (e) {
      const status = e?.response?.status
      if (status === 402) {
        toaster.error({ title: "Tu período de prueba expiró. Elige un plan para continuar." })
        setPaywall(true)
      } else {
        toaster.error({ title: "Error al crear entrevista" })
      }
    } finally {
      setBusy(false)
    }
  }

  async function onAudioStop(file) {
    try {
      setBusy(true)
      const id = await ensureInterview()
      await InterviewApi.uploadAudio(id, file)
      setLastAudioFile(file)
      toaster.success({ title: "Audio subido" })
    } catch (e) {
      const status = e?.response?.status
      if (status === 402) {
        toaster.error({ title: "Tu período de prueba expiró. Elige un plan para continuar." })
        setPaywall(true)
      } else {
        toaster.error({ title: "Error al subir audio" })
      }
    } finally {
      setBusy(false)
    }
  }

  const [cooldown, setCooldown] = useState(0)
  useEffect(() => {
    if (!cooldown) return
    const t = setTimeout(() => setCooldown((s) => Math.max(0, s - 1)), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  // Transcribir (Alt/Ctrl/Cmd para forzar).
  async function transcribe(ev) {
    try {
      setBusyTranscript(true)
      //const id = await ensureInterview()
      const force = !!(ev && (ev.altKey || ev.metaKey || ev.ctrlKey))
      const res = await InterviewApi.transcribe(interviewId, { force })

      let finalText = (res?.text ?? "").trim()
      const status = (res?.status ?? "").toLowerCase()

      if (finalText) {
        setTranscript(finalText)
        setTranscriptStatus('done')
        toaster.success({ title: res?.cached ? "Transcripción lista (caché)" : "Transcripción lista" })
        return
      }

      // Si no vino texto (202 queued/processing) → polling indefinido hasta done/failed
      if (status === "queued" || status === "processing" || !status) {
        setIsPollingTranscript(true)
        setTranscriptStatus(status || 'queued')

        const doneOrFailed = await pollTranscriptionStatusForever(interviewId, (tick) => {
          setTranscriptStatus(tick?.status || null)
          setTranscriptStartedAtUtc(tick?.startedAtUtc || null)
        })
        setIsPollingTranscript(false)

        if (doneOrFailed && (doneOrFailed.status || "").toLowerCase() === "done") {
          const t = (doneOrFailed.text ?? "").trim()
          if (t) {
            setTranscript(t)
            setTranscriptStatus('done')
            toaster.success({ title: "Transcripción lista" })
            return
          }
        }

        if (doneOrFailed && (doneOrFailed.status || "").toLowerCase() === "failed") {
          setTranscriptStatus('failed')  
          toaster.error({
            title: "Transcripción falló",
            description: doneOrFailed.errorMessage || "Ocurrió un error al transcribir.",
          })
          return
        }

        // Si llegamos aquí, el usuario cambió de entrevista o desmontó (cancelado)
        toaster.info({ title: "Transcripción en proceso", description: "Puedes seguir trabajando; te avisamos cuando esté lista." })
        return
      }

      // Estado inesperado
      toaster.info({ title: "Transcripción en proceso", description: "Aún no está disponible; continuaremos intentando." })
    } catch (e) {
      const status = e?.response?.status
      if (status === 402) {
        toaster.error({ title: "Tu período de prueba expiró. Elige un plan para continuar." });
        setPaywall(true)
      } else if (status === 429) {
        const sec = e?.response?.data?.retryAfterSec ?? 20
        setCooldown(sec)
        toaster.warning({ title: "Servicio saturado. Intenta de nuevo en un momento." })
      } else {
        console.error(e)
        toaster.error({ title: "Error al transcribir" })
      }
    } finally {
      setBusyTranscript(false)
    }
  }

  async function saveTranscript() {
    if (!interviewId) return
    setBusyTranscript(true)
    try {
      await InterviewApi.saveTranscript(interviewId, { text: transcript, language: "es" })
      toaster.success({ title: "Transcripción guardada" })
      await loadHashtags(interviewId)
    } catch (e) {
      const status = e?.response?.status
      if (status === 402) {
        toaster.error({ title: "Tu período de prueba expiró. Elige un plan para continuar." })
        setPaywall(true)
      } else {
        console.error(e)
        toaster.error({ title: "Error al guardar transcripción" })
      }
    } finally {
      setBusyTranscript(false)
    }
  }

  async function genDiagnosis() {
    if (!interviewId) {
      toaster.warning({ title: "Crea o graba primero" })
      return
    }
    setBusyGenerate(true)
    try {
      const { content } = await InterviewApi.generateDiagnosis(interviewId, { promptVersion: "v1" })
      setDraft(content || "")
      toaster.success({ title: "Borrador generado" })
    } catch (e) {
      const status = e?.response?.status
      if (status === 402) {
        toaster.error({ title: "Tu período de prueba expiró. Elige un plan para continuar." })
        setPaywall(true)
      } else {
        console.error(e)
        toaster.error({ title: "Error generando borrador" })
      }
    }
     finally {
      setBusyGenerate(false)
    }
  }

  async function saveDraft() {
    if (!interviewId) return
    setBusySave(true)
    try {
      await InterviewApi.saveDraft(interviewId, { content: draft })
      toaster.success({ title: "Borrador guardado" })
      await loadHashtags(interviewId)
      // ⬇⬇ Cerrar y regresar al dashboard (o a backTo si vino)
      const target = backTo ? decodeURIComponent(backTo) : DASHBOARD_PATH
      navigate(target, { replace: true })
    } catch (e) {
      const status = e?.response?.status
      if (status === 402) {
        toaster.error({ title: "Tu período de prueba expiró. Elige un plan para continuar." })
        setPaywall(true)
      } else {
        console.error(e)
        toaster.error({ title: "Error al guardar borrador" })
      }
    } finally {
      setBusySave(false)
    }
  }

  // Guardar borrador IA sin cerrar ni navegar
  async function saveDraftOnly() {
    if (!interviewId) return
    setBusySave(true)
    try {
      await InterviewApi.saveDraft(interviewId, { content: draft })
      toaster.success({ title: "Borrador guardado" })
      await loadHashtags(interviewId)
    } catch (e) {
      const status = e?.response?.status
      if (status === 402) {
        toaster.error({ title: "Tu período de prueba expiró. Elige un plan para continuar." })
        setPaywall(true)
      } else {
        console.error(e)
        toaster.error({ title: "Error al guardar borrador" })
      }
    } finally {
      setBusySave(false)
    }
  }

  // Guardar diagnóstico del profesional (y opcionalmente cerrar)
  async function savePro(close = false) {
    try {
      const id = await ensureInterview()
      setBusyPro(true)
      if (typeof InterviewApi.saveClinicianDiagnosis === "function") {
        await InterviewApi.saveClinicianDiagnosis(id, { text: proDiag, close })
        await loadHashtags(interviewId)
      } else {
        // En caso de que aún no exista en InterviewApi, lanzamos un error claro
        throw new Error("InterviewApi.saveClinicianDiagnosis no está definido")
      }
      toaster.success({ title: close ? "Diagnóstico guardado y entrevista cerrada" : "Diagnóstico guardado" })
      if (close) {
        const target = backTo ? decodeURIComponent(backTo)
  : `/app/clinic/pacientes?openPatientId=${patient?.id ?? ""}&tab=inter`
        navigate(target, { replace: true })
      }
    } catch (e) {
      const status = e?.response?.status
      if (status === 402) {
        toaster.error({ title: "Tu período de prueba expiró. Elige un plan para continuar." })
        setPaywall(true)
      } else {
        console.error(e)
        toaster.error({ title: "Error al guardar diagnóstico" })
      }
    } finally {
      setBusyPro(false)
    }
  }

  async function exportPdf() {
    try {
      const blob = generateInterviewPdf({
        patient,
        interview: { id: interviewId, startedAtUtc: Date.now() },
        transcript,
        draft,
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `entrevista_${interviewId || "nueva"}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      toaster.success({ title: "PDF generado" })
    } catch (e) {
      console.error(e)
      toaster.error({ title: "Error al exportar PDF" })
    }
  }

  const patientName = patient ? fullName(patient) : null
  const anyBusy = busy || busyTranscript || busyGenerate || busySave || busyPro || savingTags || isPollingTranscript

  return (
    <VStack align="stretch" gap="16px" p="16px">
      {anyBusy && (
        <Box
          position="fixed"
          inset="0"
          bg="blackAlpha.400"
          style={{ backdropFilter: 'blur(1px)', cursor: 'progress' }}
          zIndex={1000}
        />
      )}
      {paywall && <PaywallCTA />}
      <HStack justify="space-between" align="center">
        <HStack gap="10px">
          <Text fontWeight="semibold">Entrevista</Text>
        </HStack>
        {/* a la derecha puedes poner acciones: Transcribir, Forzar, etc. */}
      </HStack>
      <Heading size="lg">Primera Entrevista</Heading>
      <QuotaStrip show={['ai.credits.monthly', 'storage.gb']} showHints/>
      <Card.Root p="16px">
        {!patient ? (
          <InlinePatientSearch
            onSelected={(p) => {
              setPatient(p)
              setInterviewId(null)
              setTranscript("")
              setDraft("")
              toaster.success({ title: "Paciente seleccionado", description: fullName(p) })
            }}
          />
        ) : (
          <HStack justify="space-between" wrap="wrap" gap="12px">
            <HStack gap="12px">
              <Badge colorPalette="green">Paciente: {patientName}</Badge>
              {patient.identificationNumber && (
                <Text color="fg.muted" fontSize="sm">{patient.identificationNumber}</Text>
              )}
            </HStack>
            <HStack gap="8px">
              <Button
                variant="subtle"
                onClick={async () => {
                  try {
                    await ensureInterview()
                    toaster.success({ title: "Entrevista lista" })
                  } catch { /* noop */ }
                }}
                disabled={anyBusy}
              >
                Nueva entrevista
              </Button>
              <Button
                variant="outline"
                onClick={() => { setPatient(null); setInterviewId(null) }}
                disabled={anyBusy}
              >
                Cambiar paciente
              </Button>
            </HStack>
          </HStack>
        )}
      </Card.Root>

      <Card.Root p="16px">
        <Heading size="sm" mb="12px">Grabación</Heading>
        <HStack gap="12px" wrap="wrap">
          <Recorder onStop={onAudioStop} />
          <Input
            type="file"
            accept="audio/*"
            onChange={(e) => e.target.files?.[0] && onAudioStop(e.target.files[0])}
            disabled={anyBusy}
          />
          <Button
            onClick={transcribe}
            isLoading={busy}
            loadingText="Transcribiendo…"
            disabled={anyBusy || cooldown > 0}
            colorPalette="brand"
          >
            {cooldown > 0 ? `Transcribir (${cooldown}s)` : "Transcribir"}
          </Button>
          {/* Estimación informativa (no bloquea flujo) */}
{interviewId && (
  <Box mt="12px">
    <InterviewEstimateCard interviewId={interviewId} file={lastAudioFile} />
  </Box>
)}
 {transcriptStatus && 
     <HStack>
     <StatusBadge status={transcriptStatus} />
     <TranscriptProgress
        interviewId={interviewId}
        status={transcriptStatus}
        startedAtUtc={transcriptStartedAtUtc}
        fileDurationSec={fileDurationSec}
      />
     </HStack>
 }
        </HStack>
      </Card.Root>

      <SimpleGrid columns={{ base: 1, md: 2 }} gap="16px">
        <Card.Root p="16px">
          <Heading size="sm" mb="12px">Transcripción</Heading>
          <Textarea
            minH="240px"
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            disabled={anyBusy}
          />
          <HStack mt="12px" justify="end">
            <Button
              onClick={saveTranscript}
              isLoading={busyTranscript}
              loadingText="Guardando…"
              variant="subtle"
              disabled={anyBusy}
            >
              Guardar
            </Button>
          </HStack>
        </Card.Root>

        <Card.Root p="16px">
          <Heading size="sm" mb="12px">Diagnóstico (IA) — Borrador</Heading>
          <Textarea
            minH="240px"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={anyBusy}
          />
          <HStack mt="12px" justify="space-between">
            <Button
              onClick={genDiagnosis}
              isLoading={busyGenerate}
              loadingText="Generando…"
              disabled={anyBusy}
              colorPalette="brand"
            >
              Generar
            </Button>
            <Button
              onClick={saveDraftOnly}
              isLoading={busySave}
              loadingText="Guardando…"
              variant="subtle"
              disabled={anyBusy}
            >
              Guardar
            </Button>
          </HStack>
        </Card.Root>
      </SimpleGrid>

      <Card.Root p="16px">
        <Heading size="sm" mb="12px">Diagnóstico del profesional</Heading>
        <EditableInterviewHashtags interviewId={interviewId} disabled={anyBusy} />
        <Textarea
          minH="240px"
          value={proDiag}
          onChange={(e) => setProDiag(e.target.value)}
          disabled={anyBusy}
        />
        <HStack mt="12px" justify="end" gap="8px">
          <Button
            onClick={() => savePro(false)}
            isLoading={busyPro}
            loadingText="Guardando…"
            variant="subtle"
            disabled={anyBusy}
          >
            Guardar
          </Button>
          <Button
            onClick={() => savePro(true)}
            isLoading={busyPro}
            loadingText="Guardando…"
            colorPalette="brand"
            disabled={anyBusy}
          >
            Guardar y cerrar
          </Button>
        </HStack>
      </Card.Root>

      {/* <HStack justify="end">
        <Button onClick={exportPdf} variant="outline" disabled={anyBusy}>
          Exportar PDF
        </Button>
      </HStack> */}
    </VStack>
  )
}
