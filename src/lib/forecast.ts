import { useMemo } from "react";
import { useCompanyStore } from "@/lib/company-store";
import { useTransactions } from "@/lib/queries";

export const FORECAST_YEAR = new Date().getFullYear();

/** Agrega os lançamentos previstos do ano corrente por mês (receita x custo/saída). */
export function useForecastByMonth() {
  const companyId = useCompanyStore((s) => s.activeCompanyId);
  const { data: txs, isLoading } = useTransactions(companyId, {
    from: `${FORECAST_YEAR}-01-01`,
    to: `${FORECAST_YEAR}-12-31`,
    status: "previsto",
  });

  const totals = useMemo(() => {
    const revenue = Array(12).fill(0) as number[];
    const cost = Array(12).fill(0) as number[];
    for (const t of txs ?? []) {
      const m = Number(t.entry_date.slice(5, 7)) - 1;
      if (m < 0 || m > 11) continue;
      const v = Number(t.amount_expected ?? 0);
      if (t.type === "entrada") revenue[m] += v;
      else cost[m] += v;
    }
    return { revenue, cost };
  }, [txs]);

  return { ...totals, isLoading };
}
