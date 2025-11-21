// src/utils/generateConsentPdf.js
import jsPDF from "jspdf"

/**
 * Genera un PDF del consentimiento informado para atención psicológica.
 *
 * @param {object} args
 * @param {object} args.patient - { fullName?, name?, id?, identificationNumber? }
 * @param {object} args.consent - PatientConsentDto (firmado)
 *
 * Campos esperados en consent:
 *  - signedName
 *  - signedIdNumber
 *  - signedByRelationship
 *  - countryCode
 *  - language
 *  - rawConsentText
 *  - consentVersion
 *  - localAddendumCountry
 *  - localAddendumVersion
 *  - signedAtUtc
 *  - signatureUri (data URL PNG)
 */
function normalizeConsentText(raw) {
  if (!raw) return ""

  let text = raw

  // Normalización básica de saltos de línea y listas
  text = text.replace(/<\s*br\s*\/?>/gi, "\n")
  text = text.replace(/<\/p>/gi, "\n\n")
  text = text.replace(/<p[^>]*>/gi, "") // abrimos <p> sin nada

  // Encabezados: los separamos con doble salto de línea
  text = text.replace(/<h[1-6][^>]*>/gi, "\n\n")
  text = text.replace(/<\/h[1-6]>/gi, "\n\n")

  // Listas
  text = text.replace(/<li[^>]*>/gi, "• ")
  text = text.replace(/<\/li>/gi, "\n")
  text = text.replace(/<\/ul>/gi, "\n\n")
  text = text.replace(/<\/ol>/gi, "\n\n")

  // Quitar el resto de tags HTML
  text = text.replace(/<[^>]+>/g, "")

  // Normalizar espacios y saltos de línea
  text = text.replace(/\r\n/g, "\n")
  text = text.replace(/\n{3,}/g, "\n\n")

  return text.trim()
}

