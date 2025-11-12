// src/api/meNotifications.js
import client from './client'

export async function unreadCount() {
  const { data } = await client.get("/me/notifications/unread-count")
  return data?.unread ?? 0
}

export async function list({ onlyUnread = false } = {}) {
  const { data } = await client.get(`/me/notifications`, {
    params: { onlyUnread },
  })
  return Array.isArray(data) ? data : []
}

export async function markRead(id) {
  await client.post(`/me/notifications/${id}/read`)
}

export async function archive(id) {
  await client.post(`/me/notifications/${id}/archive`)
}

export async function markAllRead(ids = []) {
  // Simple: dispara en paralelo, ignora errores individuales
  await Promise.all(ids.map((id) => markRead(id).catch(() => {})))
}
