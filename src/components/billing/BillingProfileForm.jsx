// src/components/billing/BillingProfileForm.jsx
import { useEffect, useState, useMemo, useRef } from "react"
import { Box, Button, Field, HStack, Input, Text, VStack } from "@chakra-ui/react"
import { toaster } from "../ui/toaster"
import BillingApi from "../../api/billingApi"
import { getCurrentOrgSummary } from "../../api/orgsApi"
import { countriesIso2, flagEmojiFromISO2 } from "../../data/countriesIso2"
import client from "../../api/client"

const emptyAddress = { line1: "", line2: "", city: "", stateRegion: "", postalCode: "", countryIso2: "" }

export default function BillingProfileForm() {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [orgSummary, setOrgSummary] = useState(null) // { planCode, status, seats, kind }

  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [logoPreviewUrl, setLogoPreviewUrl] = useState(null)
  const logoInputRef = useRef(null)

  // Datos persistidos en backend (se mantiene el contrato existente)
  const [data, setData] = useState({
    legalName: "",
    tradeName: "",
    taxId: "",
    contactEmail: "",
    contactPhone: "",
    website: "",
    billingAddress: { ...emptyAddress },
    shippingAddress: null,
    logoUrl: null,
  })

  // ------------------------------------------------------------------
  // Cargar resumen de la organización (para saber si es 'solo' o 'clinic/hospital')
  // ------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false
    async function loadSummary() {
      try {
        const res = await getCurrentOrgSummary()
        if (!cancelled) setOrgSummary(res ?? null)
      } catch {
        // Si falla, no bloqueamos el form; actuamos como 'clinic' por defecto
        if (!cancelled) setOrgSummary(null)
      }
    }
    loadSummary()
    return () => { cancelled = true }
  }, [])

  const isSolo = useMemo(() => {
    const k = orgSummary?.kind?.toLowerCase?.()
    if (k === "solo") return true
    // fallback: si el BE algún día no manda kind pero manda seats
    if (typeof orgSummary?.seats === "number" && orgSummary.seats <= 1) return true
    return false
  }, [orgSummary])

  // Etiquetas adaptativas sin romper el payload
  const labels = useMemo(() => {
    if (isSolo) {
      return {
        title: "Perfil de Facturación (Individual)",
        legalName: "Nombre completo (para factura) *",
        tradeName: null, // oculto en solo
        taxId: "Identificación (cédula/DIMEX/pasaporte) *",
        website: null, // puedes mostrarlo si lo deseas; lo ocultamos por simplicidad
        contactEmail: "Email de facturación *",
        contactPhone: "Teléfono de facturación",
        billingTitle: "Dirección de facturación *",
        logoTitle: "Logo (opcional)",
      }
    }
    return {
      title: "Perfil de Facturación (Organización)",
      legalName: "Razón social / Legal Name *",
      tradeName: "Nombre comercial",
      taxId: "Identificación fiscal / Tax ID *",
      website: "Sitio web",
      contactEmail: "Email de contacto *",
      contactPhone: "Teléfono de contacto",
      billingTitle: "Dirección de facturación *",
      logoTitle: "Logo de la organización",
    }
  }, [isSolo])

  // ------------------------------------------------------------------
  // Cargar perfil desde backend
  // ------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const res = await BillingApi.getBillingProfile() // devuelve null si 404 (ya manejado en BillingApi)
        if (!cancelled && res) {
          setData({
            legalName: res.legalName ?? "",
            tradeName: res.tradeName ?? "",
            taxId: res.taxId ?? "",
            contactEmail: res.contactEmail ?? "",
            contactPhone: res.contactPhone ?? "",
            website: res.website ?? "",
            billingAddress: { ...emptyAddress, ...(res.billingAddress ?? {}) },
            shippingAddress: res.shippingAddress ?? null,
            logoUrl: res.logoUrl ?? null,
          })
        }
      } catch (e) {
        toaster.error({ title: "No se pudo cargar el perfil de facturación" })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  function setAddr(part, field, value) {
    setData(prev => ({ ...prev, [part]: { ...(prev[part] ?? emptyAddress), [field]: value } }))
  }

  // ------------------------------------------------------------------
  // Guardar (manteniendo contrato actual del backend)
  // ------------------------------------------------------------------
  async function save() {
    // Validaciones mínimas (no rompemos lo que ya tenías)
    if (!data.legalName?.trim()) { toaster.error({ title: isSolo ? "Nombre completo requerido" : "Razón social requerida" }); return }
    if (!data.contactEmail?.trim()) { toaster.error({ title: "Email de facturación requerido" }); return }
    if (!data.taxId?.trim()) { toaster.error({ title: isSolo ? "Identificación requerida" : "Identificación fiscal requerida" }); return }
    const a = data.billingAddress
    if (!a?.line1?.trim() || !a?.city?.trim() || !a?.postalCode?.trim() || !a?.countryIso2?.trim()) {
      toaster.error({ title: "Dirección de facturación incompleta" }); return
    }

    setSaving(true)
    try {
      await BillingApi.updateBillingProfile(data)
      toaster.success({ title: "Perfil guardado" })
    } catch {
      toaster.error({ title: "No se pudo guardar el perfil" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Box borderWidth="1px" borderRadius="xl" p="6" bg="bg">
      <VStack align="stretch" gap="5" opacity={loading ? 0.6 : 1}>
        {/* Título adaptativo */}
        <Text fontSize="lg" fontWeight="semibold">
          {labels.title}
        </Text>

        {/* legalName y tradeName (tradeName se oculta en SOLO) */}
        <HStack gap="4">
          <Field.Root>
            <Field.Label>{labels.legalName}</Field.Label>
            <Input
              value={data.legalName}
              onChange={e => setData({ ...data, legalName: e.target.value })}
            />
          </Field.Root>

          {!isSolo && (
            <Field.Root>
              <Field.Label>{labels.tradeName}</Field.Label>
              <Input
                value={data.tradeName}
                onChange={e => setData({ ...data, tradeName: e.target.value })}
              />
            </Field.Root>
          )}
        </HStack>

        {/* taxId y website (website oculto en SOLO) */}
        <HStack gap="4">
          <Field.Root>
            <Field.Label>{labels.taxId}</Field.Label>
            <Input
              value={data.taxId}
              onChange={e => setData({ ...data, taxId: e.target.value })}
            />
          </Field.Root>

          {!isSolo && (
            <Field.Root>
              <Field.Label>{labels.website}</Field.Label>
              <Input
                value={data.website}
                onChange={e => setData({ ...data, website: e.target.value })}
              />
            </Field.Root>
          )}
        </HStack>

        {/* contacto */}
        <HStack gap="4">
          <Field.Root>
            <Field.Label>{labels.contactEmail}</Field.Label>
            <Input
              type="email"
              value={data.contactEmail}
              onChange={e => setData({ ...data, contactEmail: e.target.value })}
            />
          </Field.Root>
          <Field.Root>
            <Field.Label>{labels.contactPhone}</Field.Label>
            <Input
              value={data.contactPhone}
              onChange={e => setData({ ...data, contactPhone: e.target.value })}
            />
          </Field.Root>
        </HStack>

        {/* Dirección de facturación */}
        <Box borderWidth="1px" borderRadius="lg" p="4" bg="bg.subtle">
          <Text mb="3" fontWeight="medium">{labels.billingTitle}</Text>
          <VStack align="stretch" gap="3">
            <Field.Root>
              <Field.Label>Línea 1 *</Field.Label>
              <Input
                value={data.billingAddress.line1}
                onChange={e => setAddr("billingAddress", "line1", e.target.value)}
              />
            </Field.Root>
            <Field.Root>
              <Field.Label>Línea 2</Field.Label>
              <Input
                value={data.billingAddress.line2}
                onChange={e => setAddr("billingAddress", "line2", e.target.value)}
              />
            </Field.Root>
            <HStack gap="3">
              <Field.Root>
                <Field.Label>Ciudad *</Field.Label>
                <Input
                  value={data.billingAddress.city}
                  onChange={e => setAddr("billingAddress", "city", e.target.value)}
                />
              </Field.Root>
              <Field.Root>
                <Field.Label>Provincia/Estado</Field.Label>
                <Input
                  value={data.billingAddress.stateRegion}
                  onChange={e => setAddr("billingAddress", "stateRegion", e.target.value)}
                />
              </Field.Root>
            </HStack>
            <HStack gap="3">
              <Field.Root>
                <Field.Label>Código postal *</Field.Label>
                <Input
                  value={data.billingAddress.postalCode}
                  onChange={e => setAddr("billingAddress", "postalCode", e.target.value)}
                />
              </Field.Root>
              <Field.Root>
                <Field.Label>País *</Field.Label>
                <select
                  value={(data.billingAddress.countryIso2 || "").toUpperCase()}
                  onChange={(e) => setAddr("billingAddress", "countryIso2", e.target.value.toUpperCase())}
                  aria-label="País (ISO-2)"
                  autoComplete="country"
                  style={{
                    padding: '8px 10px',
                    borderRadius: 6,
                    border: '1px solid var(--chakra-colors-border)',
                    width: '100%',
                    background: 'var(--chakra-colors-bg)',
                    color: 'var(--chakra-colors-fg)'
                  }}
                >
                  <option value="" disabled>Selecciona país…</option>
                  {countriesIso2.map(c => (
                    <option key={c.code} value={c.code}>
                      {`${flagEmojiFromISO2(c.code)} ${c.name}`}
                    </option>
                  ))}
                </select>
              </Field.Root>
            </HStack>
          </VStack>
        </Box>

        <HStack justify="flex-end">
          <Button onClick={save} loading={saving} colorPalette="blue">Guardar</Button>
        </HStack>
      </VStack>
    </Box>
  )
}
