// src/app/profile/ProfilePage.jsx
import { useEffect, useRef, useState, useMemo } from "react"
import {
  Box, Stack, Heading, Text, Card, Avatar, Badge,
  Button, HStack, Spinner, Checkbox, Grid, GridItem, Field, Input
} from "@chakra-ui/react"
import { ProfileApi } from "../../api/profileApi"
import { DisciplinesApi } from "../../api/disciplinesApi"
import { toaster } from "../../components/ui/toaster"
import client, { apiOrigin } from "../../api/client"
import UserSettings from "./UserSettings"
import SignaturePad from "../../components/SignaturePad"

// ========= Helpers de identidad/cache por usuario =========
function absolutizeApiUrl(url) {
  if (!url) return ""
  if (/^https?:\/\//i.test(url)) return url
  const origin = apiOrigin()
  return origin ? origin + (url.startsWith("/") ? "" : "/") + url : url
}

function decodeJwtPayload() {
  try {
    const keys = ["authToken", "token"];
    let raw = null;
    for (const k of keys) {
      raw = localStorage.getItem(k) || sessionStorage.getItem(k);
      if (raw) break;
    }
    if (!raw) return {};
    const token = raw.startsWith("Bearer ") ? raw.slice(7) : raw;
    const [, payload] = token.split(".");
    if (!payload) return {};
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json);
  } catch { return {}; }
}

function deriveUid() {
  const p = decodeJwtPayload();
  const id =
    p["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"];
  return id.toString().toLowerCase();
}

function getUidFromMe(me) {
  return (
    me?.email ||
    me?.raw?.email ||
    me?.raw?.sub ||
    me?.raw?.nameidentifier ||
    me?.id ||
    me?.userId ||
    me?.raw?.preferred_username ||
    null
  )
}

function deriveDisplay(me) {
  if (!me) return { name: "Usuario", email: "", initials: "U", role: "", avatarUrl: "", signatureImageUrl: "" }

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
  const signatureImageUrl = absolutizeApiUrl(me.signatureImageUrl)

  return { name, email, initials, role, avatarUrl, signatureImageUrl }
}


function persistProfileCache(meLike) {
  const uid = getUidFromMe(meLike)
  if (!uid) return

  const { name, email, avatarUrl } = deriveDisplay(meLike)

  try {
    localStorage.setItem(
      `ep:profile:${uid}`,
      JSON.stringify({ name, email, avatarUrl })
    )
    if (avatarUrl) {
      localStorage.setItem(`ep:avatarUrl:${uid}`, avatarUrl)
    } else {
      localStorage.removeItem(`ep:avatarUrl:${uid}`)
    }
    localStorage.removeItem("ep:avatarUrl")
  } catch {}
  try { window.dispatchEvent(new Event("ep:profile-updated")) } catch {}
}



