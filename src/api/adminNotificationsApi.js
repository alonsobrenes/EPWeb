// src/api/adminNotificationsApi.js
import client from './client'

export const AdminNotificationsApi = {
  async list({ activeOnly = false, audience = "", q = "", top = 500 } = {}) {
    const { data } = await client.get("/admin/notifications", {
      params: { activeOnly, audience: audience || undefined, q: q || undefined, top },
    })
    return Array.isArray(data) ? data : []
  },

  async create(payload) {
    // payload: { title, body, kind, audience, audienceValue, publishedAtUtc, expiresAtUtc }
    const { data } = await client.post("/admin/notifications", payload)
    return data // { id }
  },

  async update(id, patch) {
    // patch parcial (PATCH DTO del backend)
    await client.patch(`/admin/notifications/${id}`, patch)
  },

  async publishNow(id) {
    await client.patch(`/admin/notifications/${id}`, { publishNow: true })
  },

  async unpublish(id) {
    await client.patch(`/admin/notifications/${id}`, { unpublish: true })
  },

  async expireNow(id) {
    await client.patch(`/admin/notifications/${id}`, { expireNow: true })
  },
}
