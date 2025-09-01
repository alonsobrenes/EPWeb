import client from './client'

export const AgeGroupsApi = {
  async list({ includeInactive = false } = {}) {
    const { data } = await client.get('/agegroups', { params: { includeInactive } })
    return data // arreglo: [{ id, code, name, ... }]
  },
}
export default AgeGroupsApi