export default function ProfilePage() {
  // ===== Perfil / avatar =====
  const [me, setMe] = useState(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef(null)
  const { name, email, initials, role, avatarUrl, signatureImageUrl: displaySignatureUrl } = deriveDisplay(me)
  const [firstName, setFirstName] = useState("")
  const [lastName1, setLastName1] = useState("")
  const [lastName2, setLastName2] = useState("")
  const [phone, setPhone] = useState("")
  const [titlePrefix, setTitlePrefix] = useState("")
  const [licenseNumber, setLicenseNumber] = useState("")
  const [signatureImageUrl, setSignatureImageUrl] = useState("")
  // URL local (blob:) que sí puede usar <Avatar.Image>
  const [avatarImageUrl, setAvatarImageUrl] = useState("")
  const [loadingAvatarImage, setLoadingAvatarImage] = useState(false)

  // ===== Firma profesional =====
  const [signatureImageDataUrl, setSignatureImageDataUrl] = useState("")
  const [loadingSignatureImage, setLoadingSignatureImage] = useState(false)
  const [savingSignature, setSavingSignature] = useState(false)
  const [signaturePadDataUrl, setSignaturePadDataUrl] = useState("")

  // ===== Disciplinas del profesional =====
  const [discLoading, setDiscLoading] = useState(true)
  const [allDisciplines, setAllDisciplines] = useState([])
  const [myDisciplineIds, setMyDisciplineIds] = useState(new Set())
  const [savingDisc, setSavingDisc] = useState(false)
  const [saving, setSaving] = useState(false)

  async function loadMe() {
    setLoading(true)
    try {
      const data = await ProfileApi.getMe()
      const abs = absolutizeApiUrl(data?.avatarUrl)
      const absSignature = absolutizeApiUrl(data?.signatureImageUrl)
      const merged = { ...data, avatarUrl: abs, signatureImageUrl: absSignature }
      setMe(merged)
      setFirstName(merged.firstName || "")
      setLastName1(merged.lastName1 || "")
      setLastName2(merged.lastName2 || "")
      setPhone(merged.phone || "")
      setTitlePrefix(merged.titlePrefix || "")
      setLicenseNumber(merged.licenseNumber || "")
      setSignatureImageUrl(merged.signatureImageUrl || "")
      persistProfileCache(merged)
    } catch (e) {
      toaster.error({ title: "No se pudo cargar el perfil", description: e?.message || "Error" })
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    try {
      setSaving(true)
      const updated = await ProfileApi.updateProfile({
        firstName,
        lastName1,
        lastName2,
        phone,
        titlePrefix,
        licenseNumber,
      })
      setMe(updated)
      // refrescar valores (por si backend normaliza)
      setFirstName(updated.firstName || "")
      setLastName1(updated.lastName1 || "")
      setLastName2(updated.lastName2 || "")
      setPhone(updated.phone || "")
      setTitlePrefix(updated.titlePrefix || "")
      setLicenseNumber(updated.licenseNumber || "")
      setSignatureImageUrl(updated.signatureImageUrl || "")

      toaster.success({ title: "Perfil actualizado" })
    } catch (err) {
      toaster.error({ title: "No se pudieron guardar los cambios" })
    } finally {
      setSaving(false)
    }
  }


  async function loadDisciplines() {
    setDiscLoading(true)
    try {
      const discPaged = await DisciplinesApi.list({ page: 1, pageSize: 1000 })
      const items = discPaged?.items || []
      setAllDisciplines(items)
      const mine = await ProfileApi.getMyDisciplines()
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

 useEffect(() => {
  setAvatarImageUrl("")

  if (!avatarUrl) return

  const uid = deriveUid()
  const cacheKey = `ep:avatarUrl:${uid}`

  async function fetchAvatar() {
    const cached = localStorage.getItem(cacheKey)
    if (cached) {
      setAvatarImageUrl(cached)
      setLoadingAvatarImage(false)
      return
    }

    try {
      setLoadingAvatarImage(true)
      const res = await client.get(avatarUrl, { responseType: "blob" })

      const reader = new FileReader()
      reader.readAsDataURL(res.data)

      reader.onloadend = function () {
        const base64data = reader.result
        try {
          localStorage.setItem(cacheKey, base64data)
        } catch {}
        setAvatarImageUrl(base64data)
        try { window.dispatchEvent(new Event("ep:profile-updated")) } catch {}
      }
    } catch (err) {
      console.error("Error cargando avatar:", err)
    } finally {
      setLoadingAvatarImage(false)
    }
  }

  fetchAvatar()
}, [avatarUrl])

  // ===== Firma profesional: fetch + cache local =====
  useEffect(() => {
  const uid = deriveUid()
  const cacheKey = uid ? `ep:signatureUrl:${uid}` : null
  // Si todavía no tenemos URL de firma o no tenemos UID, no hacemos nada.
  // Importante: NO tocamos localStorage aquí.
  if (!displaySignatureUrl || !cacheKey) {
    setLoadingSignatureImage(false)
    return
  }

  // Intentar leer desde cache
  const cached = (() => {
    try {
      return localStorage.getItem(cacheKey)
    } catch {
      return null
    }
  })()

  if (cached) {
    setSignatureImageDataUrl(cached)
    setLoadingSignatureImage(false)
    return
  }
  let alive = true

  async function fetchSignature() {
    try {
      setLoadingSignatureImage(true)
      const res = await client.get(displaySignatureUrl, { responseType: "blob" })

      if (!alive) return

      const reader = new FileReader()
      reader.readAsDataURL(res.data)
      reader.onloadend = function () {
        if (!alive) return
        const base64data = reader.result

        if (cacheKey) {
          try {
            localStorage.setItem(cacheKey, base64data)
          } catch (err) {
            console.warn("No se pudo guardar la firma en localStorage", err)
          }
        }

        setSignatureImageDataUrl(base64data)
      }
    } catch (err) {
      console.error("Error cargando firma profesional:", err)
    } finally {
      if (alive) setLoadingSignatureImage(false)
    }
  }

  fetchSignature()

  return () => {
    alive = false
  }
}, [displaySignatureUrl])


    async function onSaveSignature() {
    if (!signaturePadDataUrl) {
      toaster.error({
        title: "No hay firma",
        description: "Dibuja tu firma en el recuadro antes de guardar.",
      })
      return
    }

    try {
      setSavingSignature(true)
      const updated = await ProfileApi.uploadSignature(signaturePadDataUrl)
      const absAvatar = absolutizeApiUrl(updated?.avatarUrl)
      const absSignature = absolutizeApiUrl(updated?.signatureImageUrl)
      const merged = { ...me, ...updated, avatarUrl: absAvatar, signatureImageUrl: absSignature }
      setMe(merged)
      persistProfileCache(merged)

      const uid = deriveUid()
      if (uid) {
        try { localStorage.removeItem(`ep:signatureUrl:${uid}`) } catch {}
      }

      setSignaturePadDataUrl("")
      toaster.success({
        title: "Firma actualizada",
        description: "Tu firma profesional se guardó correctamente.",
      })
    } catch (e) {
      const msg = e?.response?.data || e?.message || "Error"
      toaster.error({
        title: "No se pudo guardar la firma",
        description: msg,
      })
    } finally {
      setSavingSignature(false)
    }
  }

  async function onDeleteSignature() {
    try {
      setSavingSignature(true)
      await ProfileApi.deleteSignature()

      const merged = me ? { ...me, signatureImageUrl: null } : me
      setMe(merged)

      const uid = deriveUid()
      if (uid) {
        try { localStorage.removeItem(`ep:signatureUrl:${uid}`) } catch {}
      }
      setSignatureImageDataUrl("")

      toaster.success({
        title: "Firma eliminada",
        description: "Se quitó tu firma profesional.",
      })
    } catch (e) {
      const msg = e?.response?.data || e?.message || "Error"
      toaster.error({
        title: "No se pudo eliminar la firma",
        description: msg,
      })
    } finally {
      setSavingSignature(false)
    }
  }


  async function onPickFile(e) {
    const file = e.target.files?.[0]
    if (!file) return

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
      const updated = await ProfileApi.uploadAvatar(file)
      const abs = absolutizeApiUrl(updated?.avatarUrl)
      const merged = { ...me, ...updated, avatarUrl: abs }
      setMe(merged)
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
      setLoading(true)
      await ProfileApi.deleteAvatar()
      const merged = me ? { ...me, avatarUrl: null } : me
      setMe(merged)
      persistProfileCache(merged)
      localStorage.removeItem(`ep:avatarUrl:${deriveUid()}`)
      try { window.dispatchEvent(new Event("ep:profile-updated")) } catch {}
      toaster.success({ title: "Avatar eliminado", description: "Se quitó tu foto de perfil" })
    } catch (e) {
      const msg = e?.response?.data || e?.message || "Error"
      toaster.error({ title: "No se pudo eliminar", description: msg })
    }
    finally{setLoading(false)}
  }

  const selectedCount = useMemo(() => myDisciplineIds.size, [myDisciplineIds])
  return (
    <Box>
      <Heading size="md" mb="4">Mi perfil</Heading>

      {/* ===== Card: Datos + Avatar ===== */}
      <Card.Root size="lg" p="6" mb="6">
        {loading || loadingAvatarImage ? (
          <HStack color="fg.muted"><Spinner /><Text>Cargando…</Text></HStack>
        ) : (
          <>
            <HStack align="center" gap="4" flexWrap="wrap">
              <Avatar.Root size="2xl">
              {avatarImageUrl ? (
                <Avatar.Image src={avatarImageUrl} alt="Avatar" />
              ) : null}
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

      <Card.Root p="4">
  <Card.Header pb="3">
    <Card.Title>Perfil profesional</Card.Title>
    <Card.Description>
      Estos datos se utilizarán en reportes, consentimientos y firmas.
    </Card.Description>
  </Card.Header>

  <Card.Body>
    <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap="4">
      <GridItem>
        <Field.Root>
          <Field.Label>Nombre</Field.Label>
          <Input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="Ana"
          />
        </Field.Root>
      </GridItem>

      <GridItem>
        <Field.Root>
          <Field.Label>Primer apellido</Field.Label>
          <Input
            value={lastName1}
            onChange={(e) => setLastName1(e.target.value)}
            placeholder="Mora"
          />
        </Field.Root>
      </GridItem>

      <GridItem>
        <Field.Root>
          <Field.Label>Segundo apellido</Field.Label>
          <Input
            value={lastName2}
            onChange={(e) => setLastName2(e.target.value)}
            placeholder="García"
          />
        </Field.Root>
      </GridItem>

      <GridItem>
        <Field.Root>
          <Field.Label>Prefijo / título</Field.Label>
          <Input
            value={titlePrefix}
            onChange={(e) => setTitlePrefix(e.target.value)}
            placeholder="Dra., Lic., M.Sc., etc."
          />
        </Field.Root>
      </GridItem>

      <GridItem>
        <Field.Root>
          <Field.Label>Teléfono</Field.Label>
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+506 ..."
          />
        </Field.Root>
      </GridItem>

      <GridItem>
        <Field.Root>
          <Field.Label>Número de licencia / colegiado</Field.Label>
          <Input
            value={licenseNumber}
            onChange={(e) => setLicenseNumber(e.target.value)}
            placeholder="Colegiado N° ..."
          />
        </Field.Root>
      </GridItem>
    </Grid>
  </Card.Body>

  <Card.Footer justify="flex-end">
    <Button
       onClick={handleSave}
       isLoading={saving}
       disabled={saving}
      loadingText="Guardando..."
    >
      Guardar cambios
    </Button>
  </Card.Footer>
</Card.Root>
      {/* ===== Card: Firma profesional ===== */}
      <Card.Root size="lg" p="6" mb="6">
        <Stack
          direction={{ base: "column", md: "row" }}
          gap="6"
          align="flex-start"
        >
          <Box flex="1">
            <Heading size="sm" mb="2">Firma profesional</Heading>
            <Text color="fg.muted" fontSize="sm" mb="4">
              Esta firma se usará en documentos profesionales (por ejemplo, informes
              o certificados). Se almacena de forma segura y sólo tú puedes
              modificarla.
            </Text>

            {signatureImageDataUrl ? (
              <Box
                as="img"
                src={signatureImageDataUrl}
                alt="Firma profesional"
                borderWidth="1px"
                borderRadius="md"
                bg="white"
                maxH="120px"
                mb="3"
              />
            ) : (
              <Text color="fg.muted" fontSize="sm" mb="3">
                Aún no has registrado una firma profesional.
              </Text>
            )}

            {loadingSignatureImage && (
              <HStack color="fg.muted" mb="3">
                <Spinner size="xs" />
                <Text fontSize="xs">Cargando firma…</Text>
              </HStack>
            )}

            <Text fontSize="xs" color="fg.muted">
              Consejo: firma con mouse, lápiz o dedo en el recuadro de la derecha.
            </Text>
          </Box>

          <Box flex="1" minW="260px">
            <Heading size="xs" mb="2">Capturar nueva firma</Heading>
            <Text fontSize="xs" color="fg.muted" mb="2">
              Al guardar, se reemplazará cualquier firma anterior.
            </Text>

            <Box borderWidth="1px" borderRadius="md" p="2" bg="bg.canvas" mb="3">
              <SignaturePad onChange={(dataUrl) => setSignaturePadDataUrl(dataUrl || "")} />
            </Box>

            <HStack gap="2">
              <Button
                size="sm"
                onClick={onSaveSignature}
                isLoading={savingSignature}
                isDisabled={!signaturePadDataUrl || savingSignature}
                colorPalette="brand"
              >
                Guardar firma
              </Button>
              {displaySignatureUrl && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onDeleteSignature}
                  disabled={savingSignature}
                >
                  Quitar firma
                </Button>
              )}
            </HStack>
          </Box>
        </Stack>
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
