import { createContext, useContext, useEffect, useMemo, useState } from "react";

const OrgContext = createContext({
  loading: true,
  planCode: "solo",
  status: "none",
  seats: 1,
  orgKind: "solo", // "solo" | "clinic" | "hospital"
  setOrgSummary: () => {},
});

export function OrgProvider({ children, initialSummary }) {
  // estado interno que puede actualizarse cuando cambie initialSummary
  const [summary, setOrgSummary] = useState(
    initialSummary ?? {
      planCode: "solo",
      status: "none",
      seats: 1,
      orgKind: "solo",
    }
  );
  const [loading, setLoading] = useState(!initialSummary);

  // 🔧 sincroniza cuando App.jsx obtiene el resumen de la API
  useEffect(() => {
    if (initialSummary) {
      setOrgSummary({
        planCode: initialSummary.planCode ?? "solo",
        status: initialSummary.status ?? "none",
        seats: typeof initialSummary.seats === "number" ? initialSummary.seats : 1,
        orgKind: initialSummary.kind ?? initialSummary.orgKind ?? "solo",
      });
      setLoading(false);
    }
  }, [initialSummary]);

  const value = useMemo(
    () => ({ loading, ...summary, setOrgSummary }),
    [loading, summary]
  );

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

export function useOrg() {
  return useContext(OrgContext);
}

export function useOrgKind() {
  const { orgKind } = useOrg();
  return orgKind;
}
