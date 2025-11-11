import client from "./client"

export const InterviewApi = {
  async create({ patientId }) {
    const { data } = await client.post("/clinician/interviews", { patientId })
    return data // { id }
  },

  async uploadAudio(interviewId, file) {
  const fd = new FormData()
  // nombra el archivo con extensión coherente
  const type = (file.type || '').toLowerCase()
  const ext = type.includes('webm') ? 'webm'
    : type.includes('ogg') ? 'ogg'
    : (type.includes('mp4') || type.includes('m4a') || type.includes('aac')) ? 'm4a'
    : 'wav'
  const name = file.name || `audio_${Date.now()}.${ext}`
  fd.append("file", file, name)

  const { data } = await client.post(`/clinician/interviews/${interviewId}/audio`, fd, {
    headers: { 'Content-Type': undefined },    // deja que el browser ponga boundary
    transformRequest: (d) => d,                // evita serialización automática
  })
  return data
}
,

async transcribe(interviewId, { force = false } = {}) {
  const { data } = await client.post(`/clinician/interviews/${interviewId}/transcribe`, null, {
    params: { force }
  })
  return data // { language, text, cached }
}
,

  async get(interviewId) {
    const { data } = await client.get(`/clinician/interviews/${interviewId}`)
    return data
  },

  async saveTranscript(interviewId, { language = "es", text, wordsJson = null }) {
    await client.put(`/clinician/interviews/${interviewId}/transcript`, { language, text, wordsJson })
  },

  async generateDiagnosis(interviewId, { notes = "", promptVersion = "v1", model = "stub" } = {}) {
    const { data } = await client.post(`/clinician/interviews/${interviewId}/diagnosis`, { notes, promptVersion, model })
    return data // { content }
  },

  async saveDraft(interviewId, { content, model = null, promptVersion = null }) {
    const { data } = await client.put(
      `/clinician/interviews/${interviewId}/draft`,
      { content, model, promptVersion }
    )
    return data // { saved: true }
  },
  async saveClinicianDiagnosis(interviewId, { text, close = false }) {
    await client.put(`/clinician/interviews/${interviewId}/clinician-diagnosis`, { text, close })
  },
  async  getFirstByPatient(patientId) {
    const { data } = await client.get(`/clinician/interviews/patient/${patientId}/first`)
    return data // { interviewId, startedAtUtc, status, transcriptText, draftContent }
  },
  async getTranscriptionStatus(interviewId) {
    const { data } = await client.get(`/clinician/interviews/${interviewId}/transcription-status`)
    return data
  }
}
