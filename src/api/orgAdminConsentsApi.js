// src/api/orgAdminConsentsApi.js
import client from "./client";

export const OrgAdminConsentsApi = {
  // GET /api/orgs/consent
  async getLatest() {
    const { data } = await client.get(`/orgs/consent`);
    return data || null;
  },

  // POST /api/orgs/consent
  async create(payload) {
    const { data } = await client.post(`/orgs/consent`, payload);
    return data;
  },
  // POST /api/orgs/consent/{consentId}/pdf  (multipart/form-data)
  async uploadPdf(consentId, pdfBlob) {
    const form = new FormData();
    form.append(
      "pdf",
      new File([pdfBlob], "consentimiento.pdf", { type: "application/pdf" })
    );
    const { data } = await client.post(`/orgs/consent/${consentId}/pdf`, form);
    return data;
  },
};

export default OrgAdminConsentsApi;
