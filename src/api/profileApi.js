// src/api/profileApi.js
import client from './client'

function tryGetOrgId() {
  try {
    const fromWindow = (typeof window !== 'undefined' && window.EP_ORG_ID) ? String(window.EP_ORG_ID) : null
    const fromLS = (typeof window !== 'undefined') ? (localStorage.getItem('orgId') || localStorage.getItem('ORG_ID')) : null
    const fromSS = (typeof window !== 'undefined') ? (sessionStorage.getItem('orgId') || sessionStorage.getItem('ORG_ID')) : null
    const val = fromWindow || fromLS || fromSS
    return (val && /^[0-9a-fA-F-]{36}$/.test(val)) ? val : null
  } catch { return null }
}

function withOrgHeader(extra = {}) {
  const orgId = tryGetOrgId()
  return orgId ? { ...extra, 'X-Org-Id': orgId } : { ...extra }
}

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
    const { data } = await client.get('/labels', { headers: withOrgHeader() })
    return data // { items: [...] }
  },
  async createLabel({ code, name, colorHex, isSystem = false }) {
    const { data } = await client.post('/labels', { code, name, colorHex, isSystem }, { headers: withOrgHeader() })
    return data // { id }
  },
  async updateLabel(id, { name, colorHex }) {
    await client.put(`/labels/${id}`, { name, colorHex }, { headers: withOrgHeader() })
  },
  async deleteLabel(id) {
    await client.delete(`/labels/${id}`, { headers: withOrgHeader() })
  },

  // ---- Asignaciones de etiquetas
  async getLabelsFor({ type, id }) {
    const { data } = await client.get(`/labels/for`, { params: { type, id } }, { headers: withOrgHeader() })
    return data // { items: [...] }
  },
  async assignLabel({ labelId, targetType, targetId }) {
    await client.post('/labels/assign', { labelId, targetType, targetId }, { headers: withOrgHeader() })
  },
  async unassignLabel({ labelId, targetType, targetId }) {
    await client.post('/labels/unassign', { labelId, targetType, targetId }, { headers: withOrgHeader() })
  }
}

export default ProfileApi
