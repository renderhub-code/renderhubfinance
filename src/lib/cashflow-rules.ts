export type CashKind = "operation" | "shareholder" | "transfer" | "adjustment";

export function cashDate(value: string): string {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : value.split("/").reverse().join("-");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date))) throw new Error("Data de caixa inválida.");
  return date;
}

export function cashKind(saldo: string, transferencia: string, category: string, accountCode?: string): CashKind {
  if (saldo === "S") return "adjustment";
  if (transferencia === "S") return "transfer";
  const label = category.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  if (["aporte socio", "aporte de socios", "aporte de capital", "retirada socio", "retirada de socios", "distribuicao de lucros"].includes(label) || ["12.03", "12.04", "13.01", "13.02", "13.03", "13.04", "11.03"].includes(accountCode ?? "")) return "shareholder";
  if (["transferencias de entrada", "transferencias de saida", "transferencia entre contas bancarias"].includes(label)) return "transfer";
  if (label === "ajuste de saldo") return "adjustment";
  return "operation";
}

export const CASH_REFERENCES = [
  [95291, 93386.80], [84330, 82833.42], [96680.88, 104423.65],
  [98168.49, 101402.93], [94927.50, 78361.40], [37502.98, 75882.66],
  [88579.09, 84497.58], [75175.75, 77496.30], [92537.90, 105489.88],
  [52310.93, null],
] as const;
export const reconciled = (difference: number) => Math.abs(difference) <= 1;