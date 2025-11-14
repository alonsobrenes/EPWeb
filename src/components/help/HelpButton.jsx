// src/components/help/HelpButton.jsx
import React, { useRef, useState, useEffect } from "react"
import {
  Box,
  Button,
  HStack,
  IconButton,
  Input,
  Portal,
  Text,
  Textarea,
  VStack,
  Dialog,
  Badge,
  Tabs,
  Table,
  Separator,     // 👈 igual que en BillingPage
} from "@chakra-ui/react"
import { LuCircleHelp, LuFile, LuFileText, LuImage } from "react-icons/lu"
import { keyframes } from "@emotion/react"
import { createTicket, listMyTickets, getTicket, replyTicket, uploadAttachment, closeTicket, listOrgTickets } from "../../api/meSupportApi"
import { toaster } from "../ui/toaster"
import dayjs from "dayjs"

export default function HelpButton() {
  const [open, setOpen] = useState(false)
  const [tabValue, setTabValue] = useState("report") // 'report' | 'tickets'
  const firstFieldRef = useRef(null)
  const [subject, setSubject] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState("bug")
  const [priority, setPriority] = useState("normal")
  const [submitting, setSubmitting] = useState(false)

   // tickets
  const [loadingTickets, setLoadingTickets] = useState(false)
  const [tickets, setTickets] = useState([])
  const [ticketsError, setTicketsError] = useState("")
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [loadingTicketDetail, setLoadingTicketDetail] = useState(false)
  const [ticketMessages, setTicketMessages] = useState([])
  const [ticketError, setTicketError] = useState("")
  const [ticketAttachments, setTicketAttachments] = useState([])
  const [uploadingAttachment, setUploadingAttachment] = useState(false)
  const [replyText, setReplyText] = useState("")
  const [sendingReply, setSendingReply] = useState(false)
  const [orgTickets, setOrgTickets] = useState([])
  const [loadingOrgTickets, setLoadingOrgTickets] = useState(false)
  const [orgTicketsLoaded, setOrgTicketsLoaded] = useState(false)
  const [orgTicketsError, setOrgTicketsError] = useState(null)
  const [canSeeOrgTickets, setCanSeeOrgTickets] = useState(false)


  const messagesEndRef = useRef(null)
  const isClosed = selectedTicket?.status === "closed"
  // shimmer para “skeleton”
  const shimmer = keyframes`
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  `

  async function loadTickets() {
     try {
       setTicketsError("")
       setLoadingTickets(true)
       const rows = await listMyTickets({ top: 50 })
       setTickets(rows)
     } catch (err) {
       setTicketsError("No fue posible cargar tus tickets.")
     } finally {
       setLoadingTickets(false)
     }
  }

  async function loadTicketDetail(id) {
    setSelectedTicket(null)
    setTicketMessages([])
    setTicketAttachments([])
    setTicketError("")
    setLoadingTicketDetail(true)
    try {
        const data = await getTicket(id)
        setSelectedTicket({
        id: data.id,
        subject: data.subject,
        status: data.status,
        priority: data.priority,
        category: data.category,
        createdAtUtc: data.createdAtUtc,
        updatedAtUtc: data.updatedAtUtc,
        })
        setTicketMessages(data.messages || [])
        setTicketAttachments(data.attachments || [])
    } catch (err) {
        console.error("Error cargando ticket", err)
        setTicketError("No fue posible cargar el ticket.")
    } finally {
        setLoadingTicketDetail(false)
    }
  }

  useEffect(() => {
  async function checkOrgAccess() {
    try {
      await listOrgTickets()   // <-- el mismo que ya usas en el tab
      setCanSeeOrgTickets(true)
    } catch (err) {
      setCanSeeOrgTickets(false)
    }
  }

  if (open) {
    checkOrgAccess()
  }
}, [open])

  useEffect(() => {
    function onOpenHelp(e) {
      const ticketId = e?.detail?.ticketId
      setOpen(true)
      setTabValue("tickets")
      if (ticketId) loadTicketDetail(ticketId)
    }
    window.addEventListener("ep:open-help", onOpenHelp)
    return () => window.removeEventListener("ep:open-help", onOpenHelp)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
  try {
    const url = new URL(window.location.href)
    if (url.pathname === "/app/help" && url.searchParams.has("ticket")) {
      const tid = url.searchParams.get("ticket")
      setOpen(true)
      setTabValue("tickets")
      if (tid) loadTicketDetail(tid)
    }
  } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [])

   // al abrir, si la pestaña actual es "tickets", carga
  useEffect(() => {
     if (open && tabValue === "tickets") loadTickets()
  }, [open, tabValue])

   // refresh suave cada 60s solo si está abierta la pestaña "tickets"
  useEffect(() => {
     if (!(open && tabValue === "tickets")) return
     const t = setInterval(loadTickets, 60000)
     return () => clearInterval(t)
  }, [open, tabValue])

  function scrollMessagesToEnd() {
    if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" })
    }
  }

  async function onCloseTicketClick() {
    if (!selectedTicket) return
    const ok = window.confirm("¿Seguro que quieres marcar este ticket como cerrado?")
    if (!ok) return

    try {
      await closeTicket(selectedTicket.id)
      toaster.success({ title: "Ticket cerrado" })

      // Actualizar estado local sin recargar todo
      setSelectedTicket((prev) =>
        prev
          ? {
              ...prev,
              status: "closed",
            }
          : prev,
      )

      // Opcional: también actualizar la lista de tickets (si la tienes en estado)
      setTickets((prev) =>
        prev
          ? prev.map((t) =>
              t.id === selectedTicket.id ? { ...t, status: "closed" } : t,
            )
          : prev,
      )
    } catch (err) {
      console.error(err)
      toaster.error({ title: "No fue posible cerrar el ticket" })
    }
  }

  async function onSubmit(e) {
    e.preventDefault()
    const subj = subject.trim()
    const desc = description.trim()
    if (!subj || !desc) {
      toaster.warning({ title: "Completa asunto y descripción" })
      return
    }
    setSubmitting(true)
    try {
      await createTicket({ subject: subj, description: desc, category, priority })
      toaster.success({ title: "Ticket creado",description: "Gracias, te responderemos pronto." })
      // limpia el formulario
      setSubject(""); setDescription(""); setCategory("bug"); setPriority("normal")
      // cambia a "Mis tickets" y recarga
      setTabValue("tickets")
      await loadTickets()
    } catch (err) {
      const status = err?.response?.status
      if (status === 429) {
        const msg =
          err?.response?.data?.error ||
          "Has creado muchos tickets en poco tiempo. Intenta más tarde o escríbenos al correo de soporte."
        toaster.error({
          title: "Límite de tickets alcanzado",
          description: msg,
        })
        return
      }
      toaster.error({ title: "No fue posible crear tu ticket" })
    } finally {
      setSubmitting(false)
    }
  }

  async function onReplySubmit(e) {
    e.preventDefault()
    const txt = replyText.trim()
    if (!selectedTicket) return
    if (!txt) {
        toaster.error({ title: "Escribe un mensaje" })
        return
    }
    setSendingReply(true)
    try {
        await replyTicket(selectedTicket.id, txt)
        // optimista: agrega el mensaje al hilo local sin re-fetch completo
        const mine = {
        id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2),
        body: txt,
        createdAtUtc: new Date().toISOString(),
        senderUserId: 0, // no importa, usamos 'mine' al render
        mine: true,
        }
        setTicketMessages((prev) => [...prev, mine])
        setReplyText("")
        toaster.success({ title: "Respuesta enviada" })
        // opcional: puedes recargar desde servidor si quieres consistencia total:
        // await loadTicketDetail(selectedTicket.id)
    } catch (err) {
        console.error(err)
        toaster.error({ title: "No fue posible enviar la respuesta" })
    } finally {
        setSendingReply(false)
    }
  }

  function getAttachmentIcon(mimeType) {
    if (!mimeType) return <LuFile size={14} />

    const mt = mimeType.toLowerCase()
    if (mt.startsWith("image/")) return <LuImage size={14} />
    if (mt === "application/pdf") return <LuFileText size={14} />

    return <LuFile size={14} />
  }

  async function onAttachmentSelected(e) {
    const file = e.target.files?.[0]
    if (!file || !selectedTicket) return

    setUploadingAttachment(true)
    try {
      const uploaded = await uploadAttachment(selectedTicket.id, file)
      setTicketAttachments((prev) => [...prev, uploaded])
      toaster.success({ title: "Archivo adjuntado" })
      // limpiar input para permitir subir el mismo archivo de nuevo si se desea
      e.target.value = ""
    } catch (err) {
      console.error(err)
      toaster.error({ title: "No fue posible subir el archivo" })
    } finally {
      setUploadingAttachment(false)
    }
  }

  async function loadOrgTickets() {
    setLoadingOrgTickets(true)
    setOrgTicketsError(null)
    try {
      const data = await listOrgTickets()
      setOrgTickets(data || [])
      setOrgTicketsLoaded(true)
    } catch (err) {
      console.error(err)
      const status = err?.response?.status
      if (status === 403) {
        setOrgTicketsError(
          "Esta vista está disponible solo para dueños de una organización de tipo clínica."
        )
      } else {
        setOrgTicketsError(
          "No fue posible cargar los tickets de tu organización."
        )
      }
    } finally {
      setLoadingOrgTickets(false)
    }
  }

  useEffect(() => {
    if (selectedTicket) {
        scrollMessagesToEnd()
    }
  }, [selectedTicket, ticketMessages])


  return (
    <Dialog.Root
      open={open}
      onOpenChange={(d) => setOpen(d.open)}
      initialFocusEl={() => firstFieldRef.current}
    >
      {/* Botón en top-right (colócalo junto a NotificationBell) */}
      <Dialog.Trigger asChild>
        <IconButton
          aria-label="Ayuda"
          variant="ghost"
          colorPalette="gray"
          size="sm"
          onClick={() => { setTabValue("report"); setOpen(true) }}
        >
          <LuCircleHelp />
        </IconButton>
      </Dialog.Trigger>

      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content
            position="fixed"
            right="0"
            top="0"
            h="100svh"
            w={{ base: "100vw", md: "30vw" }}
            maxW={{ base: "100vw", md: "560px" }}
            minW={{ base: "100vw", md: "420px" }}
            bg="bg.panel"
            borderLeftWidth={{ base: "0px", md: "1px" }}
            borderColor="border"
            rounded="0"
            boxShadow="2xl"
            transform="none"
            insetInlineStart="auto"
            insetBlockStart="0"
          >
            {/* Header */}
            <Box px="4" py="3" borderBottomWidth="1px">
              <HStack justify="space-between" wrap="wrap" gap="2">
                <Text fontWeight="semibold">Soporte y solución de problemas</Text>
                <HStack>
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => setTabValue("tickets")}
                  >
                    Mis tickets
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                    Cerrar
                  </Button>
                </HStack>
              </HStack>
            </Box>

            {/* Tabs v3 — MISMO PATRÓN QUE BillingPage */}
            <Tabs.Root
              value={tabValue}
              onValueChange={(e) =>{
                            const value = e.value
                            setTabValue(e.value)
                            if (value === "org" && !orgTicketsLoaded && !loadingOrgTickets) {
                                loadOrgTickets()
                              }
                             }
                        }
              variant="line"
            >
              <Tabs.List px="4" pt="3" gap="2">
                <Tabs.Trigger value="report">Reportar</Tabs.Trigger>
                <Tabs.Trigger value="tickets">Mis tickets</Tabs.Trigger>
                {canSeeOrgTickets && (
                  <Tabs.Trigger value="org">Tickets de mi organización</Tabs.Trigger>
                )}
              </Tabs.List>

              <Separator my="2" />

              {/* Contenido scrollable del panel */}
              <Box px="2" overflowY="auto" h="calc(100svh - 104px)">
                <Tabs.Content value="report">
                  <VStack align="stretch" gap="4">
                    <Box>
                      <Text textStyle="sm" color="fg.muted" mb="2">
                        ¿Cómo podemos ayudarte? Describe el problema o solicitud.
                      </Text>
                      <Box
                        as="form"
                        onSubmit={onSubmit}
                        borderWidth="1px"
                        borderColor="border"
                        rounded="md"
                        p="3"
                        bg="bg.subtle"
                      >
                        <VStack align="stretch" gap="3">
                          <Box>
                            <Text as="label" htmlFor="subject" fontWeight="semibold" mb="1" display="block">
                              Asunto
                            </Text>
                            <Input
                                id="subject"
                                ref={firstFieldRef}
                                value={subject}
                                onChange={(e) => setSubject(e.target.value)}
                                placeholder="Ej. Error al transcribir una entrevista"
                            />
                          </Box>

                          <HStack gap="3">
                            <Box flex="1">
                              <Text as="label" htmlFor="category" fontWeight="semibold" mb="1" display="block">
                                Categoría
                              </Text>
                              <select
                                id="category"
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                style={{ width: "100%", padding: "8px", borderRadius: 6, border: "1px solid var(--chakra-colors-border)" }}
                              >
                                <option value="bug">Error técnico</option>
                                <option value="feature">Sugerencia</option>
                                <option value="billing">Facturación</option>
                                <option value="other">Otro</option>
                              </select>
                            </Box>
                            <Box flex="1">
                              <Text as="label" htmlFor="priority" fontWeight="semibold" mb="1" display="block">
                                Prioridad
                              </Text>
                              <select
                                id="priority"
                                value={priority}
                                onChange={(e) => setPriority(e.target.value)}
                                style={{ width: "100%", padding: "8px", borderRadius: 6, border: "1px solid var(--chakra-colors-border)" }}
                              >
                                <option value="low">Baja</option>
                                <option value="normal">Normal</option>
                                <option value="high">Alta</option>
                              </select>
                            </Box>
                          </HStack>

                          <Box>
                            <Text as="label" htmlFor="desc" fontWeight="semibold" mb="1" display="block">
                              Descripción
                            </Text>
                            <Textarea
                              id="desc"
                              rows={6}
                              value={description}
                              onChange={(e) => setDescription(e.target.value)}
                              placeholder="Cuéntanos qué pasó, qué esperabas que ocurriera y cualquier detalle útil (pasos, archivo, etc.)"
                            />
                          </Box>

                          <HStack justify="flex-end">
                            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                            <Button colorPalette="blue" type="submit" loading={submitting} disabled={submitting}>
                                {submitting ? "Enviando..." : "Enviar"}
                            </Button>
                          </HStack>
                        </VStack>
                      </Box>
                    </Box>
                  </VStack>
                </Tabs.Content>

                <Tabs.Content value="tickets">
                    {!selectedTicket && (
                        <>
                          <VStack align="stretch" gap="3">
                            <Text fontWeight="semibold">Mis tickets recientes</Text>

                            {loadingTickets && (
                              <VStack align="stretch" gap="3">
                                {Array.from({ length: 3 }).map((_, i) => (
                                  <Box key={i} borderWidth="1px" borderColor="border" rounded="md" p="12px" bg="bg.subtle">
                                    <Box
                                      h="10px" w="60%" mb="8px" rounded="sm"
                                      style={{
                                        backgroundImage:
                                          "linear-gradient(90deg, var(--chakra-colors-bg), var(--chakra-colors-gray-300), var(--chakra-colors-bg))",
                                        backgroundSize: "200% 100%",
                                        animation: `${shimmer} 1.6s linear infinite`,
                                      }}
                                    />
                                    <Box
                                      h="8px" w="90%" mb="6px" rounded="sm"
                                      style={{
                                        backgroundImage:
                                          "linear-gradient(90deg, var(--chakra-colors-bg), var(--chakra-colors-gray-200), var(--chakra-colors-bg))",
                                        backgroundSize: "200% 100%",
                                        animation: `${shimmer} 1.6s linear infinite`,
                                      }}
                                    />
                                    <Box
                                      h="8px" w="70%" rounded="sm"
                                      style={{
                                        backgroundImage:
                                          "linear-gradient(90deg, var(--chakra-colors-bg), var(--chakra-colors-gray-200), var(--chakra-colors-bg))",
                                        backgroundSize: "200% 100%",
                                        animation: `${shimmer} 1.6s linear infinite`,
                                      }}
                                    />
                                  </Box>
                                ))}
                              </VStack>
                            )}

                            {!loadingTickets && ticketsError && (
                              <Box borderWidth="1px" borderColor="border" p="12px" rounded="md" bg="bg.subtle">
                                <Text color="fg.muted">{ticketsError}</Text>
                              </Box>
                            )}

                            {!loadingTickets && !ticketsError && tickets.length === 0 && (
                              <Box borderWidth="1px" borderColor="border" p="12px" rounded="md" bg="bg.subtle">
                                <Text color="fg.muted">Aún no has creado tickets.</Text>
                              </Box>
                            )}

                            {!loadingTickets && !ticketsError && tickets.length > 0 && (
                              <VStack align="stretch" gap="3">
                                {tickets.map((t) => {
                                  const statusColor =
                                    t.status === "open" ? "blue" :
                                    t.status === "in_progress" ? "yellow" :
                                    t.status === "resolved" ? "green" : "gray"
                                  return (
                                    <Box
                                      key={t.id}
                                      borderWidth="1px"
                                      borderColor="border"
                                      rounded="md"
                                      p="12px"
                                      bg="bg.subtle"
                                      onClick={() => loadTicketDetail(t.id)}
                                      cursor="pointer"
                                      _hover={{ bg: "bg.muted" }}
                                    >
                                      <HStack justify="space-between" align="start" mb="1">
                                        <Text fontWeight="semibold" noOfLines={1}>{t.subject}</Text>
                                        <HStack gap="2">
                                          {t.priority && <Badge colorPalette="gray">{t.priority}</Badge>}
                                          <Badge colorPalette={statusColor}>{t.status}</Badge>
                                        </HStack>
                                      </HStack>
                                      <Text color="fg.muted" textStyle="xs">
                                        Creado: {new Date(t.createdAtUtc).toLocaleString()}
                                        {t.lastMessageAtUtc ? ` • Última actividad: ${new Date(t.lastMessageAtUtc).toLocaleString()}` : ""}
                                      </Text>
                                    </Box>
                                  )
                                })}
                              </VStack>
                            )}
                          </VStack>
                        </>
                      )}

                      {selectedTicket && (
                        <VStack align="stretch" gap="3">
                          <HStack justify="space-between" align="center">
                            <Text fontWeight="semibold" noOfLines={1}>{selectedTicket.subject}</Text>
                            <HStack>
                              {selectedTicket.priority && <Badge colorPalette="gray">{selectedTicket.priority}</Badge>}
                              <Badge colorPalette={
                                selectedTicket.status === "open" ? "blue" :
                                selectedTicket.status === "in_progress" ? "yellow" :
                                selectedTicket.status === "resolved" ? "green" : "gray"
                              }>
                                {selectedTicket.status}
                              </Badge>
                            </HStack>
                          </HStack>

                          {loadingTicketDetail && (
                            <Box borderWidth="1px" borderColor="border" rounded="md" p="12px" bg="bg.subtle">
                              <Text color="fg.muted">Cargando conversación…</Text>
                            </Box>
                          )}

                          {!loadingTicketDetail && ticketError && (
                            <Box borderWidth="1px" borderColor="border" rounded="md" p="12px" bg="bg.subtle">
                              <Text color="fg.muted">{ticketError}</Text>
                            </Box>
                          )}

                          {!loadingTicketDetail && !ticketError && (
                            <>
                              {/* Hilo de mensajes */}
                              <Box
                                borderWidth="1px"
                                borderColor="border"
                                rounded="md"
                                p="12px"
                                bg="bg.subtle"
                                maxH="45vh"
                                overflowY="auto"
                              >
                                <VStack align="stretch" gap="2">
                                  {ticketMessages.map((m) => (
                                    <HStack key={m.id} justify={m.mine ? "flex-end" : "flex-start"}>
                                      <Box
                                        maxW="75%"
                                        bg={m.mine ? "blue.500" : "bg.panel"}
                                        color={m.mine ? "white" : "fg.default"}
                                        p="8px"
                                        rounded="md"
                                        borderWidth={m.mine ? "0" : "1px"}
                                      >
                                        <Text textStyle="sm" whiteSpace="pre-wrap">{m.body}</Text>
                                        <Text textStyle="2xs" mt="1" opacity={0.8}>
                                          {new Date(m.createdAtUtc).toLocaleString()}
                                        </Text>
                                      </Box>
                                    </HStack>
                                  ))}
                                  <div ref={messagesEndRef} />
                                </VStack>
                              </Box>
                              {ticketAttachments.length > 0 && (
                                <Box
                                  borderWidth="1px"
                                  borderColor="border"
                                  rounded="md"
                                  p="8px"
                                  bg="bg.subtle"
                                >
                                  <Text textStyle="xs" fontWeight="semibold" mb="2">
                                    Adjuntos
                                  </Text>
                                  <VStack align="stretch" gap="1">
                                    {ticketAttachments.map((a) => (
                                      <HStack key={a.id} justify="space-between">
                                        <HStack gap="2" align="center">
                                        {getAttachmentIcon(a.mimeType)}
                                        <a
                                          href={a.uri}
                                          target="_blank"
                                          rel="noreferrer"
                                          style={{ textDecoration: "underline" }}
                                        >
                                          {a.fileName}
                                        </a>
                                        <Text textStyle="2xs" color="fg.muted">
                                          {a.sizeBytes ? `${(a.sizeBytes / 1024).toFixed(1)} KB` : ""}
                                        </Text>
                                        </HStack>
                                      </HStack>
                                    ))}
                                  </VStack>
                                </Box>
                              )}

                              {/* Responder */}
                              <Box
                                as="form"
                                onSubmit={onReplySubmit}
                                borderWidth="1px"
                                borderColor="border"
                                rounded="md"
                                p="10px"
                                bg="bg.subtle"
                              >
                                <VStack align="stretch" gap="2">
                                  <Textarea
                                    rows={3}
                                    placeholder={
                                      isClosed
                                        ? "Este ticket está cerrado. No puedes enviar más mensajes."
                                        : "Escribe tu respuesta…"
                                    }
                                    value={replyText}
                                    onChange={(e) => setReplyText(e.target.value)}
                                  />
                                  <HStack justify="space-between" align="center" flexWrap="wrap" gap="2">
                                      <label style={{ fontSize: "0.8rem" }}>
                                        Adjuntar archivo (PNG, JPG, WEBP o PDF, máx 10 MB)
                                        <input
                                          type="file"
                                          accept=".png,.jpg,.jpeg,.webp,.pdf"
                                          onChange={onAttachmentSelected}
                                          disabled={uploadingAttachment}
                                          style={{ display: "block", marginTop: 4 }}
                                        />
                                      </label>
                                      {uploadingAttachment && (
                                        <Text textStyle="xs" color="fg.muted">
                                          Subiendo archivo…
                                        </Text>
                                      )}
                                    </HStack>
                                  <HStack justify="space-between">
                                    <Button variant="ghost" size="sm" onClick={() => {
                                                              setSelectedTicket(null)
                                                              setTicketAttachments([])
                                                            }}>
                                      ← Volver a la lista de tickets
                                    </Button>
                                    <HStack gap="2">
                                    {!isClosed && (
                                      <Button
                                        variant="subtle"
                                        size="sm"
                                        onClick={onCloseTicketClick}
                                      >
                                        Cerrar ticket
                                      </Button>
                                    )}
                                    <Button
                                      colorPalette="blue"
                                      type="submit"
                                      size="sm"
                                      loading={sendingReply}
                                      disabled={sendingReply}
                                    >
                                      {sendingReply ? "Enviando…" : "Enviar"}
                                    </Button>
                                  </HStack>
                                  </HStack>
                                  {isClosed && (
      <Text textStyle="xs" color="fg.muted">
        Este ticket está cerrado. Si el problema reaparece, puedes abrir un ticket nuevo.
      </Text>
    )}
                                </VStack>
                              </Box>
                            </>
                          )}
                        </VStack>
                      )}
                </Tabs.Content>
                {canSeeOrgTickets && ( <Tabs.Content value="org">
  <VStack align="stretch" gap="3" pt="3">
    <Text fontWeight="semibold">Tickets de mi organización</Text>

    {loadingOrgTickets && (
      <VStack align="stretch" gap="3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Box
            key={i}
            borderWidth="1px"
            borderColor="border"
            rounded="md"
            p="12px"
            bg="bg.subtle"
          >
            <Box
              h="10px"
              w="60%"
              mb="8px"
              rounded="sm"
              bg="bg.muted"
              style={{
                animation: `${shimmer} 1.6s linear infinite`,
              }}
            />
            <Box
              h="8px"
              w="90%"
              mb="6px"
              rounded="sm"
              bg="bg.muted"
              style={{
                animation: `${shimmer} 1.6s linear infinite`,
              }}
            />
            <Box
              h="8px"
              w="70%"
              rounded="sm"
              bg="bg.muted"
              style={{
                animation: `${shimmer} 1.6s linear infinite`,
              }}
            />
          </Box>
        ))}
      </VStack>
    )}

    {!loadingOrgTickets && orgTicketsError && (
      <Box borderWidth="1px" borderColor="border" p="12px" rounded="md" bg="bg.subtle">
        <Text color="fg.muted">{orgTicketsError}</Text>
      </Box>
    )}

    {!loadingOrgTickets && !orgTicketsError && orgTickets.length === 0 && (
      <Box borderWidth="1px" borderColor="border" p="12px" rounded="md" bg="bg.subtle">
        <Text color="fg.muted">
          No hay tickets registrados para tu organización todavía.
        </Text>
      </Box>
    )}

    {!loadingOrgTickets && !orgTicketsError && orgTickets.length > 0 && (
      <VStack align="stretch" gap="3">
        {orgTickets.map((t) => {
          const statusColor =
            t.status === "open"
              ? "blue"
              : t.status === "in_progress"
              ? "yellow"
              : t.status === "resolved"
              ? "green"
              : "gray"

          return (
            <Box
              key={t.id}
              borderWidth="1px"
              borderColor="border"
              rounded="md"
              p="12px"
              bg="bg.subtle"
              onClick={() => {
                // Reutilizamos el panel de detalle de “Mis tickets”
                setTabValue("tickets")
                loadTicketDetail(t.id)
              }}
              cursor="pointer"
              _hover={{ bg: "bg.muted" }}
            >
              <HStack justify="space-between" align="start" mb="1">
                <Text fontWeight="semibold" noOfLines={1}>
                  {t.subject}
                </Text>
                <HStack gap="2">
                  {t.priority && (
                    <Badge colorPalette="gray">{t.priority}</Badge>
                  )}
                  <Badge colorPalette={statusColor}>{t.status}</Badge>
                </HStack>
              </HStack>

              {/* Línea de categoría si la tienes */}
              <Text color="fg.muted" textStyle="xs" mb="1">
                {t.category || "Sin categoría"}
              </Text>

              {/* Quién abrió el ticket */}
              <Text color="fg.muted" textStyle="xs" mb="1">
                Reportado por: {t.createdByName || t.createdByEmail || "—"}
              </Text>

              {/* Fechas, mismo estilo que “Mis tickets” */}
              <Text color="fg.muted" textStyle="xs">
                Creado: {new Date(t.createdAtUtc).toLocaleString()}
                {t.lastMessageAtUtc
                  ? ` · Última actividad: ${new Date(
                      t.lastMessageAtUtc
                    ).toLocaleString()}`
                  : ""}
              </Text>
            </Box>
          )
        })}
      </VStack>
    )}
  </VStack>
</Tabs.Content>

)}

              </Box>
            </Tabs.Root>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}
