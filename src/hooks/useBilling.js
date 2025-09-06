// src/hooks/useBilling.js
import { useCallback, useEffect, useState } from "react";
import { BillingApi } from "../api/BillingApi";

export function useBillingStatus() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const s = await BillingApi.getSubscription();
      setData(s);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { data, loading, error, refresh };
}

export function pickEntitlement(billing, featureCode) {
  if (!billing?.entitlements) return { feature: featureCode, limit: null, used: 0, remaining: Infinity };
  const ent = billing.entitlements.find(e => e.feature === featureCode);
  return ent ?? { feature: featureCode, limit: null, used: 0, remaining: Infinity };
}
