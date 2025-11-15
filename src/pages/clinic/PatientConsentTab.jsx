// src/pages/clinic/PatientConsentTab.jsx
import { useEffect, useState, useRef } from "react";
import {
  VStack,
  HStack,
  Text,
  Badge,
  Button,
  Spinner,
  Box,
  Input,
  Separator,
} from "@chakra-ui/react";
import PatientConsentsApi from "../../api/patientConsentsApi";
import { generateConsentPdf } from "../../utils/generateConsentPdf"
import { toaster } from "../../components/ui/toaster";

function FieldLabel({ children }) {
  return (
    <Text textStyle="sm" color="fg.muted" mb="1">
      {children}
    </Text>
  );
}

function SignaturePad({ onChange }) {
  const canvasRef = useRef(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef(null);
  const [canvasSize, setCanvasSize] = useState({ width: 300, height: 150 });
  const [hasDrawn, setHasDrawn] = useState(false);

  // Fondo cuadriculado suave
  const drawGrid = (ctx, width, height) => {
    if (!ctx) return;
    ctx.save();
    ctx.clearRect(0, 0, width, height);

    // Fondo blanco
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    // Líneas muy suaves tipo "papel"
    ctx.strokeStyle = "rgba(0, 0, 0, 0.06)";
    ctx.lineWidth = 1;
    const step = 20;

    for (let x = step; x < width; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    for (let y = step; y < height; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    ctx.restore();
  };

  // Ajuste responsivo del tamaño del canvas según el ancho disponible
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const updateSize = () => {
  const canvas = canvasRef.current;
  const parent = canvas?.parentElement;
  let width = 300;

  if (parent) {
    const rect = parent.getBoundingClientRect();
    // Usamos el ancho real del contenedor, sin -8 ni trucos
    width = rect.width;
  } else {
    width = Math.min(Math.max(window.innerWidth - 40, 260), 420);
  }

  const height = Math.max(120, Math.round(width / 2.4));

  setCanvasSize((prev) => {
    if (prev.width === width && prev.height === height) return prev;
    return { width, height };
  });
};

    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  // Aplicar tamaño y dibujar la cuadrícula cada vez que cambie el tamaño
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width = canvasSize.width;
    canvas.height = canvasSize.height;
    drawGrid(ctx, canvasSize.width, canvasSize.height);
    setHasDrawn(false);
  }, [canvasSize.width, canvasSize.height]);

  const getPos = (evt) => {
  const canvas = canvasRef.current;
  if (!canvas) return { x: 0, y: 0 };

  const rect = canvas.getBoundingClientRect();

  // Usamos las coordenadas del puntero en sistema de pantalla
  const xScreen = evt.clientX;
  const yScreen = evt.clientY;

  // Coordenadas relativas al canvas (en pixeles de pantalla)
  const relX = xScreen - rect.left;
  const relY = yScreen - rect.top;

  // Escalamos a coordenadas del canvas interno (width/height reales)
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  const x = relX * scaleX;
  const y = relY * scaleY;

  return { x, y };
};


  const startDrawing = (evt) => {
    // Solo botón izquierdo en mouse
    if (evt.pointerType === "mouse" && evt.button !== 0) return;
    evt.preventDefault();

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    isDrawingRef.current = true;

    const { x, y } = getPos(evt);
    lastPointRef.current = { x, y };

    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    // Podríamos usar evt.pressure si queremos variar el grosor
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#111111";

    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  // Trazos suavizados usando quadraticCurveTo
  const continueDrawing = (evt) => {
    if (!isDrawingRef.current) return;
    evt.preventDefault();

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { x, y } = getPos(evt);
    const last = lastPointRef.current || { x, y };
    const midX = (last.x + x) / 2;
    const midY = (last.y + y) / 2;

    ctx.quadraticCurveTo(last.x, last.y, midX, midY);
    ctx.stroke();

    lastPointRef.current = { x, y };
    if (!hasDrawn) setHasDrawn(true);
  };

  const finishDrawing = (evt) => {
    if (evt) evt.preventDefault();
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    lastPointRef.current = null;

    // Solo aquí disparamos onChange para no forzar renders en cada movimiento
    const canvas = canvasRef.current;
    if (!canvas || !onChange) return;
    const dataUrl = canvas.toDataURL("image/png");
    onChange(dataUrl);
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    drawGrid(ctx, canvas.width, canvas.height);
    setHasDrawn(false);
    if (onChange) onChange(null);
  };

  return (
    <Box width="100%">
      <Box
        position="relative"
        borderWidth="1px"
        borderStyle="dashed"
        borderColor="border"
        borderRadius="md"
        overflow="hidden"
        bg="bg"
      >
        <canvas
          ref={canvasRef}
          style={{
            width: "100%",
            height: `${canvasSize.height}px`,
            display: "block",
            touchAction: "none", // importante para dedo / stylus en móvil
          }}
          // Pointer events: mouse, touch, stylus (Apple Pencil, S-Pen, etc.)
          onPointerDown={startDrawing}
          onPointerMove={continueDrawing}
          onPointerUp={finishDrawing}
          onPointerLeave={finishDrawing}
          onPointerCancel={finishDrawing}
        />
        {!hasDrawn && (
          <Text
            position="absolute"
            top="2"
            left="3"
            textStyle="xs"
            color="fg.muted"
            pointerEvents="none"
          >
            Firma aquí
          </Text>
        )}
      </Box>

      <HStack justify="space-between" mt="2">
        <Text textStyle="xs" color="fg.muted">
          Firme con el mouse, dedo o stylus.
        </Text>
        <Button size="xs" variant="outline" onClick={handleClear}>
          Limpiar
        </Button>
      </HStack>
    </Box>
  );
}


export const CONSENTIMIENTO_HTML  = `
<h2>Consentimiento informado para atención psicológica</h2>

<h3>Uso de herramientas digitales y expediente clínico electrónico (Alfa-Doc)</h3>

<p><strong>Nombre de la persona usuaria:</strong> _________________________________<br/>
<strong>Número de identificación:</strong> ____________________________________</p>

<h3>1. Finalidad de este documento</h3>
<p>El presente consentimiento informado tiene como objetivo explicarle, de forma clara y comprensible,
las condiciones bajo las cuales se brindarán los servicios de atención psicológica, así como el uso
de herramientas digitales para el registro y manejo de su información clínica mediante la plataforma Alfa-Doc.</p>

<p>Al firmar este documento, usted confirma que comprende la información presentada y que acepta
voluntariamente recibir atención psicológica bajo estas condiciones.</p>

<h3>2. Principios éticos y marco general</h3>
<ul>
<li>Principios éticos ampliamente aceptados en psicología profesional (respeto, responsabilidad, integridad, justicia y bienestar).</li>
<li>Buenas prácticas internacionales en salud mental y confidencialidad.</li>
<li>Normas de protección de datos del país donde ejerce el/la profesional.</li>
</ul>

<p>El/la profesional es responsable de adaptar su práctica a la legislación local y de respetar los principios éticos de la profesión.</p>

<h3>3. Confidencialidad y protección de datos</h3>
<p>La información que usted comparte en atención psicológica es confidencial.</p>
<p>Sus datos personales, de contacto y clínicos se almacenarán en un expediente clínico electrónico dentro de la plataforma Alfa-Doc.</p>

<p>Sus datos serán utilizados únicamente para:</p>
<ul>
<li>Evaluación, diagnóstico y tratamiento psicológico.</li>
<li>Seguimiento clínico.</li>
<li>Coordinación de la atención con otros profesionales cuando usted lo autorice o la normativa lo requiera.</li>
</ul>

<p>Usted tiene derecho a solicitar acceso, corrección y conocer cómo se almacenan y protegen sus datos.
No se utilizarán con fines comerciales.</p>

<h3>4. Secreto profesional y límites de la confidencialidad</h3>
<ul>
<li>Riesgo serio e inminente para usted o terceros.</li>
<li>Sospecha de abuso, violencia o vulneración grave de derechos.</li>
<li>Requerimientos de autoridades legales competentes.</li>
</ul>

<h3>5. Uso de herramientas digitales (Alfa-Doc)</h3>
<ul>
<li>Registrar notas y observaciones.</li>
<li>Aplicar pruebas y cuestionarios.</li>
<li>Gestionar expediente clínico.</li>
<li>Generar informes o resúmenes.</li>
</ul>

<p>Estas herramientas son apoyo, no sustituyen juicio clínico.</p>

<h3>6. Grabación de sesiones (audio/video, si aplica)</h3>
<p>Solo con fines clínicos. Acceso restringido. No se usan con fines docentes/investigativos sin autorización adicional.</p>

<h3>7. Uso de IA como herramienta de apoyo</h3>
<p>La IA puede apoyar en organización, resúmenes o borradores clínicos, pero no sustituye criterio profesional.
Se aplican medidas de seguridad y minimización de datos.</p>

<h3>8. Modalidad de atención</h3>
<p>Presencial, en línea (telepsicología) o combinada. Puede incluir entrevistas, pruebas, psicoterapia individual/familiar,
seguimiento y revisión de objetivos.</p>

<h3>9. Menores de edad o personas representadas</h3>
<p>Se requiere consentimiento de madre, padre, tutor o representante legal. Debe constar claramente en el formulario.</p>

<h3>10. Derechos de la persona usuaria</h3>
<ul>
<li>Trato respetuoso y digno.</li>
<li>Información clara sobre métodos y objetivos.</li>
<li>Preguntar y solicitar aclaraciones.</li>
<li>Solicitar acceso a información clínica (según normativa).</li>
<li>Expresar inconformidad o solicitar segunda opinión.</li>
</ul>

<h3>11. Responsabilidades de la persona usuaria</h3>
<ul>
<li>Brindar información veraz en la medida posible.</li>
<li>Informar cambios significativos en su salud.</li>
<li>Respetar el espacio terapéutico.</li>
<li>Usar responsablemente los canales de comunicación.</li>
</ul>

<h3>12. Sección local complementaria</h3>
<p>Si la legislación local lo exige, se incluirá un anexo específico según el país.</p>

<h3>13. Declaración de consentimiento</h3>
<ul>
<li>He leído o se me explicó este consentimiento.</li>
<li>Tuve oportunidad de hacer preguntas.</li>
<li>Comprendo que puedo retirar mi consentimiento para la atención futura.</li>
<li>Acepto recibir atención psicológica bajo estas condiciones.</li>
</ul>

<p><strong>Firma (persona usuaria o responsable legal):</strong> __________________________</p>
<p><strong>Fecha:</strong> ____ / ____ / ______</p>
`;


export default function PatientConsentTab({
  patientId,
  patientName,
  readOnly = false,
  consentText,
}) {
  const [loading, setLoading] = useState(true);
  const [consent, setConsent] = useState(null);
  const [error, setError] = useState(null);

  // Estado para la firma (solo se usa cuando aún no hay consentimiento)
  const [signing, setSigning] = useState(false);
  const [signedName, setSignedName] = useState("");
  const [signedIdNumber, setSignedIdNumber] = useState("");
  const [signedByRelationship, setSignedByRelationship] = useState("paciente");
  const [accepted, setAccepted] = useState(false);
  const [signatureData, setSignatureData]= useState(null)
  const [canvasSize, setCanvasSize] = useState({ width: 300, height: 150 });
  const RELATIONSHIP_OPTIONS = [
    { value: "paciente", label: "Paciente (el mismo)" },
    { value: "madre", label: "Madre" },
    { value: "padre", label: "Padre" },
    { value: "tutor legal", label: "Tutor legal" },
    { value: "encargado", label: "Encargado" },
    { value: "pareja", label: "Pareja" },
    { value: "otro", label: "Otro" }
    ];

  useEffect(() => {
    let alive = true;

    if (!patientId) {
      setLoading(false);
      setConsent(null);
      setError(null);
      return;
    }

    (async () => {
      try {
        setLoading(true);
        setError(null);
        const latest = await PatientConsentsApi.getLatest(patientId);
        if (!alive) return;
        setConsent(latest || null);
      } catch (e) {
        if (!alive) return;
        console.error("Error loading consent", e);
        setError(
          e?.message || "No fue posible cargar el consentimiento informado."
        );
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [patientId]);

  const isValidSignature =
    !!patientId &&
    !readOnly &&
    signedName.trim() !== "" &&
    accepted &&
    !signing && 
    !!signatureData;

  const handleSign = async () => {
    if (!isValidSignature) {alert("");return};

    try {
      setSigning(true);
      const effectiveConsentText = consentText || CONSENTIMIENTO_HTML
      // Payload mínimo, alineado a los campos que ya vemos en el DTO
      const payload = {
        signedName: signedName.trim(),
        signedIdNumber: signedIdNumber.trim() || null,
        signedByRelationship: (signedByRelationship || "paciente").trim(),
        rawConsentText: effectiveConsentText,
        signatureUri: signatureData || null,
      };
      const created = await PatientConsentsApi.create(patientId, payload);
      setConsent(created);

      toaster.success({
        title: "Consentimiento registrado",
        description: "El consentimiento informado fue firmado y guardado.",
      });
    } catch (e) {
      console.error("Error creando consentimiento", e);
      toaster.error({
        title: "Error al guardar",
        description:
          e?.message ||
          "Ocurrió un error al registrar el consentimiento informado.",
      });
    } finally {
      setSigning(false);
    }
  };

  // --- Ramas de UI ---

  if (!patientId) {
    return (
      <Text color="fg.muted" textStyle="sm">
        Guarda el paciente primero para poder registrar su consentimiento
        informado.
      </Text>
    );
  }

  if (loading) {
    return (
      <HStack gap="2">
        <Spinner size="sm" />
        <Text color="fg.muted" textStyle="sm">
          Cargando consentimiento…
        </Text>
      </HStack>
    );
  }

  if (error) {
    return (
      <VStack align="stretch" gap="3">
        <Text color="red.600" textStyle="sm">
          {error}
        </Text>
        <Text color="fg.muted" textStyle="xs">
          Puedes intentar recargar la página o contactar soporte si el problema
          persiste.
        </Text>
      </VStack>
    );
  }

  // CASO 1: aún no hay consentimiento registrado
  if (!consent) {
    // Si es solo lectura, mantenemos un mensaje neutro
    if (readOnly) {
      return (
        <VStack align="stretch" gap="3">
          <Text textStyle="sm" fontWeight="medium">
            Consentimiento informado
          </Text>
          <Text color="fg.muted" textStyle="sm">
            Este paciente aún no tiene un consentimiento informado registrado en
            el sistema.
          </Text>
        </VStack>
      );
    }

    // Modo editable: mostramos texto + datos para firmar
    return (
    <VStack align="stretch" gap="3">
      <Text textStyle="sm" fontWeight="medium">
        Consentimiento informado
      </Text>

      {/* Texto del consentimiento (ya era scrollable) */}
      <Box
        borderWidth="1px"
        borderRadius="md"
        p="3"
        maxH="200px"
        overflowY="auto"
        bg="bg.subtle"
      >
        <Box
            className="consent-content"
            dangerouslySetInnerHTML={{ __html: CONSENTIMIENTO_HTML }}
            />
      </Box>

      {/* 🔽 NUEVA CAJA SCROLLABLE para formulario + firma */}
      <Box
        borderWidth="1px"
        borderRadius="md"
        p="3"
        maxH="260px"
        overflowY="auto"
        bg="bg"
      >
        <VStack align="stretch" gap="3">
          <Text textStyle="xs" color="fg.muted">
            Por favor, registra los datos de quien firma el consentimiento.
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

          <div>
            <FieldLabel>Relación con el paciente</FieldLabel>
            <select
              value={signedByRelationship}
              onChange={(e) => setSignedByRelationship(e.target.value)}
              style={{
                padding: "8px 10px",
                borderRadius: 6,
                border: "1px solid var(--chakra-colors-border)",
                width: "100%",
                background: "var(--chakra-colors-bg)",
                color: "var(--chakra-colors-fg)",
              }}
            >
              {RELATIONSHIP_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Checkbox nativo */}
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
            <span>
              He leído y comprendo el contenido del consentimiento informado y
              acepto su contenido.
            </span>
          </label>

          {/* Firma */}
          <VStack>
            <FieldLabel>Firma</FieldLabel>
            <SignaturePad onChange={(dataUrl) => setSignatureData(dataUrl)} />
          </VStack>

          <HStack justify="flex-end" mt={2}>
            <Button
              size="sm"
              colorPalette="green"
              onClick={handleSign}
              disabled={!isValidSignature}
              loading={signing}
              loadingText="Guardando…"
            >
              Firmar consentimiento
            </Button>
          </HStack>
        </VStack>
      </Box>
    </VStack>
  );
}
  // CASO 2: ya existe un consentimiento firmado
  const signedAt = consent.signedAtUtc ? new Date(consent.signedAtUtc) : null;
  const signedAtText = signedAt
    ? signedAt.toLocaleString()
    : "fecha no disponible";

  return (
    <VStack align="stretch" gap="3">
      <HStack justify="space-between" align="center">
        <HStack gap="2">
          <Badge variant="subtle" colorPalette="green">
            Consentimiento firmado
          </Badge>
          <Text textStyle="sm" color="fg.muted">
            {patientName || "Paciente"} — {signedAtText}
          </Text>
        </HStack>
      </HStack>
      <Button
        size="xs"
        variant="outline"
        onClick={() => {
          try {
            const blob = generateConsentPdf({
              patient: {
                fullName: patientName,
                identificationNumber: consent.signedIdNumber,
                id: consent.patientId,
              },
              consent,
            })
            const url = URL.createObjectURL(blob)
            const win = window.open(url, "_blank")
            if (!win) {
              // fallback: descarga directa
              const a = document.createElement("a")
              a.href = url
              a.download = `consentimiento-${consent.patientId || "paciente"}.pdf`
              a.click()
            }
          } catch (err) {
            console.error("Error generando PDF de consentimiento:", err)
          }
        }}
      >
        Imprimir / Descargar PDF
      </Button>
      <Text textStyle="sm">
        <strong>Firmado por:</strong> {consent.signedName}
      </Text>

      {consent.signedIdNumber && (
        <Text textStyle="sm">
          <strong>Documento:</strong> {consent.signedIdNumber}
        </Text>
      )}

      <Text textStyle="sm">
        <strong>Relación:</strong> {consent.signedByRelationship || "paciente"}
      </Text>

      {consent.countryCode && (
        <Text textStyle="xs" color="fg.muted">
          País de atención: {consent.countryCode}
        </Text>
      )}

      {consent.consentVersion && (
        <Text textStyle="xs" color="fg.muted">
          Versión del consentimiento: {consent.consentVersion}
          {consent.localAddendumCountry && consent.localAddendumVersion && (
            <>
              {" "}
              · Addendum {consent.localAddendumCountry} (
              {consent.localAddendumVersion})
            </>
          )}
        </Text>
      )}

      {consent.signatureUri && (
        <VStack align="flex-start" gap="2">
            <Text textStyle="xs" color="fg.muted">
            Firma registrada digitalmente:
            </Text>

            <Box
            as="img"
            src={consent.signatureUri}
            alt="Firma del consentimiento"
            maxH="120px"
            borderRadius="md"
            borderWidth="1px"
            bg="white"
            />

            <Text textStyle="xs" color="fg.muted">
            La firma del consentimiento se encuentra almacenada de forma segura
            como parte del expediente clínico electrónico.
            </Text>
        </VStack>
        )}
    </VStack>
  );
}
