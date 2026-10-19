import { describe, it } from "node:test";
import { strictEqual } from "node:assert";
import { cashDate, cashKind, reconciled } from "./cashflow-rules";
describe("regras de caixa", () => {
  it("baixa usa data efetiva, não competência", () => strictEqual(cashDate("19/10/2026"), "2026-10-19"));
  it("ajuste de saldo fica fora da operação", () => strictEqual(cashKind("S", "", "Vendas de serviços"), "adjustment"));
  it("transferência própria fica fora da operação", () => strictEqual(cashKind("N", "S", "Vendas de produtos"), "transfer"));
  it("aporte fica separado da operação", () => strictEqual(cashKind("N", "", "Aporte Sócio"), "shareholder"));
  it("retirada de sócios fica separada", () => strictEqual(cashKind("N", "", "", "12.04"), "shareholder"));
  it("tolerância é um real", () => { strictEqual(reconciled(1), true); strictEqual(reconciled(1.01), false); });
});