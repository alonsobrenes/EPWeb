// src/api/sessionsApi.js
import client from './client'

export const SessionsApi = {
  // Lista por paciente (paginada) — GET /api/patients/{patientId}/sessions?skip=&take=&search=
  async listByPatient(patientId, { skip = 0, take = 20, search = '' } = {}) {
    const { data } = await client.get(`/patients/${patientId}/sessions`, {
      params: { skip, take, search }
    })
    return data
  },

  // Crear — POST /api/patients/{patientId}/sessions
  async create(patientId, { title, contentText }) {
    const { data } = await client.post(`/patients/${patientId}/sessions`, {
      title,
      contentText: contentText ?? null
    })
    return data
  },

  // Detalle — GET /api/patients/{patientId}/sessions/{id}
  async get(patientId, id) {
    const { data } = await client.get(`/patients/${patientId}/sessions/${id}`)
    return data
  },

  // Actualizar — PUT /api/patients/{patientId}/sessions/{id}
  async update(patientId, id, { title, contentText }) {
    await client.put(`/patients/${patientId}/sessions/${id}`, {
      title,
      contentText: contentText ?? null
    })
  },

  // Eliminar — DELETE /api/patients/{patientId}/sessions/{id}
  async remove(patientId, id) {
    await client.delete(`/patients/${patientId}/sessions/${id}`)
  },

  // IA (persistencia/gating según backend):
  // Ordenar (IA) — POST /api/patients/{patientId}/sessions/{id}/ai-tidy  { text?: string }
  async aiTidy(patientId, id, text) {
        // Si viene texto -> persistimos; si no, usamos el endpoint auto (genera y persiste)
    if (text === undefined || text === null || String(text).trim() === '') {
      const { data } = await client.post(`/patients/${patientId}/sessions/${id}/ai-tidy/auto`)
      return data
    }
    const { data } = await client.post(`/patients/${patientId}/sessions/${id}/ai-tidy`, { text })
    return data
  },
  // Opinión (IA) — POST /api/patients/{patientId}/sessions/{id}/ai-opinion  { text?: string }
  async aiOpinion(patientId, id, text) {
        // Si viene texto -> persistimos; si no, usamos el endpoint auto (genera y persiste)
    if (text === undefined || text === null || String(text).trim() === '') {
      const { data } = await client.post(`/patients/${patientId}/sessions/${id}/ai-opinion/auto`)
      return data
    }
    const { data } = await client.post(`/patients/${patientId}/sessions/${id}/ai-opinion`, { text })
    return data
  },

  // Exportar TXT — GET /api/patients/{patientId}/sessions/{id}/export
  async exportTxt(patientId, id, filename = `session-${id}.txt`) {
    const { data } = await client.get(`/patients/${patientId}/sessions/${id}/export`, { responseType: 'blob' })
    return { blob: data, filename }
  },

  // Etiquetas (genéricos existentes)
  async getLabelsFor(sessionId) {
    const { data } = await client.get('/labels/for', { params: { type: 'session', id: sessionId } })
    return data
  },
  async assignLabel(sessionId, labelId) {
    await client.post('/labels/assign', { labelId, targetType: 'session', targetId: sessionId })
  },
  async unassignLabel(sessionId, labelId) {
    await client.post('/labels/unassign', { labelId, targetType: 'session', targetId: sessionId })
  },

  // Quotas IA del período — GET /api/patients/{patientId}/sessions/ai-quotas
  async getAiQuotas(patientId) {
    const { data } = await client.get(`/patients/${patientId}/sessions/ai-quotas`)
    return data
  }
}

export default SessionsApi
