// src/api/adminSupportApi.js
import client from './client'

const base = "admin/support"

export async function listTickets({ top = 100, status = "", assignedTo = "", userId = "", category = "", priority = "", from = "", to = "", q = "" } = {}) {
  const params = {}
  if (top) params.top = top
  if (status) params.status = status
  if (assignedTo) params.assignedTo = assignedTo
  if (userId) params.userId = userId
  if (category) params.category = category
  if (priority) params.priority = priority
  if (from) params.from = from
  if (to) params.to = to
  if (q) params.q = q


  const { data } = await client.get(base, { params })
  return data
}

export async function getTicketAdmin(id) {
  const { data } = await client.get(`${base}/${id}`)
  return data
}

export async function replyTicketAdmin(id, { body, internalNote = false }) {
  await client.post(`${base}/${id}/reply`, { body, internalNote })
}

export async function patchTicketAdmin(id, { status = null, assignedToUserId = null }) {
  const payload = {}
  if (status !== null) payload.status = status
  if (assignedToUserId !== null) payload.assignedToUserId = assignedToUserId
  await client.patch(`${base}/${id}`, payload)
}

export async function deleteAttachmentAdmin(ticketId, attachmentId) {
  await client.delete(`${base}/${ticketId}/attachments/${attachmentId}`)
}

