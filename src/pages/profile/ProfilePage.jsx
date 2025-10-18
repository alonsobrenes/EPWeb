// src/app/profile/ProfilePage.jsx
import { useEffect, useRef, useState, useMemo } from "react"
import {
  Box, Stack, Heading, Text, Card, Avatar, Badge,
  Button, HStack, Spinner, Checkbox
} from "@chakra-ui/react"
import { ProfileApi } from "../../api/profileApi"
import { DisciplinesApi } from "../../api/disciplinesApi"
import { toaster } from "../../components/ui/toaster"
import { apiOrigin } from "../../api/client"
// BEGIN CHANGE: nuevo componente con la configuración de etiquetas
import UserSettings from "./UserSettings"
// END CHANGE

// ========= Helpers de identidad/cache por usuario =========
function getUidFromMe(me) {
  return (
    me?.email ||
    me?.raw?.email ||
    me?.raw?.sub ||
    me?.raw?.nameidentifier || // WS-Fed / SAML
    me?.id ||
    me?.userId ||
    me?.raw?.preferred_username ||
    null
  )
}

function persistProfileCache(meLike) {
  const uid = getUidFromMe(meLike)
  if (!uid) return

  // Derivamos nombre/email/avatar absolutos (mismo criterio del componente)
  const { name, email, avatarUrl } = deriveDisplay(meLike)

  try {
    // Guardamos el perfil por-usuario
    localStorage.setItem(
      `ep:profile:${uid}`,
      JSON.stringify({ name, email, avatarUrl })
    )
    if (avatarUrl) {
      localStorage.setItem(`ep:avatarUrl:${uid}`, avatarUrl)
    } else {
      localStorage.removeItem(`ep:avatarUrl:${uid}`)
    }

    // Limpieza de la clave GLOBAL antigua para evitar “heredar” avatar entre logins
    localStorage.removeItem("ep:avatarUrl")
  } catch {}
  // Notificar al shell para que refresque
  try { window.dispatchEvent(new Event("ep:profile-updated")) } catch {}
}

// Convierte una URL relativa del API ("/uploads/...") a absoluta
function absolutizeApiUrl(url) {
  if (!url) return ""
  if (/^https?:\/\//i.test(url)) return url
  const origin = apiOrigin()
  return origin ? origin + (url.startsWith("/") ? "" : "/") + url : url
}

function deriveDisplay(me) {
  if (!me) return { name: "Usuario", email: "", initials: "U", role: "", avatarUrl: "" }

  const name =
    me.name ||
    me.raw?.name ||
    me.raw?.given_name ||
    me.raw?.preferred_username ||
    (me.email ? me.email.split("@")[0] : "Usuario")

  const email = me.email || me.raw?.email || ""
  const initials =
    (name || "")
      .split(/\s+/)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase())
      .join("") || "U"

  const role = (me.role || (me.roles && me.roles[0]) || "").toString()
  const avatarUrl = absolutizeApiUrl(me.avatarUrl)

  return { name, email, initials, role, avatarUrl }
}

