import { useMemo } from "react";
import { useCashSnapshot, type CashEntry } from "./cashflow-queries";
import { cashKind } from "./cashflow-rules";
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

/** Árvore Grupo → Subgrupo → Categoria com previsto/realizado por mês. */
export function useCashflowTree() {
  const companyId = useCompanyStore((s) => s.activeCompanyId);
  const businessUnitId = useCompanyStore((s) => s.activeBusinessUnitId);
  const year = useFinancialStore((s) => s.year);

  const { data: txs, isLoading: loadingTx } = useTransactions(companyId, {
    businessUnitId,
  });
  const { data: accounts, isLoading: la } = useAccounts(companyId);
  const { data: subgroups, isLoading: ls } = useAccountSubgroups(companyId);
  const { data: groups, isLoading: lg } = useAccountGroups(companyId);

  const snapshotQuery = useCashSnapshot(companyId, year);
  const snapshot = snapshotQuery.data;
  const entries = useMemo(() => {
    const output: Array<CashEntry & { expected: boolean }> = [];
    for (const e of snapshot?.movements ?? []) if (!businessUnitId) output.push({ ...e, expected: false });
    for (const e of snapshot?.forecasts ?? []) if (!businessUnitId) output.push({ ...e, expected: true });
    for (const t of txs ?? []) {
      if (t.status === "cancelado") continue;
      const imported = t.external_source?.startsWith("bling:");
      // Bling cash is represented exclusively by verified cash movements, never by invoice face values.
      if (imported) continue;
      const realized = t.status === "realizado";
      const date = realized ? t.settled_date : t.due_date;
      if (!date?.startsWith(String(year))) continue;
      const account = accounts?.find(a => a.id === t.account_id);
      output.push({ account_id: t.account_id, date, amount: Number(realized ? t.amount_realized : t.amount_expected), type: t.type, kind: cashKind("N", "", "", account?.code), expected: !realized });
    }
    return output;
  }, [snapshot, txs, accounts, year, businessUnitId]);

  const tree = useMemo<CashflowNode[]>(() => {
    if (!accounts || !subgroups || !groups) return [];

    const byAccount = new Map<string, MonthCell[]>();
    for (const t of entries) {
      if (!t.account_id || ["transfer", "adjustment", "shareholder"].includes(t.kind)) continue;
      const m = Number(t.date.slice(5, 7)) - 1;
      if (m < 0 || m > 11) continue;
      let cells = byAccount.get(t.account_id);
      if (!cells) { cells = emptyMonths(); byAccount.set(t.account_id, cells); }
      cells[m][t.expected ? "expected" : "realized"] += (t.type === "entrada" ? 1 : -1) * t.amount;
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
      const node = subNodes.get(s.id);
      if (!node) continue;
      node.children.sort((a, b) => a.code.localeCompare(b.code));
      const parent = groupById.get(s.group_id);
      if (!parent) continue;
      parent.children.push(node);
      addInto(parent.months, node.months);
    }

    for (const g of groupNodes) g.children.sort((a, b) => a.code.localeCompare(b.code));

    // Entradas (receitas) primeiro, despesas (saídas) embaixo.
    return groupNodes.sort((a, b) =>
      a.type === b.type ? 0 : a.type === "entrada" ? -1 : 1,
    );
  }, [entries, accounts, subgroups, groups]);

  const summary = useMemo(() => {
    const inflow = emptyMonths();
    const outflow = emptyMonths();
    const shareholders = emptyMonths();
    for (const t of entries) {
      if (["transfer", "adjustment"].includes(t.kind)) continue;
      const m = Number(t.date.slice(5, 7)) - 1;
      if (m < 0 || m > 11) continue;
      const bucket = t.kind === "shareholder" ? shareholders : t.type === "entrada" ? inflow : outflow;
      bucket[m][t.expected ? "expected" : "realized"] += (t.kind === "shareholder" && t.type === "saida" ? -1 : 1) * t.amount;
    }
    const variation = inflow.map((v, i) => ({ expected: v.expected - outflow[i].expected + shareholders[i].expected, realized: v.realized - outflow[i].realized + shareholders[i].realized }));
    let accR = snapshot?.opening ?? 0;
    let accE = snapshot?.opening ?? 0;
    const balance = variation.map(v => {
      accR += v.realized;
      accE += v.realized + v.expected;
      return { expected: accE, realized: accR };
    });
    return { inflow, outflow, variation, balance, shareholders };
  }, [entries, snapshot]);

  return { tree, summary, year, snapshot, movements: snapshot?.movements ?? [], error: snapshotQuery.error, isLoading: loadingTx || la || ls || lg || snapshotQuery.isLoading };
}
