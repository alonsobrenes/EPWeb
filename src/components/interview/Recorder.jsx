// src/components/interview/Recorder.jsx
import React, { useEffect, useRef, useState, useMemo } from "react"
import { HStack, Button, Text } from "@chakra-ui/react"
import { LuMic, LuPause, LuSquare } from "react-icons/lu"

/** Detecta el mejor mimeType soportado por el navegador */
function pickMimeType() {
  if (typeof MediaRecorder === "undefined") return ""
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/ogg",
    "audio/mp4;codecs=mp4a.40.2", // Safari moderno
    "audio/mp4",
  ]
  for (const t of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(t)) return t
    } catch { /* ignore */ }
  }
  return "" // dejar que el browser elija
}

/**
 * Props:
 * - onStop(file: File) -> void
 * - mimeType?: string (opcional, para forzar uno)
 */
export default function Recorder({ onStop, mimeType }) {
  const recRef = useRef(null)
  const chunksRef = useRef([])
  const [state, setState] = useState("idle") // idle|recording|paused
  const [elapsed, setElapsed] = useState(0)
  const timerRef = useRef(null)

  const detectedMime = useMemo(() => mimeType || pickMimeType(), [mimeType])

  useEffect(() => () => clearInterval(timerRef.current), [])

  async function start() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const opts = detectedMime ? { mimeType: detectedMime } : undefined
    const rec = new MediaRecorder(stream, opts)
    chunksRef.current = []
    rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    rec.onstop = () => {
      // Determina type y extensión coherentes
      const type =
        detectedMime ||
        chunksRef.current[0]?.type ||
        "audio/webm"
      const ext = type.includes("webm") ? "webm"
        : type.includes("ogg") ? "ogg"
        : (type.includes("mp4") || type.includes("m4a") || type.includes("aac")) ? "m4a"
        : "wav"

      const blob = new Blob(chunksRef.current, { type })
      const file = new File([blob], `audio_${Date.now()}.${ext}`, { type })
      onStop?.(file)
      stream.getTracks().forEach(t => t.stop())
    }
    recRef.current = rec
    rec.start()
    setState("recording")
    const startedAt = Date.now()
    timerRef.current = setInterval(() => setElapsed(Date.now() - startedAt), 200)
  }

  function pause() {
    recRef.current?.pause()
    setState("paused")
    clearInterval(timerRef.current)
  }

  function resume() {
    recRef.current?.resume()
    setState("recording")
    const startedAt = Date.now() - elapsed
    timerRef.current = setInterval(() => setElapsed(Date.now() - startedAt), 200)
  }

  function stop() {
    recRef.current?.stop()
    setState("idle")
    clearInterval(timerRef.current)
  }

  const seconds = Math.floor(elapsed / 1000)
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0")
  const ss = String(seconds % 60).padStart(2, "0")

  return (
    <HStack gap="12px">
      {state === "idle" && <Button onClick={start} leftIcon={<LuMic />}>Grabar</Button>}
      {state === "recording" && (
        <>
          <Button onClick={pause} leftIcon={<LuPause />}>Pausar</Button>
          <Button onClick={stop} leftIcon={<LuSquare />} colorPalette="red">Detener</Button>
        </>
      )}
      {state === "paused" && (
        <>
          <Button onClick={resume} leftIcon={<LuMic />}>Reanudar</Button>
          <Button onClick={stop} leftIcon={<LuSquare />} colorPalette="red">Detener</Button>
        </>
      )}
      <Text w="60px" textAlign="center">{mm}:{ss}</Text>
    </HStack>
  )
}
