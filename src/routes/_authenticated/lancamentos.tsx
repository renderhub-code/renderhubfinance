import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableSkeleton } from "@/components/skeletons";
import { useAccounts, useTransactions } from "@/lib/queries";
import { useCompanyStore } from "@/lib/company-store";
import { useFinancialStore } from "@/lib/financial-store";
import { formatBRL, formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/lancamentos")({
  head: () => ({ meta: [
    { title: "Lançamentos — Hub Financial Command" },
    { name: "description", content: "Lançamentos financeiros previstos e realizados por empresa." },
    { property: "og:title", content: "Lançamentos — Hub Financial Command" },
    { property: "og:description", content: "Documentos financeiros importados e lançados no hub." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }), component: LancamentosPage,
});

function LancamentosPage() {
  const companyId = useCompanyStore((s) => s.activeCompanyId);
  const businessUnitId = useCompanyStore((s) => s.activeBusinessUnitId);
  const year = useFinancialStore((s) => s.year);
  const { data: txs, isLoading } = useTransactions(companyId, { from: `${year}-01-01`, to: `${year}-12-31`, businessUnitId });
  const { data: accounts } = useAccounts(companyId);
  const accountMap = useMemo(() => new Map(accounts?.map((a) => [a.id, `${a.code} · ${a.name}`]) ?? []), [accounts]);
  return <div className="space-y-6">
    <div><h1 className="text-2xl font-semibold">Lançamentos</h1><p className="text-sm text-muted-foreground">{txs?.length ?? 0} documentos financeiros em {year}.</p></div>
    <Card><CardHeader><CardTitle className="text-base">Documentos</CardTitle></CardHeader><CardContent className="overflow-x-auto">
      {isLoading ? <TableSkeleton rows={8} cols={8} /> : <Table><TableHeader><TableRow><TableHead>Competência</TableHead><TableHead>Vencimento</TableHead><TableHead>Histórico</TableHead><TableHead>Conta</TableHead><TableHead>Tipo</TableHead><TableHead>Status</TableHead><TableHead>Origem</TableHead><TableHead className="text-right">Previsto</TableHead><TableHead className="text-right">Realizado</TableHead></TableRow></TableHeader>
        <TableBody>{(txs ?? []).length === 0 ? <TableRow><TableCell colSpan={9} className="py-10 text-center text-muted-foreground">Nenhum lançamento no período.</TableCell></TableRow> : (txs ?? []).map((tx) => <TableRow key={tx.id}><TableCell className="whitespace-nowrap">{formatDate(tx.entry_date)}</TableCell><TableCell className="whitespace-nowrap">{formatDate(tx.due_date)}</TableCell><TableCell className="max-w-[280px] truncate">{tx.description ?? "—"}</TableCell><TableCell className="max-w-[240px] truncate text-muted-foreground">{accountMap.get(tx.account_id) ?? "—"}</TableCell><TableCell>{tx.type === "entrada" ? "Entrada" : "Saída"}</TableCell><TableCell><Badge variant={tx.status === "realizado" ? "default" : "secondary"}>{tx.status}</Badge></TableCell><TableCell>{tx.external_source?.startsWith("bling:") ? "Bling" : "Manual"}</TableCell><TableCell className="text-right whitespace-nowrap">{formatBRL(tx.amount_expected)}</TableCell><TableCell className="text-right whitespace-nowrap">{formatBRL(tx.amount_realized)}</TableCell></TableRow>)}</TableBody>
      </Table>}
    </CardContent></Card>
  </div>;
}