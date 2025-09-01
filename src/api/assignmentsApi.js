// src/api/assignmentsApi.js
import client from './client'

export const AssignmentsApi = {
  async create({ testId, patientId, respondentRole, relationLabel, dueAt }) {
    const { data } = await client.post('/assignments', {
      testId, patientId, respondentRole, relationLabel, dueAt
    })
    return data // { id, status }
  },
}

export default AssignmentsApi
