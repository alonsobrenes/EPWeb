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
}

export default ProfileApi
