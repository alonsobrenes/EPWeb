// src/reports/generateAttemptPdf.js
import jsPDF from "jspdf";

/**
 * args:
 *  - scoringMode: 'clinician' | 'automatic'
 *  - patientName, patientId, testName, attemptId, dateIso
 *  - answers: arreglo crudo (compatibilidad)
 *  - pdfModel:
 *      kind: 'general' | 'triads' | 'sacks'
 *      general: { columns: string[], rows: {code,text,marks:{label->true},openText}[] }
 *      triads:  { rows: {code, optionTexts:[a,b,c], marks:[bool,bool,bool]}[] }
 *      sacks:   { sections: {code,name,rows:{code,text,answerText}[]}[] }
 */
export async function generateAttemptPdf(args) {
  const {
    scoringMode = "automatic",
    patientName = "",
    patientId = "",
    testName = "Evaluación",
    attemptId = "",
    dateIso = new Date().toISOString(),
    pdfModel,
  } = args || {};

  const doc = new jsPDF({ unit: "mm", format: "letter" }); // 216 x 279.4 mm aprox
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // ==== estilos ====
  const M = { l: 14, r: 14, t: 16, b: 16 };
  const GRID = "#e3e3e3";
  const HEADER_BG = "#efefef";
  const HEADER_TX = [0, 0, 0];

  // util: fecha legible
  const dateText = new Date(dateIso).toLocaleString();

  // util: dividir texto según ancho
  function wrap(text, width, fontSize = 10) {
    doc.setFontSize(fontSize);
    const t = (text || "").toString();
    return doc.splitTextToSize(t, width);
  }
  function lineHeight(fontSize = 10) {
    return fontSize * 0.5 + 3; // heurística agradable
  }

  // util: salto de página si no cabe una fila de alto 'h'
  let y = M.t;
  function ensure(h, headerDrawer) {
    if (y + h > pageH - M.b) {
      doc.addPage();
      y = M.t;
      headerDrawer?.();
    }
  }

  // ======= encabezado del reporte =======
  function drawReportHeader() {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text(testName, M.l, y);
    y += 6;

    doc.setDrawColor(0);
    doc.setLineWidth(0.4);
    doc.line(M.l, y + 2, pageW - M.r, y + 2);
    y += 8;

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Paciente:", M.l, y);
    doc.setFont("helvetica", "normal");
    doc.text(patientName || "-", M.l + 26, y);

    doc.setFont("helvetica", "bold");
    doc.text("ID Paciente:", pageW / 2, y);
    doc.setFont("helvetica", "normal");
    doc.text(patientId || "-", pageW / 2 + 28, y);
    y += 6;

    doc.setFont("helvetica", "bold");
    doc.text("Intento:", M.l, y);
    doc.setFont("helvetica", "normal");
    doc.text(attemptId || "-", M.l + 26, y);

    doc.setFont("helvetica", "bold");
    doc.text("Fecha:", pageW / 2, y);
    doc.setFont("helvetica", "normal");
    doc.text(dateText, pageW / 2 + 28, y);
    y += 6;

    doc.setFont("helvetica", "bold");
    doc.text("Modo:", M.l, y);
    doc.setFont("helvetica", "normal");
    doc.text(capitalize(scoringMode), M.l + 26, y);
    y += 8;
  }
  function capitalize(s) {
    const t = (s || "").toString();
    return t ? t.charAt(0).toUpperCase() + t.slice(1).toLowerCase() : t;
  }

  // ======= encabezado de tabla genérico =======
  function drawHeaderRow(cols, heights = 9) {
    // Fondo
    doc.setFillColor(HEADER_BG);
    doc.setDrawColor(GRID);
    doc.setTextColor(...HEADER_TX);
    doc.setLineWidth(0.2);
    let x = M.l;
    for (const c of cols) {
      doc.rect(x, y, c.w, heights, "F"); // fill
      x += c.w;
    }
    // Borde inferior
    doc.setDrawColor(GRID);
    doc.line(M.l, y + heights, M.l + cols.reduce((s, c) => s + c.w, 0), y + heights);

    // Títulos
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    let tx = M.l + 2;
    for (const c of cols) {
      const lines = wrap(c.title, c.w - 4, 10);
      const th = Math.min(heights - 2, lines.length * lineHeight(10));
      doc.text(lines, tx, y + 6, { baseline: "middle" });
      tx += c.w;
    }
    y += heights;
  }

  // ======= tabla GENERAL (Sí/No, Likert, multi + texto abierto) =======
  function drawGeneral(model) {
    const columns = model.columns || [];
    const minOptW = 16;
    const maxOptW = 22;

    const codeW = 20;
    const openTextCol = model.rows.some(r => r.openText && r.openText.trim()) ? 40 : 0;

    const maxWidthAvail = pageW - M.l - M.r;
    let optW = Math.max(minOptW, Math.min(maxOptW, Math.floor((maxWidthAvail - codeW - 60 - openTextCol) / Math.max(1, columns.length))));
    // Ajustar pregunta con el resto
    const usedByOpts = optW * columns.length + codeW + openTextCol;
    const questionW = Math.max(60, maxWidthAvail - usedByOpts);

    const cols = [
      { key: "code", title: "Código", w: codeW },
      { key: "text", title: "Pregunta", w: questionW },
      ...columns.map(label => ({ key: `opt:${label}`, title: label, w: optW })),
    ];
    if (openTextCol) cols.push({ key: "open", title: "Respuesta (texto)", w: openTextCol });

    const drawHeader = () => drawHeaderRow(cols);
    drawHeader();

    for (const row of model.rows) {
      // Calcular alto por número de líneas de la pregunta (y/o openText)
      const qLines = wrap(row.text || "", questionW - 4, 10).length;
      const extra = openTextCol ? wrap(row.openText || "", openTextCol - 4, 10).length : 1;
      const h = Math.max(9, Math.max(qLines, extra) * lineHeight(10) + 2);

      ensure(h, drawHeader);
      let x = M.l;

      // Dibujar celdas + contenido
      doc.setDrawColor(GRID);
      doc.setLineWidth(0.2);
      for (const c of cols) {
        doc.rect(x, y, c.w, h, "S");
        x += c.w;
      }

      // Texto
      let tx = M.l + 2;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      // code
      doc.text(row.code || "", tx, y + 5);
      tx += codeW;

      // pregunta
      doc.text(wrap(row.text || "", questionW - 4, 10), tx, y + 5);
      tx += questionW;

      // opciones
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      for (const label of columns) {
        const mark = row.marks?.[label] ? "X" : "";
        const cx = tx + optW / 2;
        const cy = y + h / 2 + 0.5;
        if (mark) doc.text(mark, cx, cy, { align: "center", baseline: "middle" });
        tx += optW;
      }

      // open text
      if (openTextCol) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.text(wrap(row.openText || "", openTextCol - 4, 10), tx, y + 5);
      }

      y += h;
    }
  }

  // ======= tabla TRIADS (3 opciones por fila, estilo CDI) =======
  function drawTriads(model) {
    const codeW = 20;
    const answers = 3;

    const maxWidthAvail = pageW - M.l - M.r;
    // Damos 18mm a cada columna de respuesta (y ajustamos si no cabe)
    let optW = 18;
    let optionsBlock = optW * answers;
    if (codeW + optionsBlock + 60 > maxWidthAvail) {
      optW = Math.max(14, Math.floor((maxWidthAvail - codeW - 60) / answers));
      optionsBlock = optW * answers;
    }
    const questionW = maxWidthAvail - codeW - optionsBlock;

    const cols = [
      { key: "code", title: "Código", w: codeW },
      { key: "opts", title: "Opciones (elige una)", w: questionW },
      { key: "a", title: "", w: optW },
      { key: "b", title: "", w: optW },
      { key: "c", title: "", w: optW },
    ];

    const drawHeader = () => drawHeaderRow(cols);
    drawHeader();

    for (const row of model.rows) {
      // 3 líneas de opciones (forzamos cada una en renglones separados)
      const lines = [
        ...wrap(row.optionTexts?.[0] || "", questionW - 4, 10),
        ...wrap(row.optionTexts?.[1] || "", questionW - 4, 10),
        ...wrap(row.optionTexts?.[2] || "", questionW - 4, 10),
      ];
      const h = Math.max(12, Math.max(lines.length, 3) * lineHeight(10) + 2);

      ensure(h, drawHeader);

      // grid
      doc.setDrawColor(GRID);
      doc.setLineWidth(0.2);
      let x = M.l;
      for (const c of cols) {
        doc.rect(x, y, c.w, h, "S");
        x += c.w;
      }

      // columna de código
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(row.code || "", M.l + 2, y + 5);

      // columna de opciones (bloque de 3 líneas)
      const qx = M.l + codeW + 2;
      let qy = y + 5;
      doc.text(wrap(row.optionTexts?.[0] || "", questionW - 4, 10), qx, qy);
      qy += lineHeight(10) * Math.max(1, wrap(row.optionTexts?.[0] || "", questionW - 4, 10).length);
      doc.text(wrap(row.optionTexts?.[1] || "", questionW - 4, 10), qx, qy);
      qy += lineHeight(10) * Math.max(1, wrap(row.optionTexts?.[1] || "", questionW - 4, 10).length);
      doc.text(wrap(row.optionTexts?.[2] || "", questionW - 4, 10), qx, qy);

      // “X” centrada en la celda seleccionada (ligeramente más pequeña que en general)
      const markSize = 11;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(markSize);
      const startAnsX = M.l + codeW + questionW;
      for (let i = 0; i < 3; i++) {
        const sel = !!row.marks?.[i];
        if (sel) {
          const cx = startAnsX + i * optW + optW / 2;
          const cy = y + h / 2 + 0.5;
          doc.text("X", cx, cy, { align: "center", baseline: "middle" });
        }
      }

      y += h;
    }
  }

  // ======= tabla SACKS (toda la batería, sin “_____” en el ítem) =======
  function drawSacks(model) {
    const codeW = 20;
    const maxWidthAvail = pageW - M.l - M.r;

    for (const sec of model.sections || []) {
      // Título de sección
      ensure(10);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text(`${sec.code ? sec.code + " — " : ""}${sec.name || ""}`, M.l, y + 6);
      y += 10;

      // Calcular anchos: Item + Respuesta
      const answerW = 60; // respuesta amplia
      const itemW = Math.max(60, maxWidthAvail - codeW - answerW);

      const cols = [
        { key: "code", title: "Código", w: codeW },
        { key: "item", title: "Ítem", w: itemW },
        { key: "ans", title: "Respuesta", w: answerW },
      ];
      const drawHeader = () => drawHeaderRow(cols);
      drawHeader();

      for (const r of sec.rows || []) {
        const cleanText = (r.text || "").replace(/_+/g, " "); // quitar guiones bajos
        const itemLines = wrap(cleanText, itemW - 4, 10);
        const ansLines = wrap(r.answerText || "", answerW - 4, 10);
        const h = Math.max(9, Math.max(itemLines.length, ansLines.length) * lineHeight(10) + 2);

        ensure(h, drawHeader);

        // grid
        doc.setDrawColor(GRID);
        doc.setLineWidth(0.2);
        let x = M.l;
        for (const c of cols) {
          doc.rect(x, y, c.w, h, "S");
          x += c.w;
        }

        // code
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.text(r.code || "", M.l + 2, y + 5);

        // item
        doc.text(itemLines, M.l + codeW + 2, y + 5);

        // respuesta
        doc.text(ansLines, M.l + codeW + itemW + 2, y + 5);

        y += h;
      }
    }
  }

  // ========= RENDER =========
  drawReportHeader();

  if (!pdfModel || !pdfModel.kind) {
    // Fallback mínimo si algo vino mal
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.text("No hay datos para mostrar.", M.l, y + 10);
  } else if (pdfModel.kind === "general") {
    drawGeneral(pdfModel);
  } else if (pdfModel.kind === "triads") {
    drawTriads(pdfModel);
  } else if (pdfModel.kind === "sacks") {
    drawSacks(pdfModel);
  }

  // Descargar
  const safeName = `${testName}`.replace(/[^\w\-]+/g, "_");
  doc.save(`${safeName}.pdf`);
}
