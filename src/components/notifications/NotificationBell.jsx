// src/components/notifications/NotificationBell.jsx
import React, { useEffect, useMemo, useState } from "react"
import {
  Box,
  Button,
  ButtonGroup,
  EmptyState,
  HStack,
  IconButton,
  Popover,
  Portal,
  Stack,
  Text,
} from "@chakra-ui/react"
import { LuBell, LuBellOff, LuCheck, LuArchive } from "react-icons/lu"
import dayjs from "dayjs"
import relativeTime from "dayjs/plugin/relativeTime"
import "dayjs/locale/es"
import { keyframes } from "@emotion/react"
import { unreadCount, list, markRead, archive, markAllRead } from "../../api/meNotifications"

dayjs.extend(relativeTime)
dayjs.locale("es")

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false)
  const [count, setCount] = useState(0)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [onlyUnread, setOnlyUnread] = useState(true)

  const badgeColor = useMemo(() => {
    if (!count) return "transparent"
    const kinds = items.map(i => i.kind?.toLowerCase())
    if (kinds.includes("urgent")) return "red.500"
    if (kinds.includes("warning")) return "yellow.500"
    if (kinds.includes("success")) return "green.500"
    return "gray.400"
  }, [items, count])

  const ping = keyframes`
    0%   { transform: scale(1);   opacity: 0.7; }
    80%  { transform: scale(2.2); opacity: 0;   }
    100% { transform: scale(2.2); opacity: 0;   }
  `
  const hasUrgent = useMemo(() => {
    if (!count) return false
    return items.some(i => (i.kind || "").toLowerCase() === "urgent")
  }, [items, count])

  // Cargar contador al montar y periódicamente (ligero)
  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        const c = await unreadCount()
        if (alive) setCount(c)

        if (alive && c > 0 && items.length === 0) {
        try {
          const rows = await list({ onlyUnread: true })
          if (alive) setItems(rows)
        } catch {}
     }
      } catch {}
    }
    load()
    const t = setInterval(load, 30000) // cada 30s
    return () => { alive = false; clearInterval(t) }
  }, [items.length])

  // Al abrir, carga lista
  useEffect(() => {
    if (!isOpen) return
    let alive = true
    ;(async () => {
      setLoading(true)
      try {
        const rows = await list({ onlyUnread })
        if (!alive) return
        setItems(rows)
      } catch {
        if (!alive) return
        setItems([])
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [isOpen, onlyUnread])

  const ids = useMemo(() => items.map((x) => x.id), [items])

  const handleMarkRead = async (id) => {
    await markRead(id)
    // Actualiza UI local
    setItems((arr) => arr.filter((n) => n.id !== id))
    setCount((c) => Math.max(0, c - 1))
  }

  const handleArchive = async (id) => {
    await archive(id)
    setItems((arr) => arr.filter((n) => n.id !== id))
    // Si estaba no leída también descuenta contador
    setCount((c) => Math.max(0, c - 1))
  }

  const handleMarkAll = async () => {
    await markAllRead(ids)
    setItems([])
    setCount(0)
  }
  return (
    <Popover.Root open={isOpen} onOpenChange={(d) => setIsOpen(d.open)}>
      <Popover.Trigger asChild>
        <Box position="relative">
          <IconButton
            aria-label="Notificaciones"
            variant="ghost"
            colorPalette="gray"
            size="sm"
          >
            <LuBell />
          </IconButton>
          {/* Badge contador (simple) */}
                    {count > 0 && (
            <Box position="absolute" top="-2px" right="-2px">
              {/* Halo animado SOLO si hay urgentes y el popover NO está abierto */}
              {hasUrgent && !isOpen && (
                <Box
                  position="absolute"
                  inset="0"
                  borderRadius="full"
                  bg="red.500"
                  opacity="0.6"
                  animation={`${ping} 1.5s ease-out infinite`}
                  transformOrigin="center"
                  zIndex={-1}
                />
              )}
              <Box
                position="relative"
                bg={badgeColor}
                color="white"
                fontSize="10px"
                lineHeight="14px"
                minW="16px"
                h="16px"
                borderRadius="full"
                textAlign="center"
                px="1"
                boxShadow="0 0 0 1px var(--chakra-colors-bg-panel)"
              >
                {count > 99 ? "99" : count}
              </Box>
            </Box>
          )}
        </Box>
      </Popover.Trigger>

      <Portal>
        <Popover.Positioner>
          <Popover.Content 
             minW="sm"
            boxShadow="lg"
            bg="bg.panel"
            borderWidth="1px"
            borderColor="border"
            rounded="lg"
            zIndex="popover"
          >
            <Popover.Body p="0">
              {/* Header */}
              <Stack borderBottomWidth="1px">
                <HStack justify="space-between" py="2" px="4">
                  <Text textStyle="sm" fontWeight="medium">
                    Notificaciones
                  </Text>
                  <HStack gap="2">
                    <Button
                      variant="ghost"
                      colorPalette="gray"
                      size="xs"
                      onClick={() => setOnlyUnread((v) => !v)}
                    >
                      {onlyUnread ? "Ver todas" : "Solo no leídas"}
                    </Button>
                    <Button
                      variant="ghost"
                      colorPalette="gray"
                      size="xs"
                      onClick={handleMarkAll}
                      isDisabled={ids.length === 0}
                    >
                      <LuCheck />
                      Marcar todo leído
                    </Button>
                  </HStack>
                </HStack>
              </Stack>

              {/* Content */}
              <Stack maxH="72" overflowY="auto" px="4" py="3" gap="3">
                {loading && (
                  <Text color="fg.muted" textStyle="sm">Cargando…</Text>
                )}

                {!loading && items.length === 0 && (
                  <EmptyState.Root>
                    <EmptyState.Content>
                      <EmptyState.Indicator
                        display="flex"
                        bg="bg.muted"
                        rounded="full"
                        boxSize="12"
                        alignItems="center"
                        justifyContent="center"
                      >
                        <LuBellOff size={18} />
                      </EmptyState.Indicator>
                      <EmptyState.Description textStyle="xs" color="fg.muted">
                        {onlyUnread ? "No tienes notificaciones nuevas." : "No hay notificaciones."}
                      </EmptyState.Description>
                    </EmptyState.Content>
                  </EmptyState.Root>
                )}

                {!loading && items.length > 0 && items.map((n) => {
                  const kindColor = {
                    info: "gray.400",
                    success: "green.400",
                    warning: "yellow.400",
                    urgent: "red.400",
                  }[n.kind] || "gray.400"

                  return (
                    <Box
                      key={n.id}
                      borderWidth="1px"
                      borderRadius="md"
                      p="10px"
                      bg="bg.subtle"
                      position="relative"
                      overflow="hidden"
                    >
                      {/* línea superior de color */}
                      <Box
                        position="absolute"
                        top="0"
                        left="0"
                        w="100%"
                        h="4px"
                        bg={kindColor}
                        borderTopRadius="md"
                      />

                      <HStack justify="space-between" align="start">
                        <Stack gap="1">
                          <HStack align="center" gap="1">
                            {/* puntito de color junto al tipo */}
                            <Box boxSize="8px" rounded="full" bg={kindColor} />
                            <Text fontWeight="medium" textStyle="sm" textTransform="capitalize">
                              {n.title}
                            </Text>
                          </HStack>

                          <Text color="fg.muted" textStyle="xs" noOfLines={3}>{n.body}</Text>
                          {n.actionUrl && n.actionLabel && (
                            <Button
                              size="xs"
                              colorPalette="blue"
                              mt="2"
                              as="a"
                              href={n.actionUrl}
                              onClick={() => {
                                // opcional: marcar leído al click
                                handleMarkRead(n.id).catch(() => {})
                              }}
                            >
                              {n.actionLabel}
                            </Button>
                          )}
                          <Text color="fg.muted" textStyle="2xs">
                            {n.publishedAtUtc ? dayjs(n.publishedAtUtc).fromNow() : ""}
                          </Text>
                        </Stack>

                        <ButtonGroup size="xs" variant="ghost" colorPalette="gray">
                          <IconButton aria-label="Leído" onClick={() => handleMarkRead(n.id)}>
                            <LuCheck />
                          </IconButton>
                          <IconButton aria-label="Archivar" onClick={() => handleArchive(n.id)}>
                            <LuArchive />
                          </IconButton>
                        </ButtonGroup>
                      </HStack>
                    </Box>
                  )
                })}
              </Stack>
            </Popover.Body>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  )
}
