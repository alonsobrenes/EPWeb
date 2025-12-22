import autoTable from "jspdf-autotable";
import { createBaseReport } from "./reportTemplate";
import { tryGetOrgId } from "../utils/identity";

function pick(obj, keys, fallback = "") {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return fallback;
}

function isoToUtcYmd(iso) {
  const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  return { y, m, d };
}

function formatYmdEs({ y, m, d }) {
  return `${d}/${m}/${y}`;
}

function toEsDateOrDash(v) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-CR");
}

function buildPersonName(first, last1, last2) {
  return [first, last1, last2].filter(Boolean).join(" ").trim();
}

function formatPatientName(r) {
  const first = pick(
    r,
    [
      "patientFirstName",
      "PatientFirstName",
      "patient_first_name",
      "firstName",
      "FirstName",
    ],
    ""
  );
  const last1 = pick(
    r,
    [
      "patientLastName1",
      "PatientLastName1",
      "patient_last_name1",
      "lastName1",
      "LastName1",
    ],
    ""
  );
  const last2 = pick(
    r,
    [
      "patientLastName2",
      "PatientLastName2",
      "patient_last_name2",
      "lastName2",
      "LastName2",
    ],
    ""
  );
  const full = buildPersonName(first, last1, last2);
  return full || "Paciente";
}

function formatClinicianLabel(r) {
  const full = pick(r, ["clinicianFullName", "ClinicianFullName"], "").trim();
  const email = pick(r, ["clinicianEmail", "ClinicianEmail"], "").trim();
  if (full && email) return `${full} — ${email}`;
  if (full) return full;
  if (email) return email;
  const id = pick(r, ["clinicianUserId", "ClinicianUserId"], "");
  return id ? `Profesional #${id}` : "Profesional";
}

function deriveVisitType(r) {
  const tests = Number(pick(r, ["testsCount", "TestsCount"], 0)) || 0;
  const interviews =
    Number(pick(r, ["interviewsCount", "InterviewsCount"], 0)) || 0;
  const sessions = Number(pick(r, ["sessionsCount", "SessionsCount"], 0)) || 0;
  const contacts = Number(pick(r, ["contactsCount", "ContactsCount"], 0)) || 0;

  // prioridad
  if (tests > 0) return "Evaluación";
  if (interviews > 0) return "Entrevista";
  if (sessions > 0) return "Sesión";
  if (contacts > 0) return "Contacto";
  return "—";
}

function formatIdentification(r) {
  // Ajusta estas keys a tu DTO real si usas otro nombre
  return pick(
    r,
    [
      "identificationNumber",
      "IdentificationNumber",
      "patientIdentificationNumber",
      "patient_identification_number",
      "patientIdNumber",
    ],
    "—"
  );
}

export async function generateOrgPatientsByProfessionalPdf({
  stats,
  fromIso,
  toIso,
}) {
  if (!stats) throw new Error("No hay estadísticas para generar el PDF.");

  const orgId = tryGetOrgId();
  const orgLogoBase64 = orgId ? localStorage.getItem(`ep:logo:${orgId}`) : null;

  const fromYmd = isoToUtcYmd(fromIso);

  // toIso exclusivo -> label inclusivo restando 1 día
  const toYmdRaw = isoToUtcYmd(toIso);
  const toExclusiveUtc = new Date(
    Date.UTC(toYmdRaw.y, toYmdRaw.m - 1, toYmdRaw.d)
  );
  toExclusiveUtc.setUTCDate(toExclusiveUtc.getUTCDate() - 1);
  const toYmd = {
    y: toExclusiveUtc.getUTCFullYear(),
    m: toExclusiveUtc.getUTCMonth() + 1,
    d: toExclusiveUtc.getUTCDate(),
  };

  const rangeLabel = `Período: ${formatYmdEs(fromYmd)} – ${formatYmdEs(toYmd)}`;

  const base = createBaseReport({
    title: "Actividad por profesional",
    subtitle: rangeLabel,
    orgLogoBase64,
  });

  const { doc, marginLeft } = base;
  let cursorY = base.y + 12;

  const details = Array.isArray(stats.details) ? stats.details : [];
  const totalUniquePatients = Number(stats.totalUniquePatients ?? 0) || 0;
  const totalContacts = Number(stats.totalContacts ?? 0) || 0;

  // Resumen (misma línea que clinician-style)
  doc.setFontSize(11);
  doc.text("Resumen del período", marginLeft, cursorY);
  cursorY += 14;

  doc.setFontSize(10);
  doc.text(
    `Total de pacientes únicos: ${totalUniquePatients}`,
    marginLeft,
    cursorY
  );
  cursorY += 12;
  doc.text(
    `Total de contactos clínicos: ${totalContacts}`,
    marginLeft,
    cursorY
  );
  cursorY += 18;

  // Agrupar por profesional usando details (es donde está el detalle por paciente)
  const byClinician = new Map();
  for (const r of details) {
    const cid = pick(r, ["clinicianUserId", "ClinicianUserId"], null);
    if (cid === null || cid === "") continue;
    if (!byClinician.has(cid)) byClinician.set(cid, []);
    byClinician.get(cid).push(r);
  }

  const clinicianIds = Array.from(byClinician.keys());

  doc.setFontSize(11);
  doc.text("Detalle por profesional", marginLeft, cursorY);
  cursorY += 15;

  if (clinicianIds.length === 0) {
    doc.setFontSize(10);
    doc.text(
      "No hay datos de detalle para el período seleccionado.",
      marginLeft,
      cursorY
    );
    return doc.output("blob");
  }

  // Orden estable por label
  clinicianIds.sort((a, b) => {
    const la = formatClinicianLabel(byClinician.get(a)?.[0]);
    const lb = formatClinicianLabel(byClinician.get(b)?.[0]);
    return la.localeCompare(lb);
  });

  for (const cid of clinicianIds) {
    const rows = byClinician.get(cid) || [];
    const header = formatClinicianLabel(rows[0]);

    doc.setFontSize(10);
    doc.text(header, marginLeft, cursorY);
    cursorY += 6;

    // Tabla: FECHA | PACIENTE | IDENTIFICACIÓN | TIPO | CONTACTOS
    const body = rows.map((r) => {
      const date = toEsDateOrDash(pick(r, ["date", "Date"], null));
      const patientName = formatPatientName(r);
      const ident = formatIdentification(r);
      const type = deriveVisitType(r);
      //   const contacts = String(
      //     Number(pick(r, ["contactsCount", "ContactsCount"], 0)) || 0
      //   );

      return [date, patientName, ident, type];
    });

    autoTable(doc, {
      startY: cursorY,
      margin: { left: marginLeft },
      head: [["Fecha", "Paciente", "Identificación", "Tipo de visita"]],
      body,

      // mismo estilo base que el clinician (sin rellenos)
      styles: { fontSize: 10, cellPadding: 3, textColor: 20 },
      headStyles: {
        fontSize: 11,
        fontStyle: "bold",
        fillColor: null,
        textColor: 20,
      },
      bodyStyles: { fillColor: null, textColor: 20 },
      alternateRowStyles: { fillColor: null },
      tableLineColor: 150,
      tableLineWidth: 0.1,
      columnStyles: {
        4: { halign: "right" },
      },
    });

    cursorY = (doc.lastAutoTable?.finalY ?? cursorY) + 16;
  }

  return doc.output("blob");
}
