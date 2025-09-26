// src/api/clinicianApi.js
import client from './client'

export const ClinicianApi = {
  // Escalas con sus ítems (para pintar la hoja)
  async getScalesWithItems(testId) {
    const { data } = await client.get(`/clinician/tests/${testId}/scales-with-items`)
    return data // { testId, scales: [{ id, code, name, parentScaleId, items:[...] }, ...] }
  },

  // Revisión (si existe) para prefilling
  async getReview(attemptId) {
    const { data } = await client.get(`/attempts/${attemptId}/review`)
    return data // { attemptId, review: {...} | null }
  },

  // Guardar borrador o final
  async upsertReview(attemptId, payload /* { isFinal, scales:[{scaleId,value,notes?}], summary? } */) {
    const { data } = await client.post(`/attempts/${attemptId}/review`, payload)
    return data // { attemptId, reviewId, isFinal }
  },
   async listAssessmentsByPatient(patientId, { page = 1, pageSize = 50 } = {}) {
    const { data } = await client.get(`/clinician/patients/${patientId}/assessments`, {
      params: { page, pageSize },
    })
    return data
  },
  async listPatientAttempts(patientId) {
    const { data } = await client.get(`/clinician/patients/${patientId}/attempts`)
    return data // [{ attemptId, testId, testCode, testName, scoringMode, status, startedAt, finishedAt, updatedAt, reviewFinalized }]
  },
  async deleteAttempt(attemptId) {
  // DELETE /api/clinician/attempts/{id}
  const { data } = await client.delete(`/clinician/attempts/${attemptId}`)
  return data ?? {}
  },
  async getAttemptAnswers(attemptId) {
    const { data } = await client.get(`/clinician/attempts/${attemptId}/answers`)
    // Normalizamos por si el backend devuelve {answers:[...]} o {items:[...]} o array directo
    if (Array.isArray(data)) return data
    if (Array.isArray(data?.answers)) return data.answers
    if (Array.isArray(data?.items)) return data.items
    return []
  },
  async logAutoAttempt({ testId, patientId, startedAtUtc }) {
    const { data } = await client.post('/clinician/attempts/log-auto', {
      testId, patientId, startedAtUtc
    })
    return data // { attemptId }
  },
  async saveAttemptAnswers(attemptId, items) {
  // items: [{questionId, answerText, answerValue, answerValues, createdAtUtc}]
  await client.post(`/clinician/attempts/${attemptId}/answers`, items)
  },

  // src/api/clinicianApi.js
async createAttempt({ testId, patientId = null, answers = [], startedAtUtc = null }) {
    // Normalizamos formato del DTO esperado por el backend:
    // AttemptAnswerWriteDto { questionId, text, value, valuesJson }
    const normAnswers = Array.isArray(answers) ? answers.map(a => ({
      questionId: a.questionId ?? a.question_id ?? a.id,
      text: a.text ?? null,
      value: a.value != null ? String(a.value) : null,
      valuesJson: Array.isArray(a.values) && a.values.length
        ? JSON.stringify(a.values.map(String))
        : (a.valuesJson ?? null),
    })) : []

    const body = {
      testId,
      patientId,
      startedAtUtc,   // opcional
      answers: normAnswers,
    }

    const { data } = await client.post('/clinician/attempts', body)
    return data // { attemptId }
  },

  async getAttemptMeta(attemptId) {
  const { data } = await client.get(`/clinician/attempts/${attemptId}/meta`)
  return data // { attemptId, testId, patientId, ... }
},
 async finalizeAttempt(attemptId) {
    await client.post(`/clinician/attempts/${attemptId}/finalize`)
  },

  // === AI Opinion per Attempt ===
async getAttemptAiOpinion(attemptId) {
  const { data } = await client.get(`/clinician/attempts/${attemptId}/ai-opinion`)
  // backend devuelve {} si no hay registro
  return data || {}
},

/**
 * Upsert AI opinion for an attempt.
 * Acepta payload flexible; normalizamos a lo que pide el backend:
 * { patientId?, opinionText? | text?, opinionJson?, modelVersion?, promptVersion?, inputHash?, riskLevel? }
 * Si no viene patientId, lo obtenemos con getAttemptMeta(attemptId).
 */
async upsertAttemptAiOpinion(attemptId, payload = {}) {
  // Normalización de claves
  const body = {
    patientId: payload.patientId ?? payload.PatientId ?? null,
    opinionText: payload.opinionText ?? payload.text ?? null,
    opinionJson: payload.opinionJson ?? null,
    modelVersion: payload.modelVersion ?? null,
    promptVersion: payload.promptVersion ?? null,
    inputHash: payload.inputHash ?? null,
    riskLevel: payload.riskLevel ?? null,
  }

  // Asegurar patientId (requerido por el backend)
  if (!body.patientId) {
    try {
      const meta = await this.getAttemptMeta(attemptId)
      body.patientId = meta?.patientId ?? meta?.patient_id ?? null
    } catch {}
  }
  if (!body.patientId) {
    throw new Error('patientId is required to save AI opinion')
  }

  await client.put(`/clinician/attempts/${attemptId}/ai-opinion`, body)
 },
 // src/api/clinicianApi.js
generateAttemptAiOpinion(attemptId, body = {}) {
  return client.post(`/clinician/attempts/${attemptId}/ai-opinion/auto`, body).then(r => r.data)
}



}

export default ClinicianApi
