import { describe, it } from "node:test";
import { expect } from "./test-expect";
import { parseRows } from "./lancamentos-import";

const accounts = [{ id: "a1", code: "1.01", name: "Receita de Serviços", type: "entrada" as const }];
const H = ["Data do Documento", "Nº do Documento", "Data do Pagamento", "Valor Pago", "Histórico", "Descrição", "Categoria", "Conta Financeira", "Banco", "Conta"];

describe("importação de lançamentos", () => {
  it("aceita linha só com Data do Pagamento e Conta Financeira", () => {
    const r = parseRows([H, ["", "", "05/01/2026", "", "", "", "", "1.01", "", ""]], accounts, []);
    expect(r.rejected).toHaveLength(0);
    expect(r.ok[0]).toMatchObject({ entry_date: "2026-01-05", settled_date: "2026-01-05", amount: 0, description: null });
  });
  it("recusa linha sem Data do Pagamento", () => {
    const r = parseRows([H, ["05/01/2026", "1", "", "10", "", "", "", "1.01", "", ""]], accounts, []);
    expect(r.ok).toHaveLength(0);
    expect(r.rejected[0].reason).toBe("Data do Pagamento vazia");
  });
  it("recusa linha sem Conta Financeira", () => {
    const r = parseRows([H, ["", "", "05/01/2026", "10", "", "", "", "", "", ""]], accounts, []);
    expect(r.rejected[0].reason).toBe("Conta Financeira vazia");
  });
  it("recusa conta inexistente", () => {
    const r = parseRows([H, ["", "", "05/01/2026", "10", "", "", "", "9.99", "", ""]], accounts, []);
    expect(r.ok).toHaveLength(0);
  });
  it("encontra conta pelo De-Para", () => {
    const r = parseRows([H, ["", "", "05/01/2026", "1.234,56", "", "", "", "X-100", "", ""]], accounts, [{ source_code: "X-100", source_name: null, account_id: "a1" }]);
    expect(r.ok[0]).toMatchObject({ account_id: "a1", amount: 1234.56 });
  });
});

describe("sinal dos valores", () => {
  const accs = [
    { id: "r", code: "1.01", name: "Receita", type: "entrada" as const },
    { id: "d", code: "5.01", name: "Despesa", type: "saida" as const },
  ];
  const row = (acc: string, v: string) => parseRows([H, ["", "", "05/01/2026", v, "", "", "", acc, "", ""]], accs, []).ok[0].amount;
  it("receita positiva", () => expect(row("1.01", "1.000,00")).toBe(1000));
  it("receita negativa vira dedução", () => expect(row("1.01", "-200,00")).toBe(-200));
  it("despesa negativa é despesa normal", () => expect(row("5.01", "-380,00")).toBe(380));
  it("despesa positiva vira dedução", () => expect(row("5.01", "50,00")).toBe(-50));
});
