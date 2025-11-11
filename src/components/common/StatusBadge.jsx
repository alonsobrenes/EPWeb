// src/components/common/StatusBadge.jsx
import React from "react"
import { Badge, HStack, Spinner, Text, Tooltip } from "@chakra-ui/react"

const MAP = {
  queued:    { palette: "yellow",  label: "En cola",      tip: "Hay otros procesos antes del tuyo; no tienes que hacer nada." },
  processing:{ palette: "blue",    label: "Procesando…",  tip: "Este paso puede tardar varios minutos según la duración." },
  done:      { palette: "green",   label: "Lista",        tip: "Revisa el texto; puedes editarlo si es necesario." },
  failed:    { palette: "red",     label: "Falló",        tip: "Intenta de nuevo. Si persiste, usa ‘Transcribir (forzar)’." },
  cached:    { palette: "teal",    label: "Caché",        tip: "Resultado recuperado de caché." },
}

export default function StatusBadge({ status, showSpinner = true }) {
  const key = (status || "").toLowerCase()
  const conf = MAP[key] ?? { palette: "gray", label: status || "—", tip: "" }

  const content = (
    <Badge colorPalette={conf.palette}>
      <HStack gap="6px">
        {showSpinner && key === "processing" ? <Spinner size="xs" /> : null}
        <Text>{conf.label}</Text>
      </HStack>
    </Badge>
  )

  return conf.tip ? (
    <Tooltip.Root openDelay={300}>
        <Tooltip.Trigger asChild>
          {content}
        </Tooltip.Trigger>
        <Tooltip.Content>
          {conf.tip}
        </Tooltip.Content>
      </Tooltip.Root>
  ) : content
}
