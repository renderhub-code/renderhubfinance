import { useState } from "react";
import { Button } from "./ui/button";
import { CASH_REFERENCES, reconciled } from "@/lib/cashflow-rules";
import type { CashEntry } from "@/lib/cashflow-queries";
import type { MonthCell } from "@/lib/cashflow";
import { formatBRL, MONTHS_PT } from "@/lib/format";
import { useCompanyStore } from "@/lib/company-store";

export function CashflowReconciliation({ year, movements, inflow, outflow, syncedAt }: { year: number; movements: CashEntry[]; inflow: MonthCell[]; outflow: MonthCell[]; syncedAt?: string | null }) {
  const companyId = useCompanyStore(s => s.activeCompanyId);
  const [month, setMonth] = useState<number | null>(null);
  return <section className="space-y-3">
    <h2 className="text-lg font-semibold">Conciliação mensal</h2>
    <p className="text-sm text-muted-foreground">Última sincronização: {syncedAt ? new Date(syncedAt).toLocaleString("pt-BR") : "Pendente"}</p>
    <div className="overflow-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-2">Mês</th><th className="p-2">Movimento</th><th className="p-2">Bling</th><th className="p-2">Plataforma</th><th className="p-2">Diferença</th><th className="p-2">Referência enviada</th><th className="p-2">Δ referência</th><th className="p-2">Conferência</th></tr></thead><tbody>
      {MONTHS_PT.flatMap((label, m) => ["entrada", "saida"].map(type => {
        const bling = movements.filter(e => e.date.startsWith(`${year}-`) && e.kind === "operation" && e.type === type && Number(e.date.slice(5, 7)) - 1 === m).reduce((sum, e) => sum + e.amount, 0);
        const platform = (type === "entrada" ? inflow : outflow)[m].realized;
        const ref = year === 2026 && companyId === "0c3d7a6e-24bc-4ea1-9009-2112a2f31f6a" ? CASH_REFERENCES[m]?.[type === "entrada" ? 0 : 1] : null;
        const difference = platform - bling;
        const ok = !!syncedAt && reconciled(difference) && (ref == null || reconciled(platform - ref));
        return <tr key={`${m}-${type}`} className="border-b tabular-nums"><td className="p-2">{label}</td><td className="p-2">{type === "entrada" ? "Entradas operacionais" : "Saídas"}</td><td className="p-2 whitespace-nowrap">{syncedAt ? formatBRL(bling) : "Pendente"}</td><td className="p-2 whitespace-nowrap">{formatBRL(platform)}</td><td className="p-2 whitespace-nowrap">{syncedAt ? formatBRL(difference) : "—"}</td><td className="p-2 whitespace-nowrap">{ref == null ? "—" : formatBRL(ref)}</td><td className="p-2 whitespace-nowrap">{ref == null ? "—" : formatBRL(platform - ref)}</td><td className="p-2"><Button variant="ghost" size="sm" className={ok ? "text-primary" : "text-destructive"} onClick={() => setMonth(month === m ? null : m)}>{ok ? "Conciliado" : "Não conciliado"}</Button></td></tr>;
      }))}
    </tbody></table></div>
    {month !== null && <div className="overflow-auto max-h-96"><h3 className="font-medium">Movimentos do Bling — {MONTHS_PT[month]}</h3><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-2">Data</th><th className="p-2">Categoria</th><th className="p-2">Descrição</th><th className="p-2">Classificação</th><th className="p-2">Valor</th></tr></thead><tbody>{movements.filter(e => Number(e.date.slice(5, 7)) - 1 === month).map((e, i) => <tr key={i} className="border-b"><td className="p-2 whitespace-nowrap">{e.date.split("-").reverse().join("/")}</td><td className="p-2">{e.category_name}</td><td className="p-2">{e.description}</td><td className="p-2">{{ operation: "Operação", shareholder: "Sócios", transfer: "Transferência própria", adjustment: "Ajuste de saldo" }[e.kind]}</td><td className="p-2 whitespace-nowrap">{formatBRL(e.amount * (e.type === "saida" ? -1 : 1))}</td></tr>)}</tbody></table></div>}
  </section>;
}