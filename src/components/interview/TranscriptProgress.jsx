// src/components/interview/TranscriptProgress.jsx
import React, { useEffect, useMemo, useRef, useState } from "react"
import { Progress } from "@chakra-ui/react"
import api from "../../api/client"

/**
 * Props:
 * - interviewId: string (requerido)
 * - status: 'queued' | 'processing' | 'done' | 'failed' | null
 * - startedAtUtc: string | null  (ISO)  // viene del /transcription-status
 * - fileDurationSec?: number | null     // si ya la conocemos por el File local
 */
export default function TranscriptProgress({ interviewId, status, startedAtUtc, fileDurationSec = null }) {
  const [durationSec, setDurationSec] = useState(fileDurationSec ?? null)
  const [now, setNow] = useState(Date.now())
  const tickRef = useRef(null)

  // Carga duración del servidor si no la tenemos
  useEffect(() => {
    let alive = true
    if (durationSec != null) return
    ;(async () => {
      try {
        const { data } = await api.get(`/utils/audio-info/${interviewId}`)
        const sec = data?.durationMs ? Math.max(1, Math.round(data.durationMs / 1000)) : null
        if (alive) setDurationSec(sec)
      } catch { /* noop */ }
    })()
    return () => { alive = false }
  }, [interviewId, durationSec])

  // Ticker 1s solo en processing
  useEffect(() => {
    if (status !== "processing") return
    tickRef.current = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(tickRef.current)
  }, [status])

  const { percent, color, valueText, showValueText } = useMemo(() => {
    const fmt = (s) => {
      if (!s || s <= 0) return "0 s"
      const m = Math.floor(s / 60)
      const sec = Math.round(s % 60)
      return m > 0 ? `${m}m ${sec}s` : `${sec}s`
    }

    if (status === "failed") {
      return { percent: 100, color: "red", valueText: "Error", showValueText: true }
    }
    if (status === "done") {
      return { percent: 100, color: "green", valueText: "100%", showValueText: true }
    }
    if (status === "queued" || !status) {
      return { percent: 0, color: "yellow", valueText: "", showValueText: false }
    }

    // processing
    const started = startedAtUtc ? Date.parse(startedAtUtc) : null
    const elapsedSec = started ? Math.max(0, Math.round((now - started) / 1000)) : 0
    const dur = durationSec ?? 600 // fallback 10 min
    const totalEstimatedSec = Math.max(60, Math.round(dur * 1.6)) // heurística conservadora
    let p = Math.floor((elapsedSec / totalEstimatedSec) * 100)
    p = Math.max(5, Math.min(p, 99)) // no llegar a 100% hasta 'done'
    const remaining = Math.max(0, totalEstimatedSec - elapsedSec)

    return { percent: p, color: "blue", valueText: `≈ ${fmt(remaining)}`, showValueText: true }
  }, [status, startedAtUtc, now, durationSec])

  return (
    <Progress.Root value={percent} max={100} size="md" borderRadius="full">
      <Progress.Track>
        <Progress.Range colorPalette={color} />
      </Progress.Track>
      {showValueText && <Progress.ValueText>{valueText}</Progress.ValueText>}
    </Progress.Root>
  )
}