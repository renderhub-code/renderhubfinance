// Cálculo puro do Fluxo de Caixa (Previsto x Realizado), valores com sinal: entradas +, saídas −.

export interface PR {
  expected: number[];
  realized: number[];
}

export const emptyPR = (): PR => ({ expected: Array(12).fill(0), realized: Array(12).fill(0) });

export interface CFAccount { code: string; name: string; values: PR }
export interface CFGroup { code: string; name: string; accounts: CFAccount[]; totals: PR }
export interface CFBlock { key: string; label: string; groups: CFGroup[]; totals: PR }

export interface CFInputTx {
  entry_date: string;
  type: string;
  status: string;
  amount_expected: number | string | null;
  amount_realized: number | string | null;
  account_id: string;
}
export interface CFInputAccount { id: string; code: string; name: string; active: boolean; subgroup_id: string }
export interface CFInputGroup { id: string; code: string; name: string }
export interface CFInputSubgroup { id: string; group_id: string }

export const BLOCKS: { key: string; label: string; groups: string[] }[] = [
  { key: "in", label: "(+) Entradas Operacionais", groups: ["1"] },
  { key: "out", label: "(−) Saídas Operacionais", groups: ["2", "3", "4", "5", "6", "7", "8"] },
  { key: "inv", label: "(+/−) Atividades de Investimento", groups: ["11"] },
  { key: "fin", label: "(+/−) Atividades de Financiamento", groups: ["9", "10", "12"] },
  { key: "tr", label: "(+/−) Transferências", groups: ["13", "14"] },
];

export const addPR = (a: PR, b: PR) => {
  for (let i = 0; i < 12; i++) {
    a.expected[i] += b.expected[i];
    a.realized[i] += b.realized[i];
  }
};

export const deltaOf = (expected: number, realized: number) => realized - expected;

export function buildCashFlow(
  txs: CFInputTx[],
  accounts: CFInputAccount[],
  groups: CFInputGroup[],
  subgroups: CFInputSubgroup[],
) {
  const byAccountId = new Map(accounts.map((a) => [a.id, a]));
  const byCode = new Map<string, PR>();
  const other = emptyPR();
  for (const t of txs) {
    if (t.status === "cancelado") continue;
    const m = Number(t.entry_date.slice(5, 7)) - 1;
    if (m < 0 || m > 11) continue;
    const sign = t.type === "entrada" ? 1 : -1;
    const e = sign * Number(t.amount_expected ?? 0);
    const r = sign * Number(t.amount_realized ?? 0);
    const acc = byAccountId.get(t.account_id);
    const target = acc ? (byCode.get(acc.code) ?? (byCode.set(acc.code, emptyPR()), byCode.get(acc.code)!)) : other;
    target.expected[m] += e;
    target.realized[m] += r;
  }

  const groupById = new Map(groups.map((g) => [g.id, g]));
  const groupIdBySub = new Map(subgroups.map((s) => [s.id, s.group_id]));
  const groupMap = new Map<string, CFGroup>();
  const seen = new Set<string>();
  const sorted = [...accounts].sort((a, b) => a.code.localeCompare(b.code, "pt-BR", { numeric: true }));
  for (const a of sorted) {
    if (seen.has(a.code)) continue;
    if (!a.active && !byCode.has(a.code)) continue;
    seen.add(a.code);
    const g = groupById.get(groupIdBySub.get(a.subgroup_id) ?? "");
    const gCode = g?.code ?? a.code.split(".")[0];
    let row = groupMap.get(gCode);
    if (!row) {
      row = { code: gCode, name: g?.name ?? "", accounts: [], totals: emptyPR() };
      groupMap.set(gCode, row);
    }
    const values = byCode.get(a.code) ?? emptyPR();
    row.accounts.push({ code: a.code, name: a.name, values });
    addPR(row.totals, values);
  }

  const used = new Set<string>();
  const blocks: CFBlock[] = BLOCKS.map((b) => {
    const gs = b.groups.map((c) => groupMap.get(c)).filter((g): g is CFGroup => !!g);
    gs.forEach((g) => used.add(g.code));
    const totals = emptyPR();
    gs.forEach((g) => addPR(totals, g.totals));
    return { key: b.key, label: b.label, groups: gs, totals };
  });
  // Grupos fora do mapa vão para "outros"
  for (const g of groupMap.values()) if (!used.has(g.code)) addPR(other, g.totals);

  const variation = emptyPR();
  blocks.forEach((b) => addPR(variation, b.totals));
  addPR(variation, other);

  const opening = emptyPR();
  const closing = emptyPR();
  let be = 0, br = 0;
  for (let i = 0; i < 12; i++) {
    opening.expected[i] = be; opening.realized[i] = br;
    be += variation.expected[i]; br += variation.realized[i];
    closing.expected[i] = be; closing.realized[i] = br;
  }
  const hasOther = other.expected.some((v) => v !== 0) || other.realized.some((v) => v !== 0);
  return { blocks, other, hasOther, variation, opening, closing };
}

/** Entradas e saídas operacionais realizadas por empresa e mês (saídas em valor positivo). */
export function cashFlowByCompany(
  txs: (CFInputTx & { company_id: string })[],
  accounts: CFInputAccount[],
  groups: CFInputGroup[],
  subgroups: CFInputSubgroup[],
) {
  const byCo = new Map<string, (CFInputTx & { company_id: string })[]>();
  for (const t of txs) (byCo.get(t.company_id) ?? (byCo.set(t.company_id, []), byCo.get(t.company_id)!)).push(t);
  const out: Record<string, { in: number[]; out: number[] }> = {};
  for (const [id, list] of byCo) {
    const cf = buildCashFlow(list, accounts, groups, subgroups);
    out[id] = {
      in: cf.blocks.find((b) => b.key === "in")!.totals.realized.slice(),
      out: cf.blocks.find((b) => b.key === "out")!.totals.realized.map((v) => (v ? -v : 0)),
    };
  }
  return out;
}
