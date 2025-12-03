// src/utils/buildAutoTestResults.js
import { ClinicianApi } from "../api/clinicianApi"
import { TestsApi } from "../api/testsApi"

/**
 * Calcula resultados para tests "auto" (no SACKS).
 * 1) Intenta usar el "run" de scoring del backend (TestsApi.getRun).
 * 2) Si no hay escalas válidas en el run, usa fallback local basado en escalas + items.
 *
 * params:
 *  - testId: ID del test
 *  - attemptId: ID del intento (para el run)
 *  - questions: arreglo normalizado de preguntas (con type, options, etc.)
 *  - answersByQ: { [questionId]: { text, value, values } }
 *
 * return:
 *  {
 *    totalRaw: number | null,
 *    totalPercent: number | null,
 *    scales: [
 *      {
 *        scaleId,
 *        scaleCode,
 *        scaleName,
 *        raw,
 *        min,
 *        max,
 *        percent
 *      },
 *      ...
 *    ]
 *  }
 */
export async function buildAutoTestResults({
  testId,
  attemptId,
  patientId,
  questions,
  answersByQ,
}) {
    const buildRunPayloadFromAnswers = () => {
    const norm = Array.isArray(questions) ? questions : []
    return norm.map((q) => {
      const r = answersByQ[q.id] || {}

      if (q.type === "open") {
        return {
          questionId: q.id,
          answerText: r.text ?? null,
          value: null,
          values: null,
        }
      }

      if (q.type === "single") {
        let v = r.value
        if (
          v != null &&
          typeof v === "string" &&
          /^\d+(?:\.\d+)?$/.test(v)
        ) {
          v = Number(v)
        }
        return {
          questionId: q.id,
          answerValue: v ?? null,
          value: v ?? null,
          values: null,
        }
      }

      const arr = Array.isArray(r.values)
        ? r.values.map((v) =>
            typeof v === "string" && /^\d+(?:\.\d+)?$/.test(v)
              ? Number(v)
              : v
          )
        : []

      return {
        questionId: q.id,
        answerValues: arr.length ? arr : null,
        value: null,
        values: arr.length ? arr : null,
      }
    })
  }
  // --------- 1) Intentar el RUN del backend ---------
  try {
    let run

    if (patientId != null) {
    // 🔹 Nuevo: usamos el MISMO camino que ReviewSimpleReadOnly
    const answers = buildRunPayloadFromAnswers()
    const nowIso = new Date().toISOString()

    run = await TestsApi.getRun({
        testId,
        patientId,
        startedAtUtc: nowIso,
        finishedAtUtc: nowIso,
        answers,
    })
    } else {
    // 🔹 Compat: si alguien más llama al helper sin patientId,
    // seguimos usando el run por attemptId
    run = await TestsApi.getRun(testId, attemptId)
    }

    const runScales = run?.scales || run?.Scales || []

    if (Array.isArray(runScales) && runScales.length > 0) {
      // Intentamos ser robustos con los nombres de propiedades
      const mappedScales = runScales.map((s) => {
        const scaleId =
          s.scaleId ?? s.id ?? s.ScaleId ?? s.Id ?? null
        const scaleCode =
          s.scaleCode ?? s.code ?? s.ScaleCode ?? s.Code ?? ""
        const scaleName =
          s.scaleName ?? s.name ?? s.ScaleName ?? s.Name ?? ""

        const raw =
          s.raw ??
          s.rawScore ??
          s.rawValue ??
          s.score ??
          s.Raw ??
          s.RawScore ??
          s.Score ??
          null

        const min =
          s.min ??
          s.minValue ??
          s.minScore ??
          s.Min ??
          s.MinValue ??
          s.MinScore ??
          null

        const max =
          s.max ??
          s.maxValue ??
          s.maxScore ??
          s.Max ??
          s.MaxValue ??
          s.MaxScore ??
          null

        const percent =
          s.percent ??
          s.percentage ??
          s.percentValue ??
          s.Percent ??
          s.Percentage ??
          s.PercentValue ??
          null

        return {
          scaleId,
          scaleCode,
          scaleName,
          raw: raw == null ? 0 : Number(raw),
          min: min == null ? 0 : Number(min),
          max: max == null ? 0 : Number(max),
          percent: percent == null ? null : Number(percent),
        }
      })

      // Totales: si el run trae totales, los usamos; si no, los calculamos
      const totalRaw =
        run.totalRaw ??
        run.rawTotal ??
        run.TotalRaw ??
        run.RawTotal ??
        mappedScales.reduce((acc, s) => acc + (s.raw ?? 0), 0)

      let totalPercent =
        run.totalPercent ??
        run.TotalPercent ??
        run.percentTotal ??
        run.PercentTotal ??
        null

      if (totalPercent == null) {
        // calculamos a partir de escalas si tienen min/max
        let sumNum = 0
        let count = 0
        for (const s of mappedScales) {
          if (
            s.percent != null &&
            Number.isFinite(s.percent)
          ) {
            sumNum += s.percent
            count++
          }
        }
        if (count > 0) {
          totalPercent = sumNum / count
        } else {
          totalPercent = null
        }
      }

      return {
        totalRaw: Number(totalRaw.toFixed(4)),
        totalPercent:
          totalPercent == null
            ? null
            : Number(totalPercent.toFixed(4)),
        scales: mappedScales,
      }
    }
  } catch {
    // Si el run falla, seguimos al fallback
  }

  // --------- 2) Fallback local (como en ReviewSimpleReadOnly) ---------
  const sw = await ClinicianApi.getScalesWithItems(testId)
  const scales = Array.isArray(sw?.scales) ? sw.scales : []
  const qById = new Map(questions.map((q) => [q.id, q]))

  const toNum = (v) => {
    if (v == null) return null
    if (typeof v === "number" && Number.isFinite(v)) return v
    const s = String(v).trim()
    if (/^-?\d+(?:[.,]\d+)?$/.test(s)) {
      return Number(s.replace(",", "."))
    }
    return null
  }

  function parseLikertSpec(rawType) {
    const t = String(rawType || "").toLowerCase().trim()
    if (!t.startsWith("likert")) return null

    let m = t.match(/likert[\s_-]*?(\d+)[\s_-]+(\d+)/)
    if (m) {
      const a = parseInt(m[1], 10)
      const b = parseInt(m[2], 10)
      if (
        Number.isFinite(a) &&
        Number.isFinite(b) &&
        b >= a
      ) {
        return { start: a, end: b }
      }
    }

    m = t.match(/likert[\s_-]*?(\d+)/)
    if (m) {
      const n = parseInt(m[1], 10)
      if (Number.isFinite(n) && n >= 2) {
        return { start: 1, end: n }
      }
    }

    return { start: 1, end: 4 }
  }

  function getQMinMax(q) {
    const opts = Array.isArray(q.options) ? q.options : []
    const nums = opts
      .map((o) => toNum(o.value))
      .filter((n) => n != null)

    if (q.type === "multi") {
      const pos = nums.filter((n) => n > 0)
      const max = pos.reduce((a, b) => a + b, 0)
      return { min: 0, max: max || 0 }
    }

    if (nums.length > 0) {
      return {
        min: Math.min(...nums),
        max: Math.max(...nums),
      }
    }

    const spec = parseLikertSpec(q.rawType || "")
    if (spec) return { min: spec.start, max: spec.end }

    const t = (q.rawType || "").toLowerCase()
    if (
      t === "yesno" ||
      t === "yes-no" ||
      t === "yes_no" ||
      t === "yn" ||
      t === "bool" ||
      t === "boolean"
    ) {
      return { min: 0, max: 1 }
    }

    if (
      (q.type === "single" || q.type === "multi") &&
      (opts.length === 3 || t.includes("triad"))
    ) {
      return { min: 1, max: 3 }
    }

    return { min: 1, max: 4 }
  }

  function getAnswerNumeric(q) {
    const ans = answersByQ[q.id] || {}

    if (q.type === "single") {
      const nv = toNum(ans.value)
      if (nv != null) return nv

      if (ans.text && Array.isArray(q.options)) {
        const opt = q.options.find(
          (o) =>
            String(o.label) === String(ans.text)
        )
        const nv2 = toNum(opt?.value)
        if (nv2 != null) return nv2
      }

      if (ans.value != null && Array.isArray(q.options)) {
        const opt = q.options.find(
          (o) =>
            String(o.value) === String(ans.value)
        )
        const nv3 = toNum(opt?.value)
        if (nv3 != null) return nv3
      }

      return null
    }

    if (q.type === "multi") {
      let values = Array.isArray(ans.values)
        ? ans.values.slice()
        : []
      if (
        !values.length &&
        typeof ans.answerValuesJson === "string"
      ) {
        try {
          const tmp = JSON.parse(ans.answerValuesJson)
          if (Array.isArray(tmp)) values = tmp
        } catch {}
      }

      if (!values.length) return 0
      const set = new Set(values.map((v) => String(v)))

      let sum = 0
      for (const opt of q.options || []) {
        const pick =
          set.has(String(opt.value)) ||
          set.has(String(opt.id)) ||
          set.has(String(opt.label))
        if (pick) {
          const nv = toNum(opt.value)
          if (nv != null) sum += nv
        }
      }
      return sum
    }

    return 0
  }

  const outScales = []
  let totalRaw = 0
  let totalMin = 0
  let totalMax = 0

  for (const s of scales) {
    const items = Array.isArray(s.items) ? s.items : []
    let raw = 0
    let min = 0
    let max = 0

    for (const it of items) {
      const q = qById.get(it.id)
      if (!q) continue

      const mm = getQMinMax(q)
      const val = getAnswerNumeric(q)
      const use = val == null ? mm.min : val

      raw += use
      min += mm.min
      max += mm.max
    }

    totalRaw += raw
    totalMin += min
    totalMax += max

    const percent =
      max > min
        ? ((raw - min) / (max - min)) * 100
        : null

    outScales.push({
      scaleId: s.id,
      scaleCode: s.code,
      scaleName: s.name,
      raw: Number(raw.toFixed(4)),
      min: Number(min.toFixed(4)),
      max: Number(max.toFixed(4)),
      percent:
        percent == null
          ? null
          : Number(percent.toFixed(4)),
    })
  }

  const totalPercent =
    totalMax > totalMin
      ? ((totalRaw - totalMin) /
          (totalMax - totalMin)) *
        100
      : null

  return {
    totalRaw: Number(totalRaw.toFixed(4)),
    totalPercent:
      totalPercent == null
        ? null
        : Number(totalPercent.toFixed(4)),
    scales: outScales,
  }
}
