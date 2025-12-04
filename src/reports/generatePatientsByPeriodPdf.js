// src/pdf/generatePatientsByPeriodPdf.js
import autoTable from "jspdf-autotable"
import { createBaseReport } from "./reportTemplate"
import { tryGetOrgId } from "../utils/identity"
/**
 * Genera un PDF con el resumen + detalle de pacientes atendidos en un período dado.
 */

function isoToUtcYmd(iso) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number)
  return { y, m, d }
}

function formatYmdEs({ y, m, d }) {
  return `${d}/${m}/${y}`
}

export async function generatePatientsByPeriodPdf({ stats, fromIso, toIso }) {

  if (!stats) {
    throw new Error("No hay estadísticas para generar el PDF.")
  }
  const orgId = tryGetOrgId()
  const orgLogoBase64 = orgId
      ? localStorage.getItem(`ep:logo:${orgId}`)
      : null
  const fromYmd = isoToUtcYmd(fromIso)

  // 🔹 toIso: límite EXCLUSIVO -> restamos 1 día en UTC para mostrar en el label
  const toYmdRaw = isoToUtcYmd(toIso)
  const toExclusiveUtc = new Date(Date.UTC(toYmdRaw.y, toYmdRaw.m - 1, toYmdRaw.d))
  toExclusiveUtc.setUTCDate(toExclusiveUtc.getUTCDate() - 1)
  const toYmd = {
    y: toExclusiveUtc.getUTCFullYear(),
    m: toExclusiveUtc.getUTCMonth() + 1,
    d: toExclusiveUtc.getUTCDate(),
  }

  const fromLabel = formatYmdEs(fromYmd)
  const toLabel = formatYmdEs(toYmd)
  const rangeLabel = `Período: ${fromLabel} – ${toLabel}`
  // Usamos el template corporativo consistente (igual que los tests)
  const base = createBaseReport({
    title: "Pacientes atendidos",
    subtitle: rangeLabel,
    orgLogoBase64: orgLogoBase64,
  })

  const { doc, marginLeft } = base

  // Punto de inicio correcto después del header del template
  let cursorY = base.y + 12

  // ------------------------------
  // Resumen del período
  // ------------------------------
  doc.setFontSize(11)
  doc.text("Resumen del período", marginLeft, cursorY)
  cursorY += 14

  doc.setFontSize(10)
  doc.text(
    `Total de pacientes únicos atendidos: ${stats.totalUniquePatients ?? 0}`,
    marginLeft,
    cursorY
  )
  cursorY += 12

  doc.text(
    `Total de contactos clínicos (sesiones, tests, entrevistas): ${stats.totalContacts ?? 0}`,
    marginLeft,
    cursorY
  )
  cursorY += 18

  doc.setFontSize(9)
  doc.text(
    "Nota: Se consideran como contactos clínicos las sesiones, entrevistas y aplicaciones de test registradas en el sistema.",
    marginLeft,
    cursorY
  )
  cursorY += 20

  // ------------------------------
  // Tabla de detalle
  // ------------------------------
  const details = stats.details ?? []

  const tableBody = details.map((r) => {
    const d = new Date(r.date)
    return [
      d.toLocaleDateString("es-CR"),
      `${r.firstName ?? ""} ${r.lastName1 ?? ""} ${r.lastName2 ?? ""}`.trim(),
      r.identificationNumber ?? "–",
      String(r.contactsCount ?? 0),
    ]
  })

  // Título de la tabla
  doc.setFontSize(11)
  doc.text("Detalle por paciente y fecha", marginLeft, cursorY)
  cursorY += 8

  // Estilo EXACTO igual al SSCT:
  // - Header bold SIN fondo
  // - Filas sin background alterno
  // - Todo texto negro
  // - Padding cómodo
  autoTable(doc, {
    startY: cursorY,
    margin: { left: marginLeft },
    head: [["Fecha", "Paciente", "Identificación", "Contactos"]],
    body: tableBody,

    styles: {
      fontSize: 10,
      cellPadding: 3,
      textColor: 20,
    },
    headStyles: {
      fontSize: 11,
      fontStyle: "bold",
      fillColor: null,   // << SIN fondo
      textColor: 20,
    },
    bodyStyles: {
      fillColor: null,   // << SIN gris alterno
      textColor: 20,
    },
    alternateRowStyles: {
      fillColor: null,   // << asegurar que no pinte nada
    },
    tableLineColor: 150,
    tableLineWidth: 0.1,
  })

  // Footer corporativo del template (ya incluido en createBaseReport)
  // No tenemos que agregar nada aquí — el template ya lo pone al finalizar la página.

  return doc.output("blob")
}
