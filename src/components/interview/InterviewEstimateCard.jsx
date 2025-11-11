// src/components/interview/InterviewEstimateCard.jsx
import React, { useEffect, useMemo, useState } from "react"
import { Card, Heading, HStack, VStack, Text, Badge, Spinner, Box } from "@chakra-ui/react"
import { getInterviewEstimates } from "../../utils/interviewEstimates"

/**
 * Props:
 * - interviewId: string (requerido)
 * - file: File | null (archivo recién grabado/subido)
 */
export default function InterviewEstimateCard({ interviewId, file }) {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  // Calcula duración local si viene un File (cargando el blob en <audio>)
  const [durationSec, setDurationSec] = useState(null)
  useEffect(() => {
    let revokedUrl = null
    let audio = null
    setDurationSec(null)
    if (!file) return

    const url = URL.createObjectURL(file)
    revokedUrl = url
    audio = new Audio()
    audio.preload = "metadata"
    audio.src = url
    const onLoaded = () => {
      const d = isFinite(audio.duration) ? audio.duration : null
      if (d && d > 0) setDurationSec(d)
    }
    const onError = () => setDurationSec(null)
    audio.addEventListener("loadedmetadata", onLoaded)
    audio.addEventListener("error", onError)

    return () => {
      audio?.removeEventListener("loadedmetadata", onLoaded)
      audio?.removeEventListener("error", onError)
      try { URL.revokeObjectURL(revokedUrl) } catch {}
    }
  }, [file])

  // Dispara cálculo cuando hay interviewId y al menos file o audio previo en server
  useEffect(() => {
    let alive = true
    ;(async () => {
      if (!interviewId) return
      setLoading(true)
      setError(null)
      try {
        const res = await getInterviewEstimates(file ?? null, durationSec ?? 0, interviewId)
        if (!alive) return
        setData(res)
      } catch (e) {
        if (!alive) return
        setError("No se pudo calcular la estimación")
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
    // durationSec cambia cuando logramos leer metadata del file
  }, [interviewId, file, durationSec])

  const warnColor = useMemo(() => (data?.warnings?.overDuration || data?.warnings?.overSize) ? "red" : "green", [data])

  return (
    <Card.Root p="16px">
      <Heading size="sm" mb="10px">Estimación de tiempo</Heading>

      {loading && (
        <HStack gap="8px">
          <Spinner />
          <Text>Midiendo conexión y tamaño del audio…</Text>
        </HStack>
      )}

      {!loading && error && (
        <Text color="red.500">{error}</Text>
      )}

      {!loading && !error && data && (
        <VStack align="stretch" gap="8px">
          {/* Archivo */}
          <HStack wrap="wrap" gap="8px">
            {data.file?.name && <Badge>{data.file.name}</Badge>}
            <Badge title="Tamaño aproximado">{`${data.file.sizeMB.toFixed(1)} MB`}</Badge>
            <Badge title="Duración">
              {Math.round((data.file.durationSec || 0) / 60)} min
            </Badge>
          </HStack>

          {/* Conexión */}
          <HStack wrap="wrap" gap="8px">
            <Badge colorPalette="purple" title="Velocidad de subida">
              {data.connection?.uploadMbps ? `${data.connection.uploadMbps.toFixed(1)} Mbps ↑` : "—"}
            </Badge>
          </HStack>

          {/* Estimaciones */}
          <Box
            borderWidth="1px"
            borderRadius="md"
            p="10px"
            bg="blackAlpha.50"
          >
            <VStack align="stretch" gap="6px">
              <HStack justify="space-between">
                <Text color="fg.muted">Subida estimada</Text>
                <Text fontWeight="medium">{data.formatted.upload}</Text>
              </HStack>
              <HStack justify="space-between">
                <Text color="fg.muted">Procesamiento (STT)</Text>
                <Text fontWeight="medium">{data.formatted.processing}</Text>
              </HStack>
              <HStack justify="space-between">
                <Text color="fg.muted">Total estimado</Text>
                <Text fontWeight="semibold" color={`${warnColor}.600`}>
                  {data.formatted.total}
                </Text>
              </HStack>
            </VStack>
          </Box>

          {/* Warnings */}
          {(data.warnings?.overDuration || data.warnings?.overSize) && (
            <VStack align="stretch" gap="4px">
              {data.warnings?.overDuration && (
                <Text color="red.600">
                  ⚠️ La duración supera el máximo recomendado ({data.warnings.maxDurationMin} min).
                </Text>
              )}
              {data.warnings?.overSize && (
                <Text color="red.600">
                  ⚠️ El archivo supera el tamaño recomendado ({data.warnings.maxSizeMB} MB).
                </Text>
              )}
            </VStack>
          )}
        </VStack>
      )}
    </Card.Root>
  )
}
