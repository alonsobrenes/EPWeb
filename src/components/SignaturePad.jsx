import { useEffect, useRef, useState } from "react"
import {
  Box, Stack, Heading, Text, Card, Avatar, Badge,
  Button, HStack, Spinner, Checkbox, Grid, GridItem, Field, Input
} from "@chakra-ui/react"

export default function SignaturePad({ onChange }) {
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
