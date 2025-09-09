// src/api/patientAttachmentsApi.js
// Nota: este cliente asume que client.baseURL YA incluye "/api" (tal como en tu proyecto).
import client from './client'

const base = '/patients'

// Heurística no intrusiva para resolver OrgId del front.
// Si no existe, no se envía el header y el backend intentará resolver por claim o membresía única.
function tryGetOrgId() {
  try {
    const fromWindow = (typeof window !== 'undefined' && window.EP_ORG_ID) ? String(window.EP_ORG_ID) : null
    const fromLS = (typeof window !== 'undefined') ? (localStorage.getItem('orgId') || localStorage.getItem('ORG_ID')) : null
    const fromSS = (typeof window !== 'undefined') ? (sessionStorage.getItem('orgId') || sessionStorage.getItem('ORG_ID')) : null
    const val = fromWindow || fromLS || fromSS
    // Validar formato GUID de manera laxa (no fallar si no es)
    return (val && /^[0-9a-fA-F-]{36}$/.test(val)) ? val : null
  } catch {
    return null
  }
}

function withOrgHeader(extra = {}) {
  const orgId = tryGetOrgId()
  if (orgId) {
    return { ...extra, 'X-Org-Id': orgId }
  }
  return extra
}

export const PatientAttachmentsApi = {
  async list(patientId) {
    const { data } = await client.get(`${base}/${patientId}/attachments`, {
      headers: withOrgHeader(),
    })
    const onlyActive = (Array.isArray(data) ? data : []).filter(
      it => !(it.deleted === true || it.deleted_at_utc) // <- filtra soft-deleted
    )

    return onlyActive
  },
  // intenta obtener el límite (en bytes) desde billing/subscription
    async storageLimitBytes() {
    try {
        const { data } = await client.get('/billing/subscription', {
        headers: withOrgHeader(),
        })
        const storageFeature = data.entitlements.find(item => item.feature === 'storage.gb');

        if (storageFeature) {
            return storageFeature.limit * 1024 * 1024 * 1024 ;
        } else {
            return null
        }
    } catch {
        return null
    }
  },

  async upload(patientId, file, comment) {
    const fd = new FormData()
    fd.append('file', file)
    if (comment) fd.append('comment', comment)

    const { data } = await client.post(`${base}/${patientId}/attachments`, fd, {
      headers: withOrgHeader({ 'Content-Type': 'multipart/form-data' }),
    })
    // { fileId, bytes }
    return data
  },

  // Retorna una URL lista para descargar (útil para <a href> o window.open)
  getDownloadUrl(fileId) {
    // client.defaults.baseURL suele traer algo como "https://host/api"
    const baseURL = client.defaults.baseURL?.replace(/\/+$/, '') || ''
    return `${baseURL}/patients/attachments/${fileId}/download`
  },

  async remove(fileId) {
    await client.delete(`/patients/attachments/${fileId}`, {
      headers: withOrgHeader(),
    })
  },
  // Añade esta función dentro de PatientAttachmentsApi:
    async download(fileId, suggestedName) {
    const res = await client.get(`/patients/attachments/${fileId}/download`, {
        responseType: 'blob',
        headers: withOrgHeader(),
    })
    // Intentar obtener nombre desde Content-Disposition
    const cd = res.headers?.['content-disposition'] || res.headers?.get?.('content-disposition')
    let filename = suggestedName || `attachment_${fileId}`
    if (cd && /filename\*=UTF-8''([^;]+)|filename="?([^"]+)"?/i.test(cd)) {
        const m = cd.match(/filename\*=UTF-8''([^;]+)|filename="?([^"]+)"?/i)
        filename = decodeURIComponent((m[1] || m[2] || filename)).replace(/[/\\?%*:|"<>]/g, '_')
    }
    return { blob: res.data, filename }
    }

}

export default PatientAttachmentsApi
