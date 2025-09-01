import api from './client'

export const CategoriesApi = {
  async list(opts = {}) {
    const params = {}
    if (opts.page) params.page = opts.page
    if (opts.pageSize) params.pageSize = opts.pageSize
    if (opts.search) params.search = opts.search
    if (typeof opts.active === 'boolean') params.active = opts.active
    if (opts.disciplineId) params.disciplineId = opts.disciplineId
    const res = await api.get('/categories', { params })
    return res.data
  },

  async get(id) {
    const res = await api.get(`/categories/${id}`)
    return res.data
  },

  async create(payload) {
    // { disciplineId, code, name, description?, isActive? }
    const res = await api.post('/categories', payload)
    return res.data // { id }
  },

  async update(id, payload) {
    // { name, description?, isActive? }
    const res = await api.put(`/categories/${id}`, payload)
    return res.data ?? null
  },

  async remove(id) {
    const res = await api.delete(`/categories/${id}`)
    return res.data ?? null
  },
}