export function generateConsentPdf({ patient, consent, signatureImageBase64 }) {
  const doc = new jsPDF({ unit: "pt", format: "a4" })
  const marginLeft = 40
  const marginRight = 40
  const maxWidth = 595 - marginLeft - marginRight // ancho útil A4
  const pageHeight = doc.internal.pageSize.getHeight()
  let y = 40

  const patientName =
    (patient?.fullName || patient?.name || "").trim() || "(sin nombre)"
  const patientIdNumber =
    patient?.identificationNumber ||
    consent?.signedIdNumber ||
    "(sin identificación)"
  const signedName = consent?.signedName || patientName
  const signedByRelationship = consent?.signedByRelationship || "paciente"
  const countryCode = (consent?.countryCode || "").toUpperCase()
  const version = consent?.consentVersion || ""
  const localAddendumCountry = consent?.localAddendumCountry || ""
  const localAddendumVersion = consent?.localAddendumVersion || ""
  const signedAt = consent?.signedAtUtc
    ? new Date(consent.signedAtUtc)
    : new Date()
  const signedAtText = signedAt.toLocaleString()

  // Helper para salto de página
  const ensureSpace = (doc, y, extra = 40) => {
    const effectiveHeight = pageHeight - 60 // pequeña reserva al fondo
    if (y + extra <= effectiveHeight) return y
    doc.addPage()
    return 40
  }

  // Helper para escribir un párrafo con split y salto de página
  const writeParagraph = (text, opts = {}) => {
    const {
      bold = false,
      lineGap = 4,
      before = 0,
      after = 10,
    } = opts

    if (!text) return

    y = ensureSpace(doc, y, before + 20)
    y += before

    doc.setFont("helvetica", bold ? "bold" : "normal")
    const lines = doc.splitTextToSize(text, maxWidth)
    doc.text(lines, marginLeft, y)
    y += lines.length * 12 + lineGap + after
  }

  // ---------------------------
  // TÍTULO
  // ---------------------------
  doc.setFont("helvetica", "bold")
  doc.setFontSize(16)
  doc.text("Consentimiento informado para atención psicológica", marginLeft, y)
  y += 24

  doc.setFontSize(11)
  doc.setFont("helvetica", "normal")
  writeParagraph(
    "Uso de herramientas digitales y expediente clínico electrónico (Alfa-Doc)",
    { bold: true, before: 0, after: 12 }
  )

  // ---------------------------
  // ENCABEZADO PACIENTE / CONSENTIMIENTO
  // ---------------------------
  doc.setFont("helvetica", "bold")
  doc.text(`Nombre de la persona usuaria:`, marginLeft, y)
  doc.setFont("helvetica", "normal")
  doc.text(` ${patientName}`, marginLeft + 210, y)
  y += 16

  doc.setFont("helvetica", "bold")
  doc.text(`Número de identificación:`, marginLeft, y)
  doc.setFont("helvetica", "normal")
  doc.text(` ${patientIdNumber}`, marginLeft + 210, y)
  y += 16

  doc.setFont("helvetica", "bold")
  doc.text(`Fecha de firma:`, marginLeft, y)
  doc.setFont("helvetica", "normal")
  doc.text(` ${signedAtText}`, marginLeft + 210, y)
  y += 16

  doc.setFont("helvetica", "bold")
  doc.text(`Firma de:`, marginLeft, y)
  doc.setFont("helvetica", "normal")
  doc.text(
    ` ${signedName} (${signedByRelationship.toLowerCase()})`,
    marginLeft + 210,
    y
  )
  y += 16

  if (countryCode || version) {
    doc.setFont("helvetica", "bold")
    doc.text(`País / versión:`, marginLeft, y)
    doc.setFont("helvetica", "normal")
    const versionTextParts = []
    if (countryCode) versionTextParts.push(countryCode)
    if (version) versionTextParts.push(`versión ${version}`)
    if (localAddendumCountry && localAddendumVersion) {
      versionTextParts.push(
        `addendum ${localAddendumCountry} (${localAddendumVersion})`
      )
    }
    const vText = versionTextParts.join(" · ")
    doc.text(` ${vText}`, marginLeft + 210, y)
    y += 18
  }

  y += 6
  doc.setDrawColor(180)
  doc.line(marginLeft, y, marginLeft + maxWidth, y)
  y += 16

  // ---------------------------
  // CUERPO DEL CONSENTIMIENTO
  // Podemos usar rawConsentText del snapshot o un texto base
  // ---------------------------
  const rawHtml = (consent?.rawConsentText || "").trim()
    const normalized = normalizeConsentText(rawHtml)

    if (normalized) {
    writeParagraph("Contenido del consentimiento informado:", {
        bold: true,
        after: 8,
    })

    const paragraphs = normalized.split(/\n\s*\n+/)
    paragraphs.forEach((p) => {
        const text = p.trim()
        if (!text || text.indexOf("_") > 0) return
        writeParagraph(text, { bold: false, after: 6 })
    })
    } else {
    writeParagraph(
        "Contenido del consentimiento informado no disponible.",
        { bold: true, after: 10 }
    )
    }

  // ---------------------------
  // SECCIÓN DE FIRMA
  // ---------------------------
  y = ensureSpace(doc, y, 120)
  y += 20

  doc.setFont("helvetica", "bold")
  doc.text("Declaración de la persona usuaria / responsable:", marginLeft, y)
  y += 16
  doc.setFont("helvetica", "normal")
  const declLines = doc.splitTextToSize(
    "Declaro que he leído (o se me ha explicado de forma clara) el contenido de este consentimiento informado, que he tenido oportunidad de hacer preguntas y que acepto recibir atención psicológica bajo las condiciones descritas.",
    maxWidth
  )
  doc.text(declLines, marginLeft, y)
  y += declLines.length * 12 + 24

  // Línea de firma y nombre
  doc.setDrawColor(0)
  const lineWidth = 220
  const lineX = marginLeft
  const lineY = y + 20
  doc.line(lineX, lineY, lineX + lineWidth, lineY)

  doc.setFont("helvetica", "normal")
  doc.text("Firma (persona usuaria o responsable):", lineX, lineY + 14)
  doc.text(signedName, lineX, lineY - 6)

  // Imagen de firma digital (si existe)
  if (consent?.signatureUri) {
    try {
      // Ajustamos tamaño de imagen de firma
      const imgWidth = 180
      const imgHeight = 70
      const imgX = lineX + maxWidth - imgWidth // alineamos a la derecha
      const imgY = lineY - imgHeight - 10

      doc.addImage(
        signatureImageBase64,
        "PNG",
        imgX,
        imgY,
        imgWidth,
        imgHeight
      )

      doc.setFont("helvetica", "xs" || "normal")
      doc.setFontSize(8)
      doc.text("Firma digital registrada en Alfa-Doc", imgX, imgY + imgHeight + 10)
      doc.setFontSize(11)
    } catch (err) {
      console.warn("No se pudo agregar la imagen de la firma al PDF:", err)
    }
  }

  y = lineY + 40
  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  doc.setTextColor(120)
  const footer = `Generado por Alfa-Doc — ${new Date().toLocaleString()}`
  doc.text(footer, marginLeft, pageHeight - 30)

  return doc.output("blob")
}
