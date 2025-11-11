// src/utils/interviewEstimates.js
import api from "../api/client"

/**
 * Calcula estimaciones para subir y procesar un audio antes de transcribirlo.
 *
 * @param {File} file - Archivo de audio seleccionado por el usuario.
 * @param {number} durationSeconds - Duración del audio (local, medida con <audio>).
 * @param {string} interviewId - Id de la entrevista (para GET /audio-info si existe audio previo).
 * @returns {Promise<object>} Datos para mostrar en la sección informativa.
 */
export async function getInterviewEstimates(file, durationSeconds, interviewId) {
  // ------------------------------------------------------------------
  // 1) Estimar velocidad de subida real del usuario
  // ------------------------------------------------------------------
  let uploadBps = null;
  try {
    const blob = new Blob([new Uint8Array(1_048_576)]); // 1 MB
    const start = performance.now();
    await api.post("/utils/ping-upload", blob, {
      headers: { "Content-Type": "application/octet-stream" },
    });
    const elapsed = performance.now() - start;
    uploadBps = 1_048_576 / (elapsed / 1000);
  } catch (err) {
    console.warn("Ping upload falló, usando valor por defecto (5 Mbps).", err);
    uploadBps = 5 * 1024 * 1024 / 8; // ≈0.625 MB/s
  }

  // ------------------------------------------------------------------
  // 2) Obtener info del audio (si ya existe en servidor)
  // ------------------------------------------------------------------
  let serverInfo = null;
  try {
    const res = await api.get(`/utils/audio-info/${interviewId}`);
    if (res.data?.hasAudio) serverInfo = res.data;
  } catch (err) {
    console.warn("No se pudo obtener audio-info:", err);
  }

  // ------------------------------------------------------------------
  // 3) Cálculos base
  // ------------------------------------------------------------------
  const sizeBytes = file?.size ?? serverInfo?.sizeBytes ?? 0;
  const duration = durationSeconds || (serverInfo?.durationMs ?? 0) / 1000;

  // Upload estimado
  const uploadSeconds = uploadBps > 0 ? sizeBytes / uploadBps : 0;

  // Heurística de procesamiento STT
  const processingFactorMin = 1.0;
  const processingFactorMax = 1.6;
  const processingMin = duration * processingFactorMin;
  const processingMax = duration * processingFactorMax;

  // Límite máximo permitido (puedes ajustar con tu backend)
  const maxDurationMin = 30;
  const maxSizeMB = 100;

  const overDuration = duration / 60 > maxDurationMin;
  const overSize = sizeBytes / (1024 * 1024) > maxSizeMB;

  // Formateo rápido
  const fmt = s => {
    if (!s || s <= 0) return "0 s";
    if (s < 60) return `${Math.round(s)} s`;
    const m = Math.floor(s / 60);
    const sec = Math.round(s % 60);
    return `${m} min ${sec} s`;
  };

  return {
    connection: {
      uploadBps,
      uploadMbps: (uploadBps * 8) / 1e6,
    },
    file: {
      name: file?.name ?? serverInfo?.uri?.split("/").pop(),
      sizeBytes,
      sizeMB: sizeBytes / (1024 * 1024),
      durationSec: duration,
    },
    estimates: {
      uploadSec: uploadSeconds,
      processingMinSec: processingMin,
      processingMaxSec: processingMax,
      totalMinSec: uploadSeconds + processingMin,
      totalMaxSec: uploadSeconds + processingMax,
    },
    warnings: {
      overDuration,
      overSize,
      maxDurationMin,
      maxSizeMB,
    },
    formatted: {
      upload: fmt(uploadSeconds),
      processing: `${fmt(processingMin)} – ${fmt(processingMax)}`,
      total: `${fmt(uploadSeconds + processingMin)} – ${fmt(uploadSeconds + processingMax)}`,
    },
  };
}
