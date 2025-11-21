import React, { useEffect, useRef, useState } from "react"
import {
  Box,
  Button,
  Dialog,
  HStack,
  VStack,
  Text,
  Badge,
  Textarea,
  Separator,
  Portal,
} from "@chakra-ui/react"
import { getTicketAdmin, patchTicketAdmin, replyTicketAdmin, deleteAttachmentAdmin } from "../api/adminSupportApi"
import api from "../api/client"
import { toaster } from "../components/ui/toaster"
import { absolutizeApiUrl } from "../utils/url"
import { LuFile, LuFileText, LuImage } from "react-icons/lu"
export default function TicketAdminDialog({
  open,
  onClose,
  ticketId,
  subject,
  initialStatus,
  initialPriority,
  initialCategory,
  assignedToUserId,
  onChanged, // callback para refrescar la grilla
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [ticket, setTicket] = useState(null) // { id, subject, status, ... , messages: [], attachments: [] }
  const [downloadingAttachmentId, setDownloadingAttachmentId] = useState(null)
  const [status, setStatus] = useState(initialStatus || "open")
  const [assignee, setAssignee] = useState(assignedToUserId ?? "")
  const [reply, setReply] = useState("")
  const [internalNote, setInternalNote] = useState(false)
  const [sending, setSending] = useState(false)
  const [deletingAttachmentId, setDeletingAttachmentId] = useState(null)
  const endRef = useRef(null)

  async function load() {
    if (!ticketId) return
    try {
      setError("")
      setLoading(true)
      const data = await getTicketAdmin(ticketId)
      setTicket(data)
      setStatus(data.status || "open")
      if (data.assignedToUserId !== undefined) {
        setAssignee(data.assignedToUserId ?? "")
      }
    } catch (err) {
      console.error(err)
      setError("No fue posible cargar el ticket.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ticketId])

  useEffect(() => {
    if (endRef.current) {
      endRef.current.scrollIntoView({ behavior: "smooth", block: "end" })
    }
  }, [ticket])

  async function onSaveStatus() {
    try {
      await patchTicketAdmin(ticketId, { status })
      toaster.success({ title: "Estado actualizado" })
      await load()
      if (onChanged) onChanged()
    } catch (err) {
      console.error(err)
      toaster.error({ title: "No fue posible actualizar el estado" })
    }
  }

  async function onSaveAssignee() {
    const val = String(assignee).trim()
    const assignedToUserId = val === "" ? null : Number(val)
    if (assignedToUserId !== null && Number.isNaN(assignedToUserId)) {
      toaster.error({ title: "ID de asignado inválido" })
      return
    }
    try {
      await patchTicketAdmin(ticketId, { assignedToUserId })
      toaster.success({ title: "Asignación actualizada" })
      await load()
      if (onChanged) onChanged()
    } catch (err) {
      console.error(err)
      toaster.error({ title: "No fue posible actualizar la asignación" })
    }
  }

  async function onSendReply(e) {
    e.preventDefault()
    const body = reply.trim()
    if (!body) {
      toaster.error({ title: "Escribe un mensaje" })
      return
    }
    setSending(true)
    try {
      await replyTicketAdmin(ticketId, { body, internalNote })
      toaster.success({ title: internalNote ? "Nota interna agregada" : "Respuesta enviada" })
      setReply("")
      await load()
      if (onChanged && !internalNote) onChanged()
    } catch (err) {
      console.error(err)
      toaster.error({ title: "No fue posible enviar el mensaje" })
    } finally {
      setSending(false)
    }
  }

  async function onDeleteAttachment(a) {
    if (!ticket) return
    const ok = window.confirm("¿Eliminar este archivo adjunto?")
    if (!ok) return

    setDeletingAttachmentId(a.id)
    try {
      await deleteAttachmentAdmin(ticket.id, a.id)
      // quitarlo del estado local sin recargar todo
      setTicket((prev) =>
        prev
          ? {
              ...prev,
              attachments: (prev.attachments || []).filter((x) => x.id !== a.id),
            }
          : prev,
      )
      toaster.success({ title: "Adjunto eliminado" })
    } catch (err) {
      console.error(err)
      toaster.error({ title: "No fue posible eliminar el adjunto" })
    } finally {
      setDeletingAttachmentId(null)
    }
  }

  async function onDownloadAttachment(a, e) {
    if (e && e.preventDefault) e.preventDefault()
    if (!a?.uri) {
      toaster.error({ title: "El adjunto no tiene una URL válida" })
      return
    }

    const url = absolutizeApiUrl(a.uri)
    setDownloadingAttachmentId(a.id)

    try {
      const response = await api.get(url, {
        responseType: "blob",
      })

      const blob = new Blob([response.data])
      const downloadUrl = window.URL.createObjectURL(blob)

      // Intentar extraer filename del header si viene
      let fileName = a.fileName || "archivo"
      const cd = response.headers?.["content-disposition"] || response.headers?.["Content-Disposition"]
      if (cd) {
        const match = /filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i.exec(cd)
        if (match && match[1]) {
          try {
            fileName = decodeURIComponent(match[1])
          } catch {
            fileName = match[1]
          }
        }
      }

      const link = document.createElement("a")
      link.href = downloadUrl
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(downloadUrl)
    } catch (err) {
      console.error(err)
      toaster.error({ title: "No fue posible descargar el adjunto" })
    } finally {
      setDownloadingAttachmentId(null)
    }
  }

  function getAttachmentIcon(mimeType) {
    if (!mimeType) return <LuFile size={14} />

    const mt = mimeType.toLowerCase()
    if (mt.startsWith("image/")) return <LuImage size={14} />
    if (mt === "application/pdf") return <LuFileText size={14} />

    return <LuFile size={14} />
  }

  const statusValue = ticket?.status || status
  const statusColor =
    statusValue === "open"
      ? "blue"
      : statusValue === "in_progress"
      ? "yellow"
      : statusValue === "resolved"
      ? "green"
      : "gray"

  return (
    <Dialog.Root open={open} onOpenChange={(d) => !d.open && onClose()}>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content
            maxW="860px"
            w="96vw"
            bg="bg.panel"
            borderWidth="1px"
            borderColor="border"
          >
            <Box px="4" py="3" borderBottomWidth="1px" bg="bg.subtle">
              <HStack justify="space-between">
                <Text fontWeight="semibold" noOfLines={1}>
                  Ticket — {subject}
                </Text>
                <HStack>
                  <Button variant="ghost" size="sm" onClick={onClose}>
                    Cerrar
                  </Button>
                </HStack>
              </HStack>
            </Box>
            <Box p="4">
              {loading && <Text color="fg.muted">Cargando…</Text>}
              {!loading && error && <Text color="fg.muted">{error}</Text>}

              {!loading && !error && ticket && (
                <VStack align="stretch" gap="4">
                  <Box
                borderWidth="1px"
                borderColor="border"
                rounded="md"
                p="10px"
                bg="bg.subtle"
              >
                <Text textStyle="xs" fontWeight="semibold" mb="1">
                  Usuario que creó el ticket
                </Text>
                <VStack align="start" gap="0">
                  <Text textStyle="sm">{ticket.openedBy.orgLegalName}</Text>
                  <Text textStyle="sm">{ticket.openedBy.email}</Text>
                </VStack>
              </Box>
                  {/* Metadatos rápidos */}
                  <HStack justify="space-between" align="center">
                    <HStack>
                      <Badge colorPalette={statusColor}>{ticket.status}</Badge>
                      {ticket.priority && (
                        <Badge colorPalette="gray">{ticket.priority}</Badge>
                      )}
                      {ticket.category && (
                        <Badge colorPalette="gray">{ticket.category}</Badge>
                      )}
                    </HStack>
                    <Text textStyle="xs" color="fg.muted">
                      Creado: {new Date(ticket.createdAtUtc).toLocaleString()}
                      {ticket.updatedAtUtc
                        ? ` • Actualizado: ${new Date(
                            ticket.updatedAtUtc,
                          ).toLocaleString()}`
                        : ""}
                    </Text>
                  </HStack>

                  <Separator />

                  {/* Cambios rápidos: estado y asignación */}
                  <HStack gap="3" wrap="wrap">
                    <Box>
                      <Text textStyle="xs" mb="1">
                        Estado
                      </Text>
                      <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        style={{
                          padding: 8,
                          borderRadius: 6,
                          border: "1px solid var(--chakra-colors-border)",
                        }}
                      >
                        <option value="open">open</option>
                        <option value="in_progress">in_progress</option>
                        <option value="resolved">resolved</option>
                        <option value="closed">closed</option>
                      </select>
                    </Box>
                    <Button onClick={onSaveStatus} colorPalette="blue">
                      Guardar estado
                    </Button>

                    <Box>
                      <Text textStyle="xs" mb="1">
                        Asignado a (user_id)
                      </Text>
                      <input
                        value={assignee}
                        onChange={(e) => setAssignee(e.target.value)}
                        placeholder="ID usuario o vacío para desasignar"
                        style={{
                          padding: 8,
                          borderRadius: 6,
                          border: "1px solid var(--chakra-colors-border)",
                          width: 240,
                          background: "var(--chakra-colors-bg)",
                        }}
                      />
                    </Box>
                    <Button onClick={onSaveAssignee} variant="subtle">
                      Guardar asignación
                    </Button>
                  </HStack>

                  <Separator />

                  {/* Hilo de mensajes */}
                  <Box
                    borderWidth="1px"
                    borderColor="border"
                    rounded="md"
                    p="12px"
                    bg="bg.subtle"
                    maxH="50vh"
                    overflowY="auto"
                  >
                    <VStack align="stretch" gap="2">
                      {ticket.messages?.length === 0 && (
                        <Text color="fg.muted">Sin mensajes.</Text>
                      )}
                      {ticket.messages?.map((m) => (
                        <HStack
                          key={m.id}
                          justify={
                            m.isInternal
                              ? "center"
                              : "flex-start" // en admin no distinguimos mine/others
                          }
                        >
                          <Box
                            maxW="75%"
                            bg={m.isInternal ? "yellow.100" : "bg.panel"}
                            color="fg.default"
                            p="8px"
                            rounded="md"
                            borderWidth="1px"
                            borderColor="border"
                          >
                            {m.isInternal && (
                              <Text textStyle="2xs" color="fg.muted" mb="1">
                                Nota interna
                              </Text>
                            )}
                            <Text textStyle="sm" whiteSpace="pre-wrap">
                              {m.body}
                            </Text>
                            <Text textStyle="2xs" mt="1" opacity={0.8}>
                              {new Date(m.createdAtUtc).toLocaleString()} •
                              {" user_id: "}
                              {m.senderUserId}
                            </Text>
                          </Box>
                        </HStack>
                      ))}
                      <div ref={endRef} />
                    </VStack>
                  </Box>

                  {/* Adjuntos (solo lectura) */}
                  {ticket.attachments && ticket.attachments.length > 0 && (
                    <Box
                      borderWidth="1px"
                      borderColor="border"
                      rounded="md"
                      p="10px"
                      bg="bg.subtle"
                    >
                      <Text textStyle="xs" fontWeight="semibold" mb="2">
                        Adjuntos
                      </Text>
                      <VStack align="stretch" gap="1">
                        {ticket.attachments.map((a) => (
                          <HStack
                            key={a.id}
                            justify="space-between"
                            align="center"
                          >
                            <HStack gap="2" align="center">
                            {getAttachmentIcon(a.mimeType)}
                            <a
                              href={ absolutizeApiUrl(a.uri)}
                              onClick={(e) => onDownloadAttachment(a, e)}
                              style={{ textDecoration: "underline" }}
                            >
                              {a.fileName}
                            </a>
                            <Text textStyle="2xs" color="fg.muted">
                              {a.sizeBytes
                                ? `${(a.sizeBytes / 1024).toFixed(1)} KB`
                                : ""}
                            </Text>
                            {downloadingAttachmentId === a.id && (
                                <Text textStyle="2xs" color="fg.muted">
                                  Descargando…
                                </Text>
                              )}
                            </HStack>
                            <Button
                                size="xs"
                                variant="ghost"
                                colorPalette="red"
                                onClick={() => onDeleteAttachment(a)}
                                loading={deletingAttachmentId === a.id}
                                disabled={deletingAttachmentId === a.id}
                              >
                                Eliminar
                              </Button>
                          </HStack>
                        ))}
                      </VStack>
                    </Box>
                  )}

                  {/* Responder / Nota interna */}
                  <Box
                    as="form"
                    onSubmit={onSendReply}
                    borderWidth="1px"
                    borderColor="border"
                    rounded="md"
                    p="10px"
                    bg="bg.subtle"
                  >
                    <VStack align="stretch" gap="2">
                      <Textarea
                        rows={3}
                        placeholder="Escribe una respuesta (visible para el usuario) o marca como nota interna."
                        value={reply}
                        onChange={(e) => setReply(e.target.value)}
                      />
                      <HStack justify="space-between">
                        <label
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={internalNote}
                            onChange={(e) =>
                              setInternalNote(e.target.checked)
                            }
                          />
                          <Text textStyle="sm">
                            Registrar como nota interna (no visible al usuario)
                          </Text>
                        </label>
                        <Button
                          colorPalette="blue"
                          type="submit"
                          loading={sending}
                          disabled={sending}
                        >
                          {sending
                            ? "Enviando…"
                            : internalNote
                            ? "Agregar nota interna"
                            : "Enviar respuesta"}
                        </Button>
                      </HStack>
                    </VStack>
                  </Box>
                </VStack>
              )}
            </Box>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}
