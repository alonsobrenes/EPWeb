import client from './client'

export const SearchApi = {
  async suggest(q, limit = 10) {
    const { data } = await client.get('/search/suggest', { params: { q, limit } })
    return data // { hashtags: string[], labels: {id,code,name,colorHex}[], entities: {type,id,title}[], durationMs }
  },

  async search(body) {
    console.log(body)
    // body: { q, types, labels, hashtags, dateFromUtc, dateToUtc, page, pageSize }
    const { data } = await client.post("/search", body)
    return data
  },
}
export default SearchApi
