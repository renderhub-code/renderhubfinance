// Regra pura da Simulação por conta (Dom Pablyto): Total = Quantidade × Valor, por mês.

export interface AccountSimLine {
  account_id: string;
  month: number;
  qty_expected: number | string | null;
  unit_price: number | string | null;
}

export interface AccountSimTx {
  account_id: string;
  type: "entrada" | "saida";
  entry_date: string;
  amount_expected: number;
}

export const lineTotal = (qty: number, value: number) => qty * value;

/** Gera um previsto por conta/mês com Total ≠ 0; o tipo vem da natureza da conta; o sinal é preservado. */
export function buildAccountSimTxs(
  lines: AccountSimLine[],
  accountTypes: Map<string, "entrada" | "saida">,
  year: number,
): AccountSimTx[] {
  const out: AccountSimTx[] = [];
  for (const l of lines) {
    const total = lineTotal(Number(l.qty_expected ?? 0), Number(l.unit_price ?? 0));
    if (total === 0) continue;
    const type = accountTypes.get(l.account_id);
    if (!type) continue;
    out.push({
      account_id: l.account_id,
      type,
      entry_date: `${year}-${String(l.month).padStart(2, "0")}-01`,
      amount_expected: total,
    });
  }
  return out;
}
