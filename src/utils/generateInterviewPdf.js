import jsPDF from "jspdf"

export function generateInterviewPdf({ patient, interview, transcript, draft }) {
  const doc = new jsPDF({ unit: "pt", format: "a4" })
  let y = 40
  doc.setFont("helvetica", "bold")
  doc.text("Primera Entrevista (Borrador)", 40, y); y += 20
  doc.setFont("helvetica", "normal")
  doc.text(`Paciente: ${patient?.fullName || patient?.name || patient?.id || ""}`, 40, y); y += 16
  doc.text(`Entrevista: ${interview?.id || ""}`, 40, y); y += 16
  doc.text(`Fecha: ${new Date(interview?.startedAtUtc || Date.now()).toLocaleString()}`, 40, y); y += 24

  doc.setFont("helvetica", "bold"); doc.text("Transcripción:", 40, y); y += 16
  doc.setFont("helvetica", "normal")
  const tw = doc.splitTextToSize(transcript || "(sin transcripción)", 515)
  doc.text(tw, 40, y); y += 16 + tw.length * 12

  y += 12
  doc.setFont("helvetica", "bold"); doc.text("Borrador de diagnóstico (IA):", 40, y); y += 16
  doc.setFont("helvetica", "normal")
  const dw = doc.splitTextToSize(draft || "(sin borrador)", 515)
  doc.text(dw, 40, y)

  return doc.output("blob")
}
