export type DreSection =
  | "receita_bruta"
  | "deducoes"
  | "custos"
  | "despesas_operacionais"
  | "despesas_administrativas"
  | "despesas_comerciais"
  | "receitas_financeiras"
  | "despesas_financeiras"
  | "investimentos"
  | "nao_operacional";

export const DRE_SECTION_META: Record<
  DreSection,
  { label: string; sign: 1 | -1; order: number }
> = {
  receita_bruta: { label: "Receita Bruta", sign: 1, order: 10 },
  deducoes: { label: "(-) Deduções", sign: -1, order: 20 },
  custos: { label: "(-) Custos", sign: -1, order: 40 },
  despesas_operacionais: { label: "(-) Despesas Operacionais", sign: -1, order: 60 },
  despesas_administrativas: { label: "(-) Despesas Administrativas", sign: -1, order: 65 },
  despesas_comerciais: { label: "(-) Despesas Comerciais", sign: -1, order: 70 },
  receitas_financeiras: { label: "(+) Receitas Financeiras", sign: 1, order: 80 },
  despesas_financeiras: { label: "(-) Despesas Financeiras", sign: -1, order: 85 },
  investimentos: { label: "(-) Investimentos", sign: -1, order: 90 },
  nao_operacional: { label: "Não Operacional", sign: 1, order: 95 },
};

// Synthetic subtotal rows in DRE report (computed, not stored)
export const DRE_SUBTOTALS = [
  { key: "receita_liquida", label: "= Receita Líquida", after: "deducoes", parts: [["receita_bruta", 1], ["deducoes", -1]] as const, order: 30 },
  { key: "lucro_bruto", label: "= Lucro Bruto", after: "custos", parts: [["receita_bruta", 1], ["deducoes", -1], ["custos", -1]] as const, order: 50 },
  { key: "resultado_operacional", label: "= Resultado Operacional", after: "despesas_comerciais",
    parts: [["receita_bruta", 1], ["deducoes", -1], ["custos", -1], ["despesas_operacionais", -1], ["despesas_administrativas", -1], ["despesas_comerciais", -1]] as const, order: 75 },
  { key: "resultado_liquido", label: "= Resultado Líquido", after: "investimentos",
    parts: [["receita_bruta", 1], ["deducoes", -1], ["custos", -1], ["despesas_operacionais", -1], ["despesas_administrativas", -1], ["despesas_comerciais", -1], ["receitas_financeiras", 1], ["despesas_financeiras", -1], ["investimentos", -1]] as const, order: 92 },
];
