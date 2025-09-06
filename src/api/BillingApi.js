// src/api/BillingApi.js
import client from './client'

export const BillingApi = {
  async getSubscription(){
    const { data } = await client.get('/billing/subscription');
    return data;
  },
  async getPlans(){
    const { data } = await client.get("/billing/plans");
    return data;
  },
  async checkout(planCode, seats = 1){
    const { data } = await client.post("/billing/checkout", { planCode, seats });
    return data; // { checkoutUrl }
  },
};

export default BillingApi