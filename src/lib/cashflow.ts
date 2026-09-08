import { useMemo } from "react";
import { useCompanyStore } from "@/lib/company-store";
import { useFinancialStore } from "@/lib/financial-store";
import {
  useAccountGroups,
  useAccountSubgroups,
  useAccounts,
  useTransactions,
} from "@/lib/queries";

export interface MonthCell {
  expected: number;
  realized: number;
}

export interface CashflowNode {
  id: string;
  level: 0 | 1 | 2;
  code: string;
  name: string;
  type: "entrada" | "saida";
  months: MonthCell[];
  children: CashflowNode[];
}

const emptyMonths = (): MonthCell[] =>
  Array.from({ length: 12 }, () => ({ expected: 0, realized: 0 }));

function addInto(target: MonthCell[], src: MonthCell[]) {
  for (let i = 0; i < 12; i++) {
    target[i].expected += src[i].expected;
    target[i].realized += src[i].realized;
  }
}

export function totalOf(months: MonthCell[]): MonthCell {
  return months.reduce(
    (acc, m) => ({ expected: acc.expected + m.expected, realized: acc.realized + m.realized }),
    { expected: 0, realized: 0 },
  );
}

export function hasValues(months: MonthCell[]): boolean {
  return months.some((m) => m.expected !== 0 || m.realized !== 0);
}

/** Árvore Grupo → Subgrupo → Conta com previsto/realizado por mês. */
export function useCashflowTree() {
  const companyId = useCompanyStore((s) => s.activeCompanyId);
  const businessUnitId = useCompanyStore((s) => s.activeBusinessUnitId);
  const year = useFinancialStore((s) => s.year);

  const { data: txs, isLoading: loadingTx } = useTransactions(companyId, {
    from: `${year}-01-01`,
    to: `${year}-12-31`,
    businessUnitId,
  });
  const { data: accounts, isLoading: la } = useAccounts(companyId);
  const { data: subgroups, isLoading: ls } = useAccountSubgroups(companyId);
  const { data: groups, isLoading: lg } = useAccountGroups(companyId);

  const tree = useMemo<CashflowNode[]>(() => {
    if (!accounts || !subgroups || !groups) return [];

    const byAccount = new Map<string, MonthCell[]>();
    for (const t of txs ?? []) {
      if (t.status === "cancelado") continue;
      const m = Number(t.entry_date.slice(5, 7)) - 1;
      if (m < 0 || m > 11) continue;
      let cells = byAccount.get(t.account_id);
      if (!cells) {
        cells = emptyMonths();
        byAccount.set(t.account_id, cells);
      }
      const sign = t.type === "entrada" ? 1 : -1;
      if (t.status === "realizado") cells[m].realized += sign * Number(t.amount_realized ?? 0);
      else cells[m].expected += sign * Number(t.amount_expected ?? 0);
    }

    const subNodes = new Map<string, CashflowNode>();
    for (const s of subgroups) {
      subNodes.set(s.id, {
        id: s.id,
        level: 1,
        code: s.code,
        name: s.name,
        type: "entrada",
        months: emptyMonths(),
        children: [],
      });
    }

    for (const a of accounts) {
      const cells = byAccount.get(a.id);
      if (!a.active && !cells) continue;
      const parent = subNodes.get(a.subgroup_id);
      if (!parent) continue;
      const months = cells ?? emptyMonths();
      parent.children.push({
        id: a.id,
        level: 2,
        code: a.code,
        name: a.name,
        type: a.type,
        months,
        children: [],
      });
      addInto(parent.months, months);
    }

    const groupNodes: CashflowNode[] = [];
    const groupById = new Map<string, CashflowNode>();
    for (const g of [...groups].sort((x, y) => x.sort_order - y.sort_order)) {
      const node: CashflowNode = {
        id: g.id,
        level: 0,
        code: g.code,
        name: g.name,
        type: g.type,
        months: emptyMonths(),
        children: [],
      };
      groupById.set(g.id, node);
      groupNodes.push(node);
    }

    for (const s of subgroups) {
      const node = subNodes.get(s.id)!;
      node.children.sort((a, b) => a.code.localeCompare(b.code));
      const parent = groupById.get(s.group_id);
      if (!parent) continue;
      parent.children.push(node);
      addInto(parent.months, node.months);
    }

    for (const g of groupNodes) g.children.sort((a, b) => a.code.localeCompare(b.code));

    return groupNodes;
  }, [txs, accounts, subgroups, groups]);

  const summary = useMemo(() => {
    const inflow = emptyMonths();
    const outflow = emptyMonths();
    for (const t of txs ?? []) {
      if (t.status === "cancelado") continue;
      const m = Number(t.entry_date.slice(5, 7)) - 1;
      if (m < 0 || m > 11) continue;
      const bucket = t.type === "entrada" ? inflow : outflow;
      if (t.status === "realizado") bucket[m].realized += Number(t.amount_realized ?? 0);
      else bucket[m].expected += Number(t.amount_expected ?? 0);
    }
    const variation = inflow.map((v, i) => ({
      expected: v.expected - outflow[i].expected,
      realized: v.realized - outflow[i].realized,
    }));
    let accE = 0;
    let accR = 0;
    const balance = variation.map((v) => {
      accE += v.expected;
      accR += v.realized;
      return { expected: accE, realized: accR };
    });
    return { inflow, outflow, variation, balance };
  }, [txs]);

  return { tree, summary, year, isLoading: loadingTx || la || ls || lg };
}
