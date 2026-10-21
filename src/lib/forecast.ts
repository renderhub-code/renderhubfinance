import { useMemo } from "react";
import { useCompanyStore } from "@/lib/company-store";
import { useFinancialStore } from "@/lib/financial-store";
import { useAccountGroups, useAccountSubgroups, useAccounts, useTransactions } from "@/lib/queries";
import { buildCashFlow, cashFlowByCompany } from "@/lib/cashflow-blocks";

/** Fluxo de caixa completo do ano: previsto x realizado, por blocos e grupos (empresas sem Bling). */
export function useCashFlow() {
  const companyId = useCompanyStore((s) => s.activeCompanyId);
  const businessUnitId = useCompanyStore((s) => s.activeBusinessUnitId);
  const year = useFinancialStore((s) => s.year);
  const { data: allTxs, isLoading } = useTransactions(companyId, {
    from: `${year}-01-01`,
    to: `${year}-12-31`,
    businessUnitId,
  });
  const { data: accounts, isLoading: l1 } = useAccounts(companyId);
  const { data: groups, isLoading: l2 } = useAccountGroups(companyId);
  const { data: subgroups, isLoading: l3 } = useAccountSubgroups(companyId);
  // Títulos importados do Bling são valor de face, não caixa; o caixa da Use Noronha vem do snapshot próprio.
  const txs = useMemo(() => (allTxs ?? []).filter((t) => !t.external_source?.startsWith("bling:")), [allTxs]);
  const data = useMemo(
    () => buildCashFlow(txs, accounts ?? [], groups ?? [], subgroups ?? []),
    [txs, accounts, groups, subgroups],
  );
  const byCompany = useMemo(
    () => (companyId === null ? cashFlowByCompany(txs, accounts ?? [], groups ?? [], subgroups ?? []) : {}),
    [companyId, txs, accounts, groups, subgroups],
  );
  return { ...data, byCompany, year, isLoading: isLoading || l1 || l2 || l3 };
}
