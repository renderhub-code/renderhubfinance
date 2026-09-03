import { useMemo } from "react";
import { useCompanyStore } from "@/lib/company-store";
import { useTransactions } from "@/lib/queries";
import { useFinancialStore } from "@/lib/financial-store";

/** Agrega previsto e realizado da empresa selecionada por mês. */
export function useForecastByMonth() {
  const companyId = useCompanyStore((s) => s.activeCompanyId);
  const businessUnitId = useCompanyStore((s) => s.activeBusinessUnitId);
  const year = useFinancialStore((s) => s.year);
  const { data: txs, isLoading } = useTransactions(companyId, {
    from: `${year}-01-01`,
    to: `${year}-12-31`,
    businessUnitId,
  });

  const totals = useMemo(() => {
    const expectedIn = Array(12).fill(0) as number[];
    const expectedOut = Array(12).fill(0) as number[];
    const realizedIn = Array(12).fill(0) as number[];
    const realizedOut = Array(12).fill(0) as number[];
    for (const t of txs ?? []) {
      if (t.status === "cancelado") continue;
      const m = Number(t.entry_date.slice(5, 7)) - 1;
      if (m < 0 || m > 11) continue;
      if (t.status === "realizado") {
        if (t.type === "entrada") realizedIn[m] += Number(t.amount_realized ?? 0);
        else realizedOut[m] += Number(t.amount_realized ?? 0);
      } else if (t.status === "previsto") {
        if (t.type === "entrada") expectedIn[m] += Number(t.amount_expected ?? 0);
        else expectedOut[m] += Number(t.amount_expected ?? 0);
      }
    }
    return { expectedIn, expectedOut, realizedIn, realizedOut };
  }, [txs]);

  return { ...totals, year, isLoading };
}
