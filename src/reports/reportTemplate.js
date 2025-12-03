// src/utils/reportTemplate.js
import jsPDF from "jspdf"

/**
 * Crea un reporte base con:
 * - Documento A4
 * - Márgenes estándar
 * - Logo de la organización (opcional)
 * - Nombre de la organización (opcional)
 * - Título principal
 * - Subtítulo opcional
 * - Bloque de filas label/value (encabezado de datos)
 *
 * Retorna doc + métricas + la posición Y donde empezar el contenido específico.
 */
export function createBaseReport({
  title,
  subtitle,
  orgName,
  orgLogoBase64,
  infoRows = [],
}) {
  const doc = new jsPDF({ unit: "pt", format: "a4" })
  const marginLeft = 40
  const marginRight = 40
  const pageWidth = doc.internal.pageSize.getWidth()
  const maxWidth = pageWidth - marginLeft - marginRight
  const pageHeight = doc.internal.pageSize.getHeight()

  let y = 40

  // --- Logo (opcional) ---
  const logoSize = 48
  if (orgLogoBase64) {
    try {
      const logoX = pageWidth - marginRight - logoSize
      const logoY = y
      doc.addImage(orgLogoBase64, "PNG", logoX, logoY, logoSize, logoSize)
    } catch (err) {
      console.warn("No se pudo agregar el logo al PDF:", err)
    }
  }

  // --- Nombre de la organización (si hay) ---
  const effectiveOrgName = (orgName || "alfa-doc.com").trim()

  doc.setFont("helvetica", "bold")
  doc.setFontSize(11)
  doc.text(effectiveOrgName, marginLeft, y + 10)

  // --- Título principal ---
  doc.setFont("helvetica", "bold")
  doc.setFontSize(16)
  doc.text(title, marginLeft, y + 30)

  y += 50

  // --- Subtítulo (opcional) ---
  if (subtitle) {
    doc.setFont("helvetica", "normal")
    doc.setFontSize(11)
    doc.text(subtitle, marginLeft, y)
    y += 20
  }

  // --- Bloque label/value (encabezado de datos) ---
  if (infoRows && infoRows.length > 0) {
    const valueOffset = 210
    doc.setFontSize(11)

    infoRows.forEach((row) => {
      const label = row.label?.trim()
      const value = row.value?.trim()
      if (!label && !value) return

      doc.setFont("helvetica", "bold")
      doc.text(label || "", marginLeft, y)

      if (value) {
        doc.setFont("helvetica", "normal")
        doc.text(` ${value}`, marginLeft + valueOffset, y)
      }

      y += 16
    })
  }

  // Línea separadora
  y += 6
  doc.setDrawColor(180)
  doc.line(marginLeft, y, marginLeft + maxWidth, y)
  y += 16

  return {
    doc,
    marginLeft,
    marginRight,
    pageWidth,
    maxWidth,
    pageHeight,
    y, // punto de inicio para el contenido específico
  }
}
