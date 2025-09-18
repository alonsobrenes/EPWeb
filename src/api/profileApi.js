// src/api/profileApi.js
import client from './client'

export const ProfileApi = {
  // ---- Perfil básico
  async getMe() {
    const { data } = await client.get('/Users/me')
    return data // { id, email, role, createdAt, avatarUrl, ... }
  },

  async uploadAvatar(file) {
    const fd = new FormData()
    fd.append('file', file)
    const { data } = await client.post('/Users/me/avatar', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data // UserProfileDto
  },

  async deleteAvatar() {
    await client.delete('/Users/me/avatar')
  },

  // ---- Disciplinas del profesional (en Perfil)
  async getMyDisciplines() {
    // Devuelve { items: [{ id, code, name } ...] }
    const { data } = await client.get('/Users/me/disciplines')
    return data
  },

  async replaceMyDisciplines(disciplineIds) {
    // disciplineIds: number[] (IDs de dbo.disciplines)
    await client.put('/Users/me/disciplines', { disciplineIds })
  },
  // ---- Etiquetas (org)
  async getLabels() {
    const { data } = await client.get('/labels')
    return data // { items: [...] }
  },
  async createLabel({ code, name, colorHex, isSystem = false }) {
    const { data } = await client.post('/labels', { code, name, colorHex, isSystem })
    return data // { id }
  },
  async updateLabel(id, { name, colorHex }) {
    await client.put(`/labels/${id}`, { name, colorHex })
  },
  async deleteLabel(id) {
    await client.delete(`/labels/${id}`)
  },

  // ---- Asignaciones de etiquetas
  async getLabelsFor({ type, id }) {
    const { data } = await client.get(`/labels/for`, { params: { type, id } })
    return data // { items: [...] }
  },
  async assignLabel({ labelId, targetType, targetId }) {
    await client.post('/labels/assign', { labelId, targetType, targetId })
  },
  async unassignLabel({ labelId, targetType, targetId }) {
    await client.post('/labels/unassign', { labelId, targetType, targetId })
  }
}

export default ProfileApi
