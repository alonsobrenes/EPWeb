// src/utils/generateSessionPdf.js
import jsPDF from "jspdf"

/**
 * Genera un PDF con TODA la info relevante de una sesión.
 * Se inspira en utils/generateInterviewPdf (mismo layout base A4). 
 * Campos que admite:
 *   patient: { id, fullName|name }
 *   session: { id, title, createdAtUtc, updatedAtUtc, contentText, aiTidyText, aiOpinionText }
 *   labels:  [{ code, name, colorHex }]  // opcional
 */
export function generateSessionPdf({ patient, session, labels = [] }) {
  const doc = new jsPDF({ unit: "pt", format: "a4" })
  let y = 40

  // Título
  doc.setFont("helvetica", "bold")
  doc.text("Sesión de consulta", 40, y); y += 20
  doc.setFont("helvetica", "normal")

  // Encabezado con paciente y sesión
  const patientText = (patient?.fullName || patient?.name || patient?.id || "").trim()
  const created = session?.createdAtUtc ? new Date(session.createdAtUtc).toLocaleString() : ""
  const updated = session?.updatedAtUtc ? new Date(session.updatedAtUtc).toLocaleString() : ""

  doc.text(`Paciente: ${patientText}`, 40, y); y += 16
  doc.text(`Sesión: ${session?.id || ""} — ${session?.title || ""}`, 40, y); y += 16
  doc.text(`Fecha: ${created || updated || new Date().toLocaleString()}`, 40, y); y += 20

  // Etiquetas (si hay)
  if (Array.isArray(labels) && labels.length > 0) {
    doc.setFont("helvetica", "bold"); doc.text("Etiquetas:", 40, y); y += 14
    doc.setFont("helvetica", "normal")
    const labelLine = labels.map(l => l.code || l.name || "").filter(Boolean).join("  •  ")
    const lw = doc.splitTextToSize(labelLine || "(sin etiquetas)", 515)
    doc.text(lw, 40, y); y += 12 + lw.length * 12
    y += 6
  }

  // Texto principal
  doc.setFont("helvetica", "bold"); doc.text("Notas clínicas:", 40, y); y += 16
  doc.setFont("helvetica", "normal")
  const tw = doc.splitTextToSize(session?.contentText || "(sin notas)", 515)
  doc.text(tw, 40, y); y += 16 + tw.length * 12

  y += 12
  // IA: Ordenar
  doc.setFont("helvetica", "bold"); doc.text("Texto ordenado (IA):", 40, y); y += 16
  doc.setFont("helvetica", "normal")
  const tidy = doc.splitTextToSize(session?.aiTidyText || "(sin contenido IA ordenado)", 515)
  doc.text(tidy, 40, y); y += 16 + tidy.length * 12

  y += 12
  // IA: Opinión
  doc.setFont("helvetica", "bold"); doc.text("Opinión IA:", 40, y); y += 16
  doc.setFont("helvetica", "normal")
  const op = doc.splitTextToSize(session?.aiOpinionText || "(sin opinión IA)", 515)
  doc.text(op, 40, y)

  return doc.output("blob")
}
