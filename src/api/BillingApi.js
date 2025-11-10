// src/api/BillingApi.js
import client from './client'

function tryGetOrgId() {
  try {
    const fromWindow = (typeof window !== 'undefined' && window.EP_ORG_ID) ? String(window.EP_ORG_ID) : null
    const fromLS = (typeof window !== 'undefined') ? (localStorage.getItem('orgId') || localStorage.getItem('ORG_ID')) : null
    const fromSS = (typeof window !== 'undefined') ? (sessionStorage.getItem('orgId') || sessionStorage.getItem('ORG_ID')) : null
    const val = fromWindow || fromLS || fromSS
    return (val && /^[0-9a-fA-F-]{36}$/.test(val)) ? val : null
  } catch { return null }
}

function withOrgHeader(extra = {}) {
  const orgId = tryGetOrgId()
  return orgId ? { ...extra, 'X-Org-Id': orgId } : { ...extra }
}

export const BillingApi = {
  async getBillingProfile() {
    try {
      const { data } = await client.get("/orgs/billing-profile", {
        headers: withOrgHeader(),
      })
      return data
    } catch (err) {
      if (err?.response?.status === 404) return null
      throw err
    }
  },
  async updateBillingProfile(payload) {
    const { data } = await client.put("/orgs/billing-profile", payload, {
      headers: withOrgHeader(),
    })
    return data
  },
  async getPlans() {
    const { data } = await client.get("/billing/plans", {
      headers: withOrgHeader(),
    })
    return data
  },
  async createCheckout(payload) {
    const { data } = await client.post("/billing/checkout", payload, {
      headers: withOrgHeader(),
    })
    return data // { url } esperado
  },
  async getPortal() {
    const { data } = await client.get("/billing/portal", {
      headers: withOrgHeader(),
    })
    return data // { url } esperado
  },
  async getSubscription() {
    const { data } = await client.get("/billing/subscription", {
      headers: withOrgHeader(),
    })
    return data
  },
  async getPaymentMethod(opts = {}) {
    const params = {}
    if (opts.cacheBust) params.t = Date.now()

    const { data } = await client.get("/billing/payment-method", { params })
    return data
  },
  async startPaymentMethodTokenization(returnUrl) {
    const { data } = await client.post('/billing/payment-method/start-tokenization', {
      returnUrl
    })
    // Normaliza posibles nombres: { redirectUrl } | { url } | { tokenizationUrl } | string
    return data?.redirectUrl ?? data?.url ?? data?.tokenizationUrl ?? data
  },
  async  finalizePaymentMethodTokenization(payload) {
    // Por ahora opcional; útil cuando implementemos persistencia de token del lado del BE
    // Puedes dejarlo como NO-OP si todavía no hay endpoint real.
    const { data } = await client.post('/billing/payment-method/finalize', payload)
    return data
  },
  // async getPayments(limit = 50) {
  //   const { data } = await client.get("/billing/payments", {
  //     params: { limit, t: Date.now() } // cache-bust
  //   })
  //   return Array.isArray(data?.items) ? data.items : []
  // },
  async getPayments(limit = 50) {
    try {
      console.log("/billing/payments?limit=" + limit)
      const { data } = await client.get("/billing/payments?limit=" + limit, {
        headers: withOrgHeader(),
      })
      return Array.isArray(data?.items) ? data.items : []
    } catch (err) {
      if (err?.response?.status === 404) return { items: [] }
      //throw err
    }
  },
    // async getSubscription(){
  //   const { data } = await client.get('/billing/subscription');
  //   return data;
  // },
  // async getPlans(){
  //   const { data } = await client.get("/billing/plans");
  //   return data;
  // },
  // async checkout(planCode, seats = 1){
  //   const { data } = await client.post("/billing/checkout", { planCode, seats });
  //   return data; // { checkoutUrl }
  // },
};

export default BillingApi