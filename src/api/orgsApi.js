// src/api/orgsApi.js
import client from './client'

export async function getCurrentOrgSummary() {
  const res = await client.get("/orgs/current/summary");
  return res.data;
}
