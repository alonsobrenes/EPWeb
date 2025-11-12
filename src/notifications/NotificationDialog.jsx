// src/app/notifications/NotificationDialog.jsx
import { useEffect, useRef, useState } from "react"
import {
  Dialog, Portal, Button, Input, Textarea, VStack, HStack, Box, Text
} from "@chakra-ui/react"
import { AdminNotificationsApi } from "../api/adminNotificationsApi"
import { toaster } from "../components/ui/toaster"

const KINDS = [
  { value: "info", label: "Info" },
  { value: "success", label: "Éxito" },
  { value: "warning", label: "Advertencia" },
  { value: "urgent", label: "Urgente" },
]


const AUDIENCES = [
  { value: "all", label: "Todos (global)" },
  { value: "org", label: "Organización (GUIDs)" },
  { value: "user", label: "Usuarios (IDs)" },
  { value: "role", label: "Roles" },
]

export default function NotificationDialog({ isOpen, onClose, initialValues, onSaved }) {
  const isEdit = !!(initialValues && initialValues.id)
  const firstFieldRef = useRef(null)
  const [saving, setSaving] = useState(false)

  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [kind, setKind] = useState("info")
  const [audience, setAudience] = useState("all")
  const [audienceValue, setAudienceValue] = useState("")
  const [publishedAtUtc, setPublishedAtUtc] = useState("")
  const [expiresAtUtc, setExpiresAtUtc] = useState("")
  const [actionUrl, setActionUrl] = useState("")
  const [actionLabel, setActionLabel] = useState("")

  useEffect(() => {
    if (isOpen) {
      if (isEdit) {
        setTitle(initialValues.title || "")
        setBody(initialValues.body || "")
        setKind(initialValues.kind || "info")
        setAudience(initialValues.audience || "all")
        setAudienceValue(initialValues.audienceValue || "")
        setPublishedAtUtc(initialValues.publishedAtUtc ? new Date(initialValues.publishedAtUtc).toISOString().slice(0, 16) : "")
        setExpiresAtUtc(initialValues.expiresAtUtc ? new Date(initialValues.expiresAtUtc).toISOString().slice(0, 16) : "")
        setActionUrl(initialValues?.actionUrl || "")
        setActionLabel(initialValues?.actionLabel || "")
      } else {
        setTitle("")
        setBody("")
        setKind("info")
        setAudience("all")
        setAudienceValue("")
        setPublishedAtUtc("")
        setExpiresAtUtc("")
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isEdit])

  const getErrorMessage = (error) => {
    const data = error?.response?.data
    if (typeof data === "string") return data
    if (data?.message) return data.message
    return error?.message || "Error"
  }

  async function handleSave() {
    if (!title.trim() || !body.trim()) {
      toaster.error({ title: "Faltan datos", description: "Título y cuerpo son obligatorios." })
      return
    }
    setSaving(true)
    try {
      const payload = {
        title: title.trim(),
        body: body.trim(),
        kind,
        audience,
        audienceValue: audienceValue.trim() || undefined,
        publishedAtUtc: publishedAtUtc ? new Date(publishedAtUtc).toISOString() : null,
        expiresAtUtc: expiresAtUtc ? new Date(expiresAtUtc).toISOString() : null,
        actionUrl: actionUrl.trim() || null,
        actionLabel: actionLabel.trim() || null,
      }
      if (isEdit) {
        await AdminNotificationsApi.update(initialValues.id, payload)
        toaster.success({ title: "Notificación actualizada" })
      } else {
        await AdminNotificationsApi.create(payload)
        toaster.success({ title: "Notificación creada" })
      }
      onSaved?.()
      onClose()
    } catch (e) {
      toaster.error({ title: "Error al guardar", description: getErrorMessage(e) })
    } finally {
      setSaving(false)
    }
  }

  async function quickAction(fn, okMsg) {
    setSaving(true)
    try {
      await fn()
      toaster.success({ title: okMsg })
      onSaved?.()
      onClose()
    } catch (e) {
      toaster.error({ title: "Acción fallida", description: getErrorMessage(e) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(e) => { if (!e.open) onClose() }}
      placement="center"
      initialFocusEl={() => firstFieldRef.current}
    >
      <Portal>
        <Dialog.Backdrop zIndex="modal" />
        <Dialog.Positioner zIndex="modal">
          <Dialog.Content maxW="lg" bg="bg.panel" borderWidth="1px" borderColor="border" rounded="xl">
            <Dialog.Header>
              <Dialog.Title>{isEdit ? "Editar notificación" : "Nueva notificación"}</Dialog.Title>
            </Dialog.Header>

            <Dialog.Body>
              <VStack gap="4" align="stretch">
                <Box>
                  <Text as="label" htmlFor="title" fontWeight="semibold" mb="1" display="block">Título *</Text>
                  <Input id="title" ref={firstFieldRef} value={title} onChange={(e) => setTitle(e.target.value)} />
                </Box>

                <Box>
                  <Text as="label" htmlFor="body" fontWeight="semibold" mb="1" display="block">Cuerpo *</Text>
                  <Textarea id="body" value={body} onChange={(e) => setBody(e.target.value)} rows={5} />
                </Box>
                <HStack gap="4">
                  <Box flex="1">
                    <Text as="label" htmlFor="aurl" fontWeight="semibold" mb="1" display="block">
                      Acción (URL interna)
                      <Text as="span" color="fg.muted" textStyle="xs" ml="1">opcional</Text>
                    </Text>
                    <Input
                      id="aurl"
                      placeholder="/app/clinic/evaluaciones/123"
                      value={actionUrl}
                      onChange={(e) => setActionUrl(e.target.value)}
                    />
                  </Box>

                  <Box flex="1">
                    <Text as="label" htmlFor="albl" fontWeight="semibold" mb="1" display="block">
                      Texto del botón
                      <Text as="span" color="fg.muted" textStyle="xs" ml="1">opcional</Text>
                    </Text>
                    <Input
                      id="albl"
                      placeholder="Ver evaluación"
                      value={actionLabel}
                      onChange={(e) => setActionLabel(e.target.value)}
                    />
                  </Box>
                </HStack>

                <HStack gap="4" align="start">
                  <Box flex="1">
                    <Text as="label" htmlFor="kind" fontWeight="semibold" mb="1" display="block">Tipo</Text>
                     <select
                        id="kind"
                        value={kind}
                        onChange={(e) => setKind(e.target.value)}
                        style={{ width: "100%", padding: "8px", borderRadius: 6, border: "1px solid var(--chakra-colors-border)" }}
                        >
                        {KINDS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
                      </select>
                  </Box>
                  <Box flex="1">
                    <Text as="label" htmlFor="aud" fontWeight="semibold" mb="1" display="block">Audiencia</Text>
                    <select
                        id="aud"
                        value={audience}
                        onChange={(e) => setAudience(e.target.value)}
                        style={{ width: "100%", padding: "8px", borderRadius: 6, border: "1px solid var(--chakra-colors-border)" }}
                        >
                        {AUDIENCES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                    </select>
                  </Box>
                </HStack>

                <Box>
                  <Text as="label" htmlFor="aval" fontWeight="semibold" mb="1" display="block">
                    Valores de audiencia (CSV o JSON) <Text as="span" color="fg.muted" textStyle="xs">(opcional)</Text>
                  </Text>
                  <Input
                    id="aval"
                    placeholder='Ej: ["<guid-org-1>","<guid-org-2>"] / 101,102 / admin,clinician'
                    value={audienceValue}
                    onChange={(e) => setAudienceValue(e.target.value)}
                  />
                </Box>

                <HStack gap="4">
                  <Box flex="1">
                    <Text as="label" htmlFor="pub" fontWeight="semibold" mb="1" display="block">Publicada en</Text>
                    <Input id="pub" type="datetime-local" value={publishedAtUtc} onChange={(e) => setPublishedAtUtc(e.target.value)} />
                  </Box>
                  <Box flex="1">
                    <Text as="label" htmlFor="exp" fontWeight="semibold" mb="1" display="block">Expira en</Text>
                    <Input id="exp" type="datetime-local" value={expiresAtUtc} onChange={(e) => setExpiresAtUtc(e.target.value)} />
                  </Box>
                </HStack>
              </VStack>
            </Dialog.Body>

            <Dialog.Footer>
              <HStack gap="2" flexWrap="wrap" w="full" justify="space-between">
                {isEdit ? (
                  <HStack gap="2">
                    <Button variant="outline" onClick={() => quickAction(() => AdminNotificationsApi.publishNow(initialValues.id), "Publicada ahora")} loading={saving}>
                      Publicar ahora
                    </Button>
                    <Button variant="outline" onClick={() => quickAction(() => AdminNotificationsApi.unpublish(initialValues.id), "Despublicada")} loading={saving}>
                      Despublicar
                    </Button>
                    <Button colorPalette="red" variant="outline" onClick={() => quickAction(() => AdminNotificationsApi.expireNow(initialValues.id), "Expirada ahora")} loading={saving}>
                      Expirar ya
                    </Button>
                  </HStack>
                ) : <Box />}

                <HStack>
                  <Button variant="ghost" onClick={onClose}>Cancelar</Button>
                  <Button colorPalette="blue" onClick={handleSave} loading={saving}>{isEdit ? "Guardar" : "Crear"}</Button>
                </HStack>
              </HStack>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}