export default function ProfilePage() {
  // ===== Perfil / avatar =====
  const [me, setMe] = useState(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef(null)

  // ===== Disciplinas del profesional =====
  const [discLoading, setDiscLoading] = useState(true)
  const [allDisciplines, setAllDisciplines] = useState([])          // [{ id, code, name, ... }]
  const [myDisciplineIds, setMyDisciplineIds] = useState(new Set()) // Set<number>
  const [savingDisc, setSavingDisc] = useState(false)

  async function loadMe() {
    setLoading(true)
    try {
      const data = await ProfileApi.getMe() // { id, email, role, createdAt, avatarUrl, ...? }
      // Normalizamos avatar a absoluto para el estado local
      const abs = absolutizeApiUrl(data?.avatarUrl)
      const merged = { ...data, avatarUrl: abs }
      setMe(merged)

      // >>> Persistimos perfil por-usuario y limpiamos clave global
      persistProfileCache(merged)
    } catch (e) {
      toaster.error({ title: "No se pudo cargar el perfil", description: e?.message || "Error" })
    } finally {
      setLoading(false)
    }
  }

  async function loadDisciplines() {
    setDiscLoading(true)
    try {
      const discPaged = await DisciplinesApi.list({ page: 1, pageSize: 1000 })
      const items = discPaged?.items || []
      setAllDisciplines(items)
      const mine = await ProfileApi.getMyDisciplines() // { items: [{ id, code, name }] }
      const mineItems = Array.isArray(mine) ? mine : (mine?.items || [])
      const ids = new Set(mineItems.map(d => d.id))
      setMyDisciplineIds(ids)
    } catch (e) {
      toaster.error({ title: "No se pudieron cargar disciplinas", description: e?.message || "Error" })
    } finally {
      setDiscLoading(false)
    }
  }

  useEffect(() => {
    loadMe()
    loadDisciplines()
  }, [])

  const { name, email, initials, role, avatarUrl } = deriveDisplay(me)

  async function onPickFile(e) {
    const file = e.target.files?.[0]
    if (!file) return

    // Validaciones
    if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) {
      toaster.error({ title: "Formato no soportado", description: "Usa JPG, PNG o WEBP" })
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toaster.error({ title: "Archivo muy grande", description: "Máximo 5MB" })
      return
    }

    try {
      setUploading(true)
      const updated = await ProfileApi.uploadAvatar(file) // UserProfileDto
      const abs = absolutizeApiUrl(updated?.avatarUrl)
      const merged = { ...me, ...updated, avatarUrl: abs }
      setMe(merged)

      // >>> Persistimos cache por-usuario (avatar y perfil)
      persistProfileCache(merged)

      toaster.success({ title: "Avatar actualizado", description: "Tu foto se guardó correctamente" })
    } catch (e) {
      const msg = e?.response?.data || e?.message || "Error"
      toaster.error({ title: "No se pudo subir", description: msg })
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  async function onDeleteAvatar() {
    try {
      await ProfileApi.deleteAvatar()
      const merged = me ? { ...me, avatarUrl: null } : me
      setMe(merged)

      // >>> Actualizamos cache por-usuario y limpiamos avatar
      persistProfileCache(merged)

      toaster.success({ title: "Avatar eliminado", description: "Se quitó tu foto de perfil" })
    } catch (e) {
      const msg = e?.response?.data || e?.message || "Error"
      toaster.error({ title: "No se pudo eliminar", description: msg })
    }
  }

  // ===== Toggle controlado para Checkbox v3 (sin onCheckedChange)
  const selectedCount = useMemo(() => myDisciplineIds.size, [myDisciplineIds])

  return (
    <Box>
      <Heading size="md" mb="4">Mi perfil</Heading>

      {/* ===== Card: Datos + Avatar ===== */}
      <Card.Root size="lg" p="6" mb="6">
        {loading ? (
          <HStack color="fg.muted"><Spinner /><Text>Cargando…</Text></HStack>
        ) : (
          <>
            <HStack align="center" gap="4" flexWrap="wrap">
              <Avatar.Root size="lg">
                {avatarUrl ? <Avatar.Image src={avatarUrl} alt="Avatar" /> : null}
                <Avatar.Fallback>{initials}</Avatar.Fallback>
              </Avatar.Root>

              <Stack gap="1" minW="220px">
                <HStack gap="2" align="center">
                  <Heading size="md" noOfLines={1}>{name}</Heading>
                  {role && <Badge variant="subtle">{role}</Badge>}
                </HStack>
                {email && <Text color="fg.muted">{email}</Text>}
              </Stack>

              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                onChange={onPickFile}
              />
              <HStack gap="2">
                <Button onClick={() => fileRef.current?.click()} isLoading={uploading} colorPalette="brand">
                  Subir foto
                </Button>
                {avatarUrl && (
                  <Button variant="outline" onClick={onDeleteAvatar} disabled={uploading}>
                    Quitar foto
                  </Button>
                )}
              </HStack>
            </HStack>
          </>
        )}
      </Card.Root>

      {/* ===== Card: Áreas de práctica (Disciplinas) ===== */}
      <Card.Root p="6">
        <HStack justify="space-between" mb="3" wrap="wrap" gap="2">
          <Heading size="sm">Áreas de práctica (disciplinas)</Heading>
          <HStack gap="2">
            <Badge variant="subtle">{selectedCount} seleccionadas</Badge>
            <Button
              size="sm"
              onClick={async () => {
                setSavingDisc(true)
                try {
                  const ids = Array.from(myDisciplineIds)
                  await ProfileApi.replaceMyDisciplines(ids)
                  toaster.success({ title: "Disciplinas guardadas" })
                } catch (e) {
                  const msg = e?.response?.data || e?.message || "Error"
                  toaster.error({ title: "No se pudieron guardar disciplinas", description: msg })
                } finally {
                  setSavingDisc(false)
                }
              }}
              isLoading={savingDisc}
              colorPalette="brand"
            >
              Guardar
            </Button>
          </HStack>
        </HStack>

        {discLoading ? (
          <HStack color="fg.muted"><Spinner /><Text>Cargando disciplinas…</Text></HStack>
        ) : (
          <>
            {allDisciplines.length === 0 ? (
              <Text color="fg.muted">No hay disciplinas configuradas.</Text>
            ) : (
              <Stack gap="2">
                {allDisciplines.map((d) => {
                  const checked = myDisciplineIds.has(d.id)
                  const toggle = () => {
                    setMyDisciplineIds(prev => {
                      const next = new Set(prev)
                      if (checked) next.delete(d.id)
                      else next.add(d.id)
                      return next
                    })
                  }

                  return (
                    <HStack
                      key={d.id}
                      justify="space-between"
                      borderWidth="1px"
                      rounded="md"
                      p="2"
                    >
                      <Checkbox.Root id={`disc-${d.id}`} checked={checked}>
                        {/* Hacemos todo el renglón clickeable */}
                        <HStack gap="3" cursor="pointer" onClick={toggle}>
                          <Checkbox.Control>
                            <Checkbox.Indicator />
                          </Checkbox.Control>
                          <Checkbox.Label>
                            <Box>
                              <Text fontWeight="semibold">{d.name}</Text>
                              <Text color="fg.muted" fontSize="sm">{d.code}</Text>
                            </Box>
                          </Checkbox.Label>
                        </HStack>
                      </Checkbox.Root>
                    </HStack>
                  )
                })}
              </Stack>
            )}
          </>
        )}
      </Card.Root>
    </Box>
  )
}
