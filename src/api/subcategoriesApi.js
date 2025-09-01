import api from './client'

export const SubcategoriesApi = {
  async list(opts = {}) {
    const params = {}
    if (opts.page) params.page = opts.page
    if (opts.pageSize) params.pageSize = opts.pageSize
    if (opts.search) params.search = opts.search
    if (typeof opts.active === 'boolean') params.active = opts.active
    if (opts.categoryId) params.categoryId = opts.categoryId
    if (opts.disciplineId) params.disciplineId = opts.disciplineId
    const res = await api.get('/subcategories', { params })
    return res.data
  },

  async get(id) {
    const res = await api.get(`/subcategories/${id}`)
    return res.data
  },

  async create(payload) {
    // { categoryId, code, name, description?, isActive? }
    const res = await api.post('/subcategories', payload)
    return res.data
  },

  async update(id, payload) {
    // { name, description?, isActive? }
    const res = await api.put(`/subcategories/${id}`, payload)
    return res.data ?? null
  },

  async remove(id) {
    const res = await api.delete(`/subcategories/${id}`)
    return res.data ?? null
  },
}
