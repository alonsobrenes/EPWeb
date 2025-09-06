// src/api/pricingApi.js
import client from "./client"

export const PricingApi = {
  async getPublicPlans(signal) {
    try {
      const { data } = await client.get("/public/pricing", { signal })
      return data // Esperado: [{ name, monthly_price, yearly_price, features:[...] }, ...]
    } catch {
      return null
    }
  },
  async getMyEntitlements(signal) {
    try {
      const { data } = await client.get("/me/entitlements", { signal })
      return data // Ej: { plan: "Starter", limits: {...}, usage: {...} }
    } catch {
      return null
    }
  },
}

export default PricingApi;