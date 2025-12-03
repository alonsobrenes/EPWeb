// src/utils/generateAttemptPdf.js
import { createBaseReport } from "./reportTemplate"
import { tryGetOrgId } from "../utils/identity"

/**
 * Genera un PDF con los resultados de un intento de test psicológico.
 *
 * @param {object} args
 * @param {string} args.scoringMode - 'auto', 'clinician', etc.
 * @param {string} args.patientName
 * @param {string|number} args.patientId
 * @param {string} args.testName
 * @param {string|number} args.attemptId
 * @param {string} args.dateIso - ISO string de la fecha del intento
 * @param {Array<object>} args.answers - respuestas crudas (ClinicianApi.getAttemptAnswers)
 * @param {object|null} args.pdfModel - modelo opcional (por ejemplo SACKS)
 * @param {object|null} args.results - { totalRaw, totalPercent, totalMax?, totalMin?, scales? }
 * @param {boolean} [args.includeAnswers] - si true, agrega Sección II con respuestas
 */
export function generateAttemptPdf({
  scoringMode,
  patientName,
  patientId,
  testName,
  attemptId,
  dateIso,
  answers,
  pdfModel,
  results,
  includeAnswers,
}) {
  const orgId = tryGetOrgId()
  const orgLogoBase64 = orgId
    ? localStorage.getItem(`ep:logo:${orgId}`)
    : null
  const safePatientName = (patientName || "").trim() || "(sin nombre)"
  const safePatientId =
    (patientId != null && String(patientId).trim()) || "(sin identificación)"

  const testTitle =
    (testName || "").trim() || "Resultado de prueba psicológica"

  const dt = dateIso ? new Date(dateIso) : new Date()
  const attemptDateText = dt.toLocaleString()

  const scoringLabel = (() => {
    if (!scoringMode) return ""
    const s = String(scoringMode).toLowerCase()
    if (s === "auto" || s === "automatic") return "Puntuación automática"
    if (s === "clinician") return "Puntuación clínica"
    return `Modo de puntuación: ${scoringMode}`
  })()

  // ---------------------------
  // PLANTILLA BASE (LOGO + TÍTULO + ENCABEZADO)
  // ---------------------------
  const {
    doc,
    marginLeft,
    maxWidth,
    pageHeight,
    y: startY,
  } = createBaseReport({
    title: testTitle,
    subtitle: scoringLabel || "Informe de resultados de prueba psicológica",
    orgName: undefined, // deja que el template use alfa-doc.com por defecto
    orgLogoBase64,
    infoRows: [
      {
        label: "Nombre de la persona evaluada:",
        value: safePatientName,
      },
      {
        label: "Identificación:",
        value: safePatientId,
      },
      {
        label: "Fecha del intento:",
        value: attemptDateText,
      },
      {
        label: "ID del intento:",
        value: String(attemptId || ""),
      },
      scoringLabel
        ? {
            label: "Modo de puntuación:",
            value: scoringLabel,
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
      fontSize = 11,
    } = opts

    if (!text) return

    y = ensureSpace(doc, y, before + 20)
    y += before

    doc.setFont("helvetica", bold ? "bold" : "normal")
    doc.setFontSize(fontSize)
    const lines = doc.splitTextToSize(text, maxWidth)
    doc.text(lines, marginLeft, y)
    y += lines.length * 12 + lineGap + after
  }

  // Helper título de sección
  const writeSectionTitle = (title) => {
    y = ensureSpace(doc, y, 28)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(13)
    doc.text(title, marginLeft, y)
    y += 18
  }

  // ---------------------------
  // SECCIÓN I — RESULTADOS DEL TEST
  // ---------------------------
  const safeResults = results || {}
  const totalRaw =
    typeof safeResults.totalRaw === "number"
      ? safeResults.totalRaw
      : null
  const totalPercent =
    typeof safeResults.totalPercent === "number"
      ? safeResults.totalPercent
      : null
  const scales = Array.isArray(safeResults.scales)
    ? safeResults.scales
    : []

  // Intentar determinar totalMin / totalMax desde el propio results o desde una escala "TOTAL"
  let totalMin =
    typeof safeResults.totalMin === "number"
      ? safeResults.totalMin
      : null
  let totalMax =
    typeof safeResults.totalMax === "number"
      ? safeResults.totalMax
      : null

  if ((totalMin == null || totalMax == null) && scales.length > 0) {
    const totalScale = scales.find((s) => {
      const code = (s.scaleCode || s.scale_code || "").toUpperCase()
      const name = (s.scaleName || s.scale_name || "").toUpperCase()
      return code === "TOTAL" || name.startsWith("TOTAL")
    })
    if (totalScale) {
      if (typeof totalScale.min === "number" && totalMin == null)
        totalMin = totalScale.min
      if (typeof totalScale.max === "number" && totalMax == null)
        totalMax = totalScale.max
    }
  }

  const hasAnyResult =
    totalRaw != null ||
    totalPercent != null ||
    (scales && scales.length > 0)
  if (hasAnyResult) {
    writeSectionTitle("SECCIÓN I — Resultados del test")

    // Resumen general
    if (totalRaw != null) {
      let resumen = `Puntaje total bruto: ${totalRaw.toFixed(2).replace(/\.00$/, "")}`
      if (totalMin != null && totalMax != null) {
        resumen += ` (rango posible: ${totalMin} – ${totalMax})`
      }
      writeParagraph(resumen, { bold: false, after: 4 })
    }

    if (totalPercent != null) {
      const pctText = `Puntaje total en porcentaje: ${totalPercent.toFixed(1)} %`
      writeParagraph(pctText, { bold: false, after: 10 })
    }

    // Tabla de escalas
    if (scales && scales.length > 0) {
      y = ensureSpace(doc, y, 32)
      doc.setFont("helvetica", "bold")
      doc.setFontSize(11)

      const colCode = marginLeft
      const colName = marginLeft + 120
      const colRaw = marginLeft + maxWidth - 150
      const colPct = marginLeft + maxWidth - 90
      const colRange = marginLeft + maxWidth - 10

      // Encabezados
      doc.text("Código", colCode, y)
      doc.text("Escala", colName, y)
      doc.text("Bruto", colRaw, y)
      doc.text("%", colPct, y)
      doc.text("Rango", colRange, y, { align: "right" })
      y += 16

      doc.setFont("helvetica", "normal")
      

      scales.forEach((s) => {
        y = ensureSpace(doc, y, 18)

        const code =
          (s.scaleCode || s.scale_code || "").trim() || "-"
        const name =
          (s.scaleName || s.scale_name || "").trim() || "-"
        const raw =
          typeof s.raw === "number"
            ? s.raw.toFixed(2).replace(/\.00$/, "")
            : "-"
        const pct =
          typeof s.percent === "number"
            ? `${s.percent.toFixed(1)} %`
            : "-"
        const min =
          typeof s.min === "number"
            ? s.min.toFixed(0)
            : null
        const max =
          typeof s.max === "number"
            ? s.max.toFixed(0)
            : null
        const range =
          min != null && max != null ? `${min}–${max}` : "-"

        doc.setFontSize(9)
        doc.text(code, colCode, y)
        doc.setFontSize(10)
        doc.text(name, colName, y, {
          maxWidth: colRaw - colName - 10,
        })
        doc.text(String(raw), colRaw, y, { align: "left" })
        doc.text(pct, colPct, y, { align: "left" })
        doc.text(range, colRange, y, { align: "right" })

        y += 14
      })
    }
  }

  // ---------------------------
  // SECCIÓN II — RESPUESTAS DEL TEST (OPCIONAL)
  // ---------------------------
  const shouldIncludeAnswers = !!includeAnswers

  if (shouldIncludeAnswers) {
    const answersArray = Array.isArray(answers) ? answers : []

    // También soportamos modelo especial (por ejemplo SACKS)
    const isSacksModel = pdfModel && pdfModel.kind === "sacks"

    // Separador visual entre secciones
    y = ensureSpace(doc, y, 40)
    y += 10
    doc.setDrawColor(200)
    doc.line(marginLeft, y, marginLeft + maxWidth, y)
    y += 20

    writeSectionTitle("SECCIÓN II — Respuestas del test")

    // --- Caso especial: SACKS con pdfModel.sections ---
    if (
      isSacksModel &&
      Array.isArray(pdfModel.sections) &&
      pdfModel.sections.length > 0
    ) {
      pdfModel.sections.forEach((section, idxSection) => {
        const secTitleParts = []
        if (section.code) secTitleParts.push(`[${section.code}]`)
        if (section.name) secTitleParts.push(section.name)
        const secTitle =
          secTitleParts.join(" ") || `Sección ${idxSection + 1}`

        writeParagraph(secTitle, {
          bold: true,
          before: idxSection === 0 ? 4 : 10,
          after: 4,
        })

        const rows = Array.isArray(section.rows)
          ? section.rows
          : []
        rows.forEach((row, idxRow) => {
          const qParts = []
          if (row.code) qParts.push(row.code)
          if (row.text) qParts.push(row.text)
          const qLabel =
            qParts.join(" — ") || `Ítem ${idxRow + 1}`

          writeParagraph(qLabel, {
            bold: true,
            before: 2,
            after: 2,
            fontSize: 10,
          })

          const answerText =
            (row.answerText || "").trim() || "(sin respuesta)"
          writeParagraph(`Respuesta: ${answerText}`, {
            bold: false,
            before: 0,
            after: 6,
            fontSize: 10,
          })
        })
      })
    } else {
      // --- Caso genérico: cualquier test auto/clinician con answers crudas ---
      if (answersArray.length === 0) {
        writeParagraph("No se encontraron respuestas para este intento.", {
          bold: false,
          after: 10,
        })
      } else {
        answersArray.forEach((a, idx) => {
          const indexLabel = `${idx + 1}.`

          const qCode =
            (a.questionCode ||
              a.code ||
              a.question_code ||
              "").trim()
          const qText =
            (a.questionText ||
              a.question ||
              a.text ||
              "").trim()

          const questionParts = [indexLabel]
          if (qCode) questionParts.push(`[${qCode}]`)
          if (qText) questionParts.push(qText)

          const questionLabel =
            questionParts.join(" ") ||
            `${indexLabel} (ítem sin texto)`

          // Determinar texto de respuesta
          let ansText = ""
          if (a.answerText != null && String(a.answerText).trim()) {
            ansText = String(a.answerText).trim()
          } else if (
            typeof a.answerValue === "number" ||
            (typeof a.answerValue === "string" &&
              a.answerValue.trim())
          ) {
            ansText = String(a.answerValue).trim()
          } else if (
            Array.isArray(a.answerValues) &&
            a.answerValues.length > 0
          ) {
            ansText = a.answerValues
              .map((v) => String(v))
              .join(", ")
          } else if (
            Array.isArray(a.values) &&
            a.values.length > 0
          ) {
            ansText = a.values.map((v) => String(v)).join(", ")
          } else {
            ansText = "(sin respuesta)"
          }

          writeParagraph(questionLabel, {
            bold: true,
            before: idx === 0 ? 4 : 6,
            after: 2,
            fontSize: 10,
          })

          writeParagraph(`Respuesta: ${ansText}`, {
            bold: false,
            before: 0,
            after: 6,
            fontSize: 10,
          })
        })
      }
    }
  }

  // ---------------------------
  // FOOTER (igual que en generateConsentPdf)
  // ---------------------------
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
