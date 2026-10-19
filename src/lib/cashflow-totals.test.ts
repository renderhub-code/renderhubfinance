import { describe, it } from "node:test";
import { deepStrictEqual } from "node:assert";
import { periodTotal } from "./cashflow-totals";

describe("saldo acumulado", () => {
  it("Total é somente o saldo final do período, não a soma dos saldos mensais", () => {
    const months = [
      { expected: 100, realized: 7000 },
      { expected: 200, realized: 7310.93 },
    ];
    deepStrictEqual(periodTotal(months, true), { expected: 200, realized: 7310.93 });
    deepStrictEqual(periodTotal(months), { expected: 300, realized: 14310.93 });
  });
});