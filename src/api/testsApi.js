// src/api/testsApi.js
import client from './client'

export const TestsApi = {
  // ===== Administración (catálogo general) =====
  async list({ page = 1, pageSize = 25, search } = {}) {
    const params = { page, pageSize }
    if (search) params.search = search
    const { data } = await client.get('/tests', { params })
    return data // { total, page, pageSize, items }
  },

  // ===== Clínica: visibles para el profesional (según disciplinas/taxonomía) =====
  async forMe({
    page = 1,
    pageSize = 24,
    search,
    // Filtros opcionales (por id o code)
    disciplineId,
    disciplineCode,
    categoryId,
    categoryCode,
    subcategoryId,
    subcategoryCode,
  } = {}) {
    const params = { page, pageSize }
    if (search) params.search = search
    if (disciplineId) params.disciplineId = disciplineId
    if (disciplineCode) params.disciplineCode = disciplineCode
    if (categoryId) params.categoryId = categoryId
    if (categoryCode) params.categoryCode = categoryCode
    if (subcategoryId) params.subcategoryId = subcategoryId
    if (subcategoryCode) params.subcategoryCode = subcategoryCode

    const { data } = await client.get('/tests/for-me', { params })
    return data // { total, page, pageSize, items }
  },

  // Alias mantenido para compatibilidad
  async listForMe(args = {}) {
    return this.forMe(args)
  },

//   async getById(id) {
//   try {
//     const { data } = await client.get(`/tests/${id}`); // admin
//     return data;
//   } catch (e) {
//     if (e?.response?.status === 403) {
//       const { data } = await client.get(`/clinician/tests/${id}`); // clínico
//       return data;
//     }
//     throw e;
//   }
// }
// ,

async getById(id) {
    // usar siempre el endpoint visible para clínicos
    const { data } = await client.get(`/clinician/tests/${id}`)
    return data
  },

  async create(payload) {
    const { data } = await client.post('/tests', payload)
    return data // { id }
  },

  async update(id, payload) {
    await client.put(`/tests/${id}`, payload)
  },

  async remove(id) {
    await client.delete(`/tests/${id}`)
  },

  // ===== Preguntas (ADMIN “puras”, usadas por el editor) =====
  async getQuestions(id) {
    // Run-first con fallback a admin (compat)
    try {
      console.log(`/tests/${id}/questions-run`)
      const { data } = await client.get(`/tests/${id}/questions-run`)
      return data
    } catch (err) {
      if (err?.response?.status === 404) {
        const { data } = await client.get(`/tests/${id}/questions`)
        console.log(`/tests/${id}/questions`)
        return data
      }
      throw err
    }
  },

  // Alias para llamadas que esperen explícitamente el endpoint “-run”
  async getQuestionsRun(id) {
    console.log("ZZZZ")
    return this.getQuestions(id)
  },

  // ===== Opciones por pregunta =====
  // ADMIN puro (lo usa el editor)
  async getQuestionOptions(id) {
    const { data } = await client.get(`/tests/${id}/question-options`)
    return data // [{ id, questionId, value, label, orderNo, isActive }, ...]
  },

  // Run-first con fallback a admin (lo usa el runner)
  async getQuestionOptionsByTest(testId) {
    try {
      const { data } = await client.get(`/tests/${testId}/question-options-run`)
      return data
    } catch (err) {
      if (err?.response?.status === 404) {
        const { data } = await client.get(`/tests/${testId}/question-options`)
        return data
      }
      throw err
    }
  },

  // Alias para llamadas que esperen explícitamente el endpoint “-run”
  async getQuestionOptionsRun(testId) {
    return this.getQuestionOptionsByTest(testId)
  },

  // ===== Escalas =====
  async getScales(id) {
    const { data } = await client.get(`/tests/${id}/scales`)
    return data
  },

  // ===== Taxonomía por test =====
  async getTaxonomy(id) {
    const { data } = await client.get(`/tests/${id}/taxonomy`)
    return data
  },

  async replaceTaxonomy(id, items) {
    // items: [{ disciplineId, categoryId?, subcategoryId? }, ...]
    await client.put(`/tests/${id}/taxonomy`, { items })
  },
  async submitRun(payload) {
    const { data } = await client.post('/test-runs/submit', payload)
    return data // { runId, scales:[...], totalRaw, totalMax, totalPercent, ... }
  },
}

export default TestsApi
