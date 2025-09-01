// src/api/patientsApi.js
import client from './client'

export const PatientsApi = {
  async list({ page = 1, pageSize = 25, search, active } = {}) {
    const params = { page, pageSize }
    if (search) params.search = search
    if (active !== undefined) params.active = active
    const { data } = await client.get('/patients', { params })
    return data // { total, page, pageSize, items }
  },

  async getById(id) {
    const { data } = await client.get(`/patients/${id}`)
    return data
  },

  async create(payload) {
    // payload: { identificationType, identificationNumber, firstName, lastName1, lastName2?, dateOfBirth?, sex?, contactEmail?, contactPhone?, isActive? }
    const { data } = await client.post('/patients', payload)
    return data // { id }
  },

  async update(id, payload) {
    // payload: mismos campos que create
    await client.put(`/patients/${id}`, payload)
  },

  async remove(id) {
    await client.delete(`/patients/${id}`)
  },
  async lookupByDocument({ identificationType, identificationNumber }) {
    const params = { identificationType, identificationNumber }
    const { data } = await api.get('/patients/lookup', { params })
      // Se espera: { id, firstName, lastName1, lastName2, ... } o null
      return data || null
  }
}

export default PatientsApi
