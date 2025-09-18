// src/api/hashtagsApi.js
import client from './client'

const HashtagsApi = {
  /**
   * Lee hashtags para una entidad.
   * @param {{ type: 'session'|'session_tidy'|'session_opinion'|'interview'|string, id: string }} args
   * @returns {Promise<{ items: Array<{ id?: number, tag: string }> }|null>}
   */
  async getFor({ type, id }) {
    try {
      const { data } = await client.get('/hashtags/for', { params: { type, id } })
      // Esperado: { items: [{ tag: 'ansiedad' }, ...] }
      return data
    } catch {
      return null // si 404 o no implementado aún, no romper UI
    }
  },
}

export default HashtagsApi
