import { describe, it } from "node:test";
import { expect } from "./test-expect";
import { buildAccountSimTxs } from "./account-simulation";

const types = new Map<string, "entrada" | "saida">([["r", "entrada"], ["d", "saida"]]);

describe("buildAccountSimTxs", () => {
  it("Total = Quantidade × Valor no dia 1º do mês", () => {
    const tx = buildAccountSimTxs([{ account_id: "r", month: 3, qty_expected: 4, unit_price: 250 }], types, 2026);
    expect(tx).toEqual([{ account_id: "r", type: "entrada", entry_date: "2026-03-01", amount_expected: 1000 }]);
  });
  it("ignora meses com Total zero", () => {
    const tx = buildAccountSimTxs([
      { account_id: "r", month: 1, qty_expected: 0, unit_price: 100 },
      { account_id: "d", month: 2, qty_expected: 5, unit_price: 0 },
    ], types, 2026);
    expect(tx).toHaveLength(0);
  });
  it("tipo vem da natureza da conta", () => {
    const tx = buildAccountSimTxs([{ account_id: "d", month: 12, qty_expected: 2, unit_price: 50 }], types, 2026);
    expect(tx[0].type).toBe("saida");
    expect(tx[0].amount_expected).toBe(100);
  });
});
