import { describe, it } from "node:test";
import { expect } from "./test-expect";
import { buildCashFlow, deltaOf } from "./cashflow-blocks";

const groups = ["1", "4", "9", "11", "13"].map((c) => ({ id: "g" + c, code: c, name: "G" + c }));
const subgroups = groups.map((g) => ({ id: "s" + g.code, group_id: g.id }));
const acc = (code: string) => ({ id: "a" + code, code, name: code, active: true, subgroup_id: "s" + code.split(".")[0] });
const accounts = ["1.01", "4.01", "9.01", "11.01", "13.01"].map(acc);
const tx = (code: string, type: string, e: number, r: number, status = "previsto") => ({
  entry_date: "2026-03-10", type, status, amount_expected: e, amount_realized: r, account_id: "a" + code,
});

describe("fluxo de caixa", () => {
  it("▲ = realizado − previsto", () => {
    expect(deltaOf(100, 80)).toBe(-20);
  });

  it("variação soma operacional, investimento, financiamento e transferências", () => {
    const cf = buildCashFlow(
      [tx("1.01", "entrada", 1000, 900), tx("4.01", "saida", 300, 200), tx("9.01", "entrada", 50, 50),
       tx("11.01", "saida", 100, 0), tx("13.01", "saida", 20, 20), tx("1.01", "entrada", 999, 999, "cancelado")],
      accounts, groups, subgroups,
    );
    expect(cf.variation.expected[2]).toBe(1000 - 300 + 50 - 100 - 20);
    expect(cf.variation.realized[2]).toBe(900 - 200 + 50 - 0 - 20);
    expect(cf.blocks.find((b) => b.key === "fin")!.groups.map((g) => g.code)).toEqual(["9"]);
    expect(cf.blocks.find((b) => b.key === "inv")!.totals.expected[2]).toBe(-100);
  });
});

import { cashFlowByCompany as _byCo } from "./cashflow-blocks";
describe("cashFlowByCompany", () => {
  it("separa entradas e saídas realizadas por empresa", () => {
    const accounts = [
      { id: "a1", code: "1.01", name: "R", active: true, subgroup_id: "s1" },
      { id: "a2", code: "3.01", name: "C", active: true, subgroup_id: "s3" },
    ];
    const groups = [{ id: "g1", code: "1", name: "Rec" }, { id: "g3", code: "3", name: "Cus" }];
    const subs = [{ id: "s1", group_id: "g1" }, { id: "s3", group_id: "g3" }];
    const tx = (c: string, acc: string, type: string, v: number) => ({ company_id: c, entry_date: "2026-03-05", type, status: "realizado", amount_expected: 0, amount_realized: v, account_id: acc });
    const r = _byCo([tx("A", "a1", "entrada", 1000), tx("A", "a2", "saida", 300), tx("B", "a1", "entrada", 50)], accounts, groups, subs);
    expect(r.A.in[2]).toBe(1000);
    expect(r.A.out[2]).toBe(300);
    expect(r.A.in[2] - r.A.out[2]).toBe(700);
    expect(r.B.in[2]).toBe(50);
    expect(r.B.out[2]).toBe(0);
  });
});
