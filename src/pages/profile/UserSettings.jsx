import { useEffect, useRef, useState } from "react"
import {
  Card,
  HStack,
  VStack,
  Text,
  Button,
  Badge,
  Input,
  Box,
} from "@chakra-ui/react"
import { ProfileApi } from "../../api/profileApi"
import OrgSettingsApi from "../../api/orgSettingsApi"
import client from "../../api/client"
import { toaster } from "../../components/ui/toaster"
import {tryGetOrgId} from '../../utils/identity'
import { getRole } from "../../auth/role"

export default function UserSettings() {
  // ===== Logo de la organización =====
  const [logoUrl, setLogoUrl] = useState(null)
  const [logoPreviewUrl, setLogoPreviewUrl] = useState(null)
  const [logoLoading, setLogoLoading] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const logoInputRef = useRef(null)
  const role = getRole()
  const canManageOrgLogo = role !== "viewer"
  useEffect(() => {
  let cancelled = false
  const orgId = tryGetOrgId()
  const cacheKey = `ep:logo:${orgId}`

  // 1) Intentar leer del cache
  const cached = localStorage.getItem(cacheKey)
  if (cached) {
    setLogoPreviewUrl(cached)
    return
  }

  // 2) Si no hay cache, ir al backend
  async function loadLogo() {
      try {
        setLogoLoading(true)

        const res = await OrgSettingsApi.getOrgSettings()
        if (cancelled) return

        const url = res?.logoUrl || null
        setLogoUrl(url)

        if (url) {
          const blobRes = await client.get(url, { responseType: "blob" })
          if (cancelled) return

          const reader = new FileReader()
          reader.readAsDataURL(blobRes.data)
          reader.onloadend = function () {
            const base64 = reader.result
            try {
              localStorage.setItem(cacheKey, base64)
            } catch {}
            if (!cancelled) setLogoPreviewUrl(base64)
          }
        }
      } catch (e) {
        console.error("Error cargando logo:", e)
      } finally {
        if (!cancelled) setLogoLoading(false)
      }
    }

    loadLogo()
    return () => { cancelled = true }
  }, [])


  // Cargar imagen del logo existente (si hay logoUrl y no hay preview aún)
  useEffect(() => {
    if (logoPreviewUrl || !logoUrl) return

    let cancelled = false

    async function loadExistingLogo() {
      try {
        const res = await client.get(logoUrl, { responseType: "blob" })
        if (cancelled) return

        const localUrl = URL.createObjectURL(res.data)
        setLogoPreviewUrl((prev) => {
          if (prev) {
            URL.revokeObjectURL(prev)
          }
          return localUrl
        })
      } catch (err) {
        console.error("Error cargando logo existente:", err)
      }
    }

    loadExistingLogo()
    return () => {
      cancelled = true
    }
  }, [logoUrl, logoPreviewUrl])

  async function handleLogoFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 2 * 1024 * 1024) {
      toaster.error({
        title: "Archivo demasiado grande",
        description: "El tamaño máximo es 2MB.",
      })
      return
    }

    if (!file.type.startsWith("image/")) {
      toaster.error({
        title: "Formato inválido",
        description: "Selecciona una imagen (PNG o JPG).",
      })
      return
    }

    const localUrl = URL.createObjectURL(file)
    setLogoPreviewUrl((prev) => {
      if (prev) {
        URL.revokeObjectURL(prev)
      }
      return localUrl
    })

    const formData = new FormData()
    formData.append("file", file)

    try {
      setUploadingLogo(true)
      const result = await OrgSettingsApi.updateLogo(formData)
      const newLogoUrl = result?.logoUrl ?? null
      setLogoUrl(newLogoUrl)
      const orgId = tryGetOrgId()
      const cacheKey = `ep:logo:${orgId}`
console.log('cacheKey',cacheKey)
      // Convertir file → base64
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onloadend = function () {
        const base64 = reader.result
        try {
          localStorage.setItem(cacheKey, base64)
        } catch {}
        setLogoPreviewUrl(base64)
      }

      toaster.success({ title: "Logo actualizado" })
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || "Error"
      toaster.error({
        title: "No se pudo actualizar el logo",
        description: msg,
      })
    } finally {
      setUploadingLogo(false)
      // Limpia el input de archivo para permitir subir el mismo archivo de nuevo si se desea
      if (logoInputRef.current) {
        logoInputRef.current.value = ""
      }
    }
  }

  // ===== Etiquetas (organización) =====
  const [labels, setLabels] = useState([])
  const [lblLoading, setLblLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({
    code: "",
    name: "",
    colorHex: "#1E88E5",
  })

  async function loadLabels() {
    setLblLoading(true)
    try {
      const data = await ProfileApi.getLabels()
      setLabels(Array.isArray(data?.items) ? data.items : [])
    } catch (e) {
      toaster.error({
        title: "No se pudieron cargar las etiquetas",
        description: e?.message || "Error",
      })
    } finally {
      setLblLoading(false)
    }
  }

  useEffect(() => {
    loadLabels()
  }, [])

  async function onCreateLabel() {
    if (!form.code || !/^[a-z0-9_-]{1,64}$/i.test(form.code)) {
      toaster.error({
        title: "Code inválido",
        description: "Usa slug sin espacios",
      })
      return
    }
    if (!form.name || form.name.length > 128) {
      toaster.error({ title: "Nombre inválido" })
      return
    }
    if (!/^#[0-9A-Fa-f]{6}$/.test(form.colorHex || "")) {
      toaster.error({
        title: "Color inválido (#RRGGBB)",
      })
      return
    }
    try {
      setCreating(true)
      await ProfileApi.createLabel({
        code: form.code.trim().toLowerCase(),
        name: form.name.trim(),
        colorHex: form.colorHex.toUpperCase(),
        isSystem: false,
      })
      setForm({ code: "", name: "", colorHex: "#1E88E5" })
      await loadLabels()
      toaster.success({ title: "Etiqueta creada" })
    } catch (e) {
      toaster.error({
        title: "No se pudo crear",
        description:
          e?.response?.data?.message || e?.message || "Error",
      })
    } finally {
      setCreating(false)
    }
  }

  function startEdit(lbl) {
    setEditingId(lbl.id)
    setForm({
      code: lbl.code,
      name: lbl.name,
      colorHex: lbl.colorHex,
    })
  }

  async function onSaveEdit() {
    if (editingId == null) return
    try {
      await ProfileApi.updateLabel(editingId, {
        name: form.name.trim(),
        colorHex: form.colorHex.toUpperCase(),
      })
      setEditingId(null)
      setForm({ code: "", name: "", colorHex: "#1E88E5" })
      await loadLabels()
      toaster.success({ title: "Etiqueta actualizada" })
    } catch (e) {
      toaster.error({
        title: "No se pudo actualizar",
        description:
          e?.response?.data?.message || e?.message || "Error",
      })
    }
  }

  function cancelEdit() {
    setEditingId(null)
    setForm({ code: "", name: "", colorHex: "#1E88E5" })
  }

  async function onDeleteLabel(id) {
    try {
      await ProfileApi.deleteLabel(id)
      await loadLabels()
      toaster.success({ title: "Etiqueta eliminada" })
    } catch (e) {
      const msg =
        e?.response?.data?.message || e?.message || "Error"
      toaster.error({
        title: "No se pudo eliminar",
        description: msg,
      })
    }
  }

  return (
    <>
      {/* Logo de la organización */}
      {canManageOrgLogo ? (
      <Card.Root p="4" mt="6">
        <HStack justify="space-between" mb="3">
          <Text fontWeight="medium">Logo de la organización</Text>
        </HStack>

        <HStack align="center" gap="4">
          <Box
            borderWidth="1px"
            borderRadius="md"
            w="80px"
            h="80px"
            overflow="hidden"
            bg="bg.muted"
            display="flex"
            alignItems="center"
            justifyContent="center"
          >
            {logoPreviewUrl ? (
              <Box
                as="img"
                src={logoPreviewUrl}
                alt="Logo de la organización"
                maxW="100%"
                maxH="100%"
                objectFit="contain"
              />
            ) : logoLoading ? (
              <Text
                fontSize="xs"
                color="fg.muted"
                textAlign="center"
                px="2"
              >
                Cargando logo…
              </Text>
            ) : logoUrl ? (
              <Text
                fontSize="xs"
                color="fg.muted"
                textAlign="center"
                px="2"
              >
                Logo configurado
              </Text>
            ) : (
              <Text
                fontSize="xs"
                color="fg.muted"
                textAlign="center"
                px="2"
              >
                No hay logo configurado todavía.
              </Text>
            )}
          </Box>

          <VStack align="flex-start" gap="1">
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleLogoFileChange}
            />
            <Button
              size="sm"
              onClick={() => logoInputRef.current?.click()}
              isLoading={uploadingLogo}
              colorPalette="blue"
            >
              Seleccionar imagen…
            </Button>
            {logoUrl && (
              <Text fontSize="xs" color="fg.muted">
                Ya hay un logo configurado. Al subir uno nuevo, lo
                reemplazarás.
              </Text>
            )}
            <Text fontSize="xs" color="fg.muted">
              Formatos recomendados: PNG o JPG, máximo 2MB.
            </Text>
          </VStack>
        </HStack>
      </Card.Root>
      ) : null}
      {/* Etiquetas (organización) */}
      <Card.Root p="4" mt="6">
        <HStack justify="space-between" mb="2">
          <Text fontWeight="medium">Etiquetas (organización)</Text>
          <Button
            size="sm"
            onClick={loadLabels}
            isLoading={lblLoading}
          >
            Refrescar
          </Button>
        </HStack>

        {/* Formulario crear / editar */}
        <VStack align="stretch" gap="2" mb="3">
          <HStack>
            <Input
              placeholder="code (slug)"
              value={form.code}
              isDisabled={editingId !== null}
              onChange={(e) =>
                setForm((f) => ({ ...f, code: e.target.value }))
              }
            />
            <Input
              placeholder="Nombre"
              value={form.name}
              onChange={(e) =>
                setForm((f) => ({ ...f, name: e.target.value }))
              }
            />
            <Input
              type="color"
              value={form.colorHex || "#000000"}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  colorHex: e.target.value.toUpperCase(),
                }))
              }
              width="60px"
              p="0"
              border="none"
              cursor="pointer"
              aria-label="Elegir color"
            />
            {editingId === null ? (
              <Button onClick={onCreateLabel} isLoading={creating}>
                Crear
              </Button>
            ) : (
              <>
                <Button onClick={onSaveEdit}>Guardar</Button>
                <Button variant="outline" onClick={cancelEdit}>
                  Cancelar
                </Button>
              </>
            )}
          </HStack>
        </VStack>

        {/* Lista */}
        {labels.map((lbl) => (
          <HStack
            key={lbl.id}
            justify="space-between"
            borderWidth="1px"
            borderRadius="md"
            p="2"
          >
            <HStack>
              <div
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 4,
                  background: lbl.colorHex,
                  border: "1px solid #ddd",
                }}
              />
              <Text>
                <b>{lbl.code}</b> — {lbl.name}
              </Text>
              {lbl.isSystem && <Badge>system</Badge>}
            </HStack>

            {lbl.isSystem ? null : (
              <HStack>
                <Button
                  size="xs"
                  onClick={() => startEdit(lbl)}
                >
                  Editar
                </Button>
                <Button
                  size="xs"
                  variant="outline"
                  colorScheme="red"
                  onClick={() => onDeleteLabel(lbl.id)}
                >
                  Eliminar
                </Button>
              </HStack>
            )}
          </HStack>
        ))}
      </Card.Root>
    </>
  )
}
