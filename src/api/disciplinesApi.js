import api from './client'; // usa tu axios con interceptores (AUTH_TOKEN_KEY)

export const DisciplinesApi = {
  async list(opts = {}) {
    const params = {};
    if (opts.page) params.page = opts.page;
    if (opts.pageSize) params.pageSize = opts.pageSize;
    if (opts.search) params.search = opts.search;
    if (typeof opts.active === 'boolean') params.active = opts.active;

    // GET /disciplines -> { total, page, pageSize, items }
    const res = await api.get('/disciplines', { params });
    return res.data;
  },

  async get(id) {
    const res = await api.get(`/disciplines/${id}`);
    return res.data;
    // retorna el objeto disciplina
  },

  async create(payload) {
    // payload: { code, name, description?, isActive? }
    const res = await api.post('/disciplines', payload);
    return res.data; // { id }
  },

  async update(id, payload) {
    // payload: { name, description?, isActive? }
    const res = await api.put(`/disciplines/${id}`, payload);
    return res.data ?? null; // 204 No Content -> null
  },

  async remove(id) {
    const res = await api.delete(`/disciplines/${id}`);
    return res.data ?? null; // 204 No Content -> null
  }
};
