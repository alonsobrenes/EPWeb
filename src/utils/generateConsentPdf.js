// src/utils/generateConsentPdf.js
import { createBaseReport } from "../reports/reportTemplate"
import {tryGetOrgId} from '../utils/identity'
/**
 * Genera un PDF del consentimiento informado para atención psicológica.
 *
 * @param {object} args
 * @param {object} args.patient - { fullName?, name?, identificationNumber? }
 * @param {object} args.consent - PatientConsentDto (firmado)
 * @param {string} args.signatureImageBase64 - data:image/png;base64,... de la firma
 * @param {string} [args.orgLogoBase64] - data:image/png;base64,... del logo (opcional)
 * @param {string} [args.orgName] - nombre de la organización (opcional)
 */
function normalizeConsentText(raw) {
  if (!raw) return ""

  let text = raw

  // Normalización básica de saltos de línea y listas
  text = text.replace(/<\s*br\s*\/?>/gi, "\n")
  text = text.replace(/<\/p>/gi, "\n\n")
  text = text.replace(/<p[^>]*>/gi, "") // quitamos <p>

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

export function generateConsentPdf({
  patient,
  consent,
  signatureImageBase64,
  orgName,
}) {
  const orgId = tryGetOrgId()
  const orgLogoBase64 = orgId
    ? localStorage.getItem(`ep:logo:${orgId}`)
    : null

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

  // Texto para País / versión
  let versionText = ""
  const versionTextParts = []
  if (countryCode) versionTextParts.push(countryCode)
  if (version) versionTextParts.push(`versión ${version}`)
  if (localAddendumCountry && localAddendumVersion) {
    versionTextParts.push(
      `addendum ${localAddendumCountry} (${localAddendumVersion})`
    )
  }
  if (versionTextParts.length > 0) {
    versionText = versionTextParts.join(" · ")
  }

  // ---------------------------
  // PLANTILLA BASE (LOGO + TÍTULO + SUBTÍTULO + ENCABEZADO)
  // ---------------------------
  const {
    doc,
    marginLeft,
    maxWidth,
    pageHeight,
    y: startY,
  } = createBaseReport({
    title: "Consentimiento informado para atención psicológica",
    subtitle:
      "Uso de herramientas digitales y expediente clínico electrónico (Alfa-Doc)",
    orgName,
    orgLogoBase64,
    infoRows: [
      {
        label: "Nombre de la persona usuaria:",
        value: patientName,
      },
      {
        label: "Número de identificación:",
        value: patientIdNumber,
      },
      {
        label: "Fecha de firma:",
        value: signedAtText,
      },
      {
        label: "Firma de:",
        value: `${signedName} (${signedByRelationship.toLowerCase()})`,
      },
      versionText
        ? {
            label: "País / versión:",
            value: versionText,
          }
        : null,
    ].filter(Boolean),
  })

  let y = startY

  // Helper para salto de página
  const ensureSpace = (docInstance, currentY, extra = 40) => {
    const effectiveHeight = pageHeight - 60 // margen inferior
    if (currentY + extra <= effectiveHeight) return currentY
    docInstance.addPage()
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
  // CUERPO DEL CONSENTIMIENTO
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
  if (consent?.signatureUri && signatureImageBase64) {
    try {
      const imgWidth = 180
      const imgHeight = 50
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

      doc.setFont("helvetica", "normal")
      doc.setFontSize(8)
      doc.text(
        "Firma digital registrada en Alfa-Doc",
        imgX,
        imgY + imgHeight + 10
      )
      doc.setFontSize(11)
    } catch (err) {
      console.warn("No se pudo agregar la imagen de la firma al PDF:", err)
    }
  }

  // ---------------------------
  // FOOTER
  // ---------------------------
  const footerY = pageHeight - 30
  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  doc.setTextColor(120)
  // const footer = `Generado por Alfa-Doc — ${new Date().toLocaleString()}`
  // doc.text(footer, marginLeft, footerY)
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
  doc.setPage(i)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  doc.setTextColor(120)

  const posY = doc.internal.pageSize.getHeight() - 18
  const pageWidth = doc.internal.pageSize.getWidth()

  doc.text(
    `Generado por Alfa-Doc · ${new Date().toLocaleDateString()}`,
    40,
    posY
  )

  doc.text(
    `Página ${i} de ${pageCount}`,
    pageWidth - 40,
    posY,
    { align: "right" }
  )
}

  return doc.output("blob")
}
