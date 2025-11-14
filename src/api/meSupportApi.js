// src/api/meSupportApi.js
import client from './client'

const base = "me/support"

export async function createTicket({ subject, description, category, priority }) {
  const { data } = await client.post(base, {
    subject,
    description,
    category,
    priority,
  })
  return data // { id }
}

export async function listMyTickets({ top = 50, status = "", q = "" } = {}) {
  const params = {}
  if (top) params.top = top
  if (status) params.status = status
  if (q) params.q = q

  const { data } = await client.get(base, { params })
  // data: [{ id, subject, status, priority, category, createdAtUtc, updatedAtUtc, lastMessageAtUtc }]
  return data
}

export async function getTicket(id) {
  const { data } = await client.get(`${base}/${id}`)
  return data
}

export async function replyTicket(id, body) {
  await client.post(`${base}/${id}/reply`, { body })
}

export async function uploadAttachment(ticketId, file) {
  const formData = new FormData()
  formData.append("file", file)

  const { data } = await client.post(
    `${base}/${ticketId}/attachments`,
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    },
  )

  return data // { id, fileName, uri, mimeType, sizeBytes, createdAtUtc }
}

export async function closeTicket(ticketId) {
  await client.patch(`${base}/${ticketId}/status`, {
    status: "closed",
  })
}

export async function listOrgTickets() {
  const { data } = await client.get(`${base}/org-tickets`)
  return data
}

