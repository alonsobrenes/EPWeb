// src/api/patientConsentsApi.js
import client from './client'

export const PatientConsentsApi = {
    // GET /api/patients/{patientId}/consent
    async getLatest(patientId) {
        if (!patientId) throw new Error('patientId es requerido')
        const {
            data
        } = await client.get(`/patients/${patientId}/consent`)
        // Puede venir null si no hay consentimiento todavía
        return data || null
    },

    // GET /api/patients/{patientId}/consent/history
    async getHistory(patientId) {
        if (!patientId) throw new Error('patientId es requerido')
        const {
            data
        } = await client.get(`/patients/${patientId}/consent/history`)
        return data || []
    },

    // POST /api/patients/{patientId}/consent
    async create(patientId, payload) {
        if (!patientId) throw new Error('patientId es requerido')
        const {
            data
        } = await client.post(`/patients/${patientId}/consent`, payload)
        return data
    }
}

export default PatientConsentsApi