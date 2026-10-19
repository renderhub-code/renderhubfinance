/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import { periodTotal } from "./cashflow-totals";

describe("saldo acumulado", () => {
  test("Total é somente o saldo final do período, não a soma dos saldos mensais", () => {
    const months = [
      { expected: 100, realized: 7000 },
      { expected: 200, realized: 7310.93 },
    ];
    expect(periodTotal(months, true)).toEqual({ expected: 200, realized: 7310.93 });
    expect(periodTotal(months)).toEqual({ expected: 300, realized: 14310.93 });
  });
});