// src/components/api/orgSettingsApi.js
import client from "./client"
import {tryGetOrgId} from '../utils/identity'

function withOrgHeader(extra = {}) {
  const orgId = tryGetOrgId()
  return orgId ? { ...extra, 'X-Org-Id': orgId } : { ...extra }
}

export const OrgSettingsApi = {
async getOrgSettings() {
    const { data } = await client.get("/orgs/settings", {
        headers: withOrgHeader(),
    })
    return data
    },

async updateLogo(formData) {
    const { data } = await client.post('/orgs/settings/logo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data
  }
}

export default OrgSettingsApi