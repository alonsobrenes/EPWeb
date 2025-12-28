// src/pages/clinic/OrgAdminConsentDialog.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  HStack,
  Input,
  Spinner,
  Text,
  VStack,
   Heading, ButtonGroup, IconButton,
    Badge, Spacer, Portal, Table,
    Field, Avatar, NativeSelect,
} from "@chakra-ui/react";

import OrgAdminConsentsApi from "../../api/orgAdminConsentsApi";
import api from "../../api/client";
import SignaturePad from "../../components/SignaturePad";
import { toaster } from "../../components/ui/toaster";
import { generateConsentPdf } from "../../utils/generateConsentPdf"

// Reutiliza el mismo HTML por ahora (tal como acordaron)
import { CONSENTIMIENTO_HTML as CONSENT_HTML } from "./PatientConsentTab";

function FieldLabel({ children }) {
  return (
    <Text textStyle="sm" color="fg.muted" mb="1">
      {children}
    </Text>
  );
}

export default function OrgAdminConsentDialog({
  open,
  onClose,
  onSigned,
}) {
  const cancelBtnRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [consent, setConsent] = useState(null);
  const [error, setError] = useState(null);

  const [signing, setSigning] = useState(false);
  const [signedName, setSignedName] = useState("");
  const [signedIdNumber, setSignedIdNumber] = useState("");
  const [accepted, setAccepted] = useState(false);

  const [signatureData, setSignatureData] = useState(null);
  const [signatureImageUrl, setSignatureImageUrl] = useState(null);
  const [loadingSignatureImage, setLoadingSignatureImage] = useState(false);

  // Mantener firma local como en PatientConsentTab (misma idea)
  const LS_KEY = "org_admin_consent_signature_v1";

  useEffect(() => {
    if (!open) return;
    // al abrir: cargar latest
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setError(null);
        const latest = await OrgAdminConsentsApi.getLatest();
        if (!alive) return;
        setConsent(latest || null);
      } catch (e) {
        if (!alive) return;
        console.error("Error loading org consent", e);
        setError(e?.message || "No fue posible cargar el consentimiento.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [open]);

  // Si hay consentimiento, resolver firma (base64 viejo vs blob signature endpoint) como pacientes
  useEffect(() => {
    if (!open) return;

    let alive = true;
    let objectUrl = null;

    setSignatureImageUrl(null);

    if (!consent || !consent.signatureUri) {
      setLoadingSignatureImage(false);
      return;
    }

    // Caso 1: viejo base64
    if (typeof consent.signatureUri === "string" && consent.signatureUri.startsWith("data:image/")) {
      setSignatureImageUrl(consent.signatureUri);
      setLoadingSignatureImage(false);
      return;
    }

    // Caso 2: blob via endpoint
    setLoadingSignatureImage(true);

    (async () => {
      try {
        const response = await api.get(`/orgs/consent/${consent.id}/signature`, {
          responseType: "blob",
        });

        if (!alive) return;

        objectUrl = URL.createObjectURL(response.data);
        setSignatureImageUrl(objectUrl);
      } catch (err) {
        console.error("Error cargando firma org consent:", err);
        if (alive) setSignatureImageUrl(null);
      } finally {
        if (alive) setLoadingSignatureImage(false);
      }
    })();

    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [open, consent]);

  // Restaurar firma en canvas si existía
  useEffect(() => {
    if (!open) return;
    try {
      const saved = localStorage.getItem(LS_KEY);
      if (saved) setSignatureData(saved);
    } catch {
      // no-op
    }
  }, [open]);

  const canSign = useMemo(() => {
    return (
      !signing &&
      signedName.trim() !== "" &&
      accepted &&
      !!signatureData
    );
  }, [signing, signedName, accepted, signatureData]);

  const handleClose = () => {
    setError(null);
    onClose?.();
  };

  const handleSign = async () => {
    if (!canSign) return;

    try {
      setSigning(true);

      const payload = {
        signedName: signedName.trim(),
        signedIdNumber: signedIdNumber.trim() || null,
        signedByRelationship: "administrador",
        rawConsentText: CONSENT_HTML,
        signatureUri: signatureData,
      };

      const created = await OrgAdminConsentsApi.create(payload);

      console.log('created',created)

      // 1) Generar el PDF (Blob) con tu helper existente
    const pdfBlob = await generateConsentPdf({
    orgId: created.orgId,                 // si viene en el dto; si no, pásalo desde contexto (ver nota)
    consent: created,                     // si el helper lo requiere; si no, mapear
    consentHtml: CONSENT_HTML,            // el mismo rawConsentText
    signedName: created.signedName,
    signedIdNumber: created.signedIdNumber,
    signedAtUtc: created.signedAtUtc || created.createdAtUtc,
    signatureDataUrl: signatureData,      // si el PDF incluye firma
    })

    console.log('pdfBlob',pdfBlob)

    // 2) Subir el PDF al backend
    await OrgAdminConsentsApi.uploadPdf(created.id, pdfBlob)

      setConsent(created);
      onSigned?.(created);
      // limpiar firma local al firmar con éxito (opcional)
      try {
        localStorage.removeItem(LS_KEY);
      } catch {
        // no-op
      }

      toaster.success({
        title: "Consentimiento registrado",
        description: "El consentimiento de la organización fue firmado y guardado.",
      });

      onSigned?.(created);
    } catch (e) {
      console.error("Error creando org consent", e);
      toaster.error({
        title: "Error al guardar",
        description:
          e?.message || "Ocurrió un error al registrar el consentimiento.",
      });
    } finally {
      setSigning(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={(e) => (!e.open ? handleClose() : null)}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content maxW="900px">
          <Dialog.Header>
            <Dialog.Title>Consentimiento de la organización</Dialog.Title>
            <Dialog.CloseTrigger />
          </Dialog.Header>

          <Dialog.Body>
            {loading ? (
              <HStack gap="2">
                <Spinner size="sm" />
                <Text color="fg.muted" textStyle="sm">
                  Cargando…
                </Text>
              </HStack>
            ) : error ? (
              <VStack align="stretch" gap="2">
                <Text color="red.600" textStyle="sm">
                  {error}
                </Text>
                <Text color="fg.muted" textStyle="xs">
                  Puedes intentar recargar o contactar soporte.
                </Text>
              </VStack>
            ) : consent ? (
              // YA EXISTE CONSENT
              <VStack align="stretch" gap="3">
                <Text textStyle="sm" fontWeight="medium">
                  Ya existe un consentimiento firmado
                </Text>

                <Box borderWidth="1px" borderRadius="md" p="3" bg="bg.subtle">
                  <Text textStyle="sm">
                    <strong>Firmado por:</strong>{" "}
                    {consent.signedName || "(sin nombre)"}
                  </Text>
                  <Text textStyle="sm">
                    <strong>Fecha:</strong>{" "}
                    {consent.createdAtUtc
                      ? new Date(consent.createdAtUtc).toLocaleString()
                      : "(sin fecha)"}
                  </Text>
                  <Text textStyle="sm">
                    <strong>País:</strong> {consent.countryCode || "(n/a)"}
                  </Text>
                  <Text textStyle="sm">
                    <strong>Idioma:</strong> {consent.language || "(n/a)"}
                  </Text>
                </Box>

                <Text textStyle="sm" fontWeight="medium">
                  Firma
                </Text>

                <Box borderWidth="1px" borderRadius="md" p="3" bg="bg">
                  {loadingSignatureImage ? (
                    <HStack gap="2">
                      <Spinner size="sm" />
                      <Text color="fg.muted" textStyle="sm">
                        Cargando firma…
                      </Text>
                    </HStack>
                  ) : signatureImageUrl ? (
                    <img
                      src={signatureImageUrl}
                      alt="Firma"
                      style={{ maxWidth: "100%", height: "auto" }}
                    />
                  ) : (
                    <Text color="fg.muted" textStyle="sm">
                      No hay firma disponible para mostrar.
                    </Text>
                  )}
                </Box>
              </VStack>
            ) : (
              // NO EXISTE, MOSTRAR FIRMA
              <VStack align="stretch" gap="3">
                <Text textStyle="sm" fontWeight="medium">
                  Documento de consentimiento
                </Text>

                <Box
                  borderWidth="1px"
                  borderRadius="md"
                  p="3"
                  maxH="220px"
                  overflowY="auto"
                  bg="bg.subtle"
                >
                  <Box
                    className="consent-content"
                    dangerouslySetInnerHTML={{ __html: CONSENT_HTML }}
                  />
                </Box>

                <Box borderWidth="1px" borderRadius="md" p="3" bg="bg">
                  <VStack align="stretch" gap="3">
                    <Text textStyle="xs" color="fg.muted">
                      Registra los datos de quien firma en representación de la organización.
                    </Text>

                    <div>
                      <FieldLabel>Nombre de quien firma</FieldLabel>
                      <Input
                        size="sm"
                        value={signedName}
                        onChange={(e) => setSignedName(e.target.value)}
                        placeholder="Nombre completo"
                      />
                    </div>

                    <div>
                      <FieldLabel>Número de identificación</FieldLabel>
                      <Input
                        size="sm"
                        value={signedIdNumber}
                        onChange={(e) => setSignedIdNumber(e.target.value)}
                        placeholder="Cédula / DIMEX / Pasaporte"
                      />
                    </div>

                    {/* Checkbox nativo (igual a PatientConsentTab) */}
                    <label
                    style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 8,
                        fontSize: "0.875rem",
                        color: "var(--chakra-colors-fg-muted)",
                        marginTop: 4,
                    }}
                    >
                    <input
                        type="checkbox"
                        checked={accepted}
                        onChange={(e) => setAccepted(e.target.checked)}
                        style={{ marginTop: 4 }}
                    />
                    <span>Confirmo que he leído y acepto este consentimiento.</span>
                    </label>


                    <Box>
                      <FieldLabel>Firma</FieldLabel>
                      <SignaturePad
                        value={signatureData}
                        onChange={(dataUrl) => {
                          setSignatureData(dataUrl || null);
                          try {
                            if (dataUrl) localStorage.setItem(LS_KEY, dataUrl);
                          } catch {
                            // no-op
                          }
                        }}
                      />
                      <Text textStyle="xs" color="fg.muted" mt="2">
                        Si cierras el diálogo, la firma queda guardada localmente hasta que completes el proceso.
                      </Text>
                    </Box>
                  </VStack>
                </Box>
              </VStack>
            )}
          </Dialog.Body>

          <Dialog.Footer>
            <HStack w="full" justify="space-between">
              <Button ref={cancelBtnRef} variant="outline" onClick={handleClose}>
                Cerrar
              </Button>

              {!consent ? (
                <Button
                  onClick={handleSign}
                  disabled={!canSign}
                  loading={signing}
                >
                  Firmar y guardar
                </Button>
              ) : (
                <Button onClick={handleClose}>Listo</Button>
              )}
            </HStack>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
