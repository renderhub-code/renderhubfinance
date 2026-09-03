import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAccounts, useTransactions } from "@/lib/queries";
import { useCompanyStore } from "@/lib/company-store";
import { useFinancialStore } from "@/lib/financial-store";
import { formatBRL } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Hub Financial Command" },
      { name: "description", content: "Visão geral financeira: receitas, despesas, resultado e caixa do período." },
      { property: "og:title", content: "Dashboard — Hub Financial Command" },
      { property: "og:description", content: "Receitas, despesas, resultado e últimos lançamentos do período corrente." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DashboardPage,
});

const MONTH = new Date().getMonth() + 1;

function amountOf(t: { status: string; amount_realized: number; amount_expected: number }) {
  const realized = Number(t.amount_realized ?? 0);
  return realized !== 0 ? realized : Number(t.amount_expected ?? 0);
}

function DashboardPage() {
  const companyId = useCompanyStore((s) => s.activeCompanyId);
  const businessUnitId = useCompanyStore((s) => s.activeBusinessUnitId);
  const year = useFinancialStore((s) => s.year);
  const { data: txs, isLoading } = useTransactions(companyId, {
    from: `${year}-01-01`,
    to: `${year}-12-31`,
    businessUnitId,
  });
  const { data: accounts } = useAccounts(companyId);

  const accountName = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of accounts ?? []) map.set(a.id, `${a.code} · ${a.name}`);
    return map;
  }, [accounts]);

  const kpis = useMemo(() => {
    let revenue = 0;
    let expense = 0;
    let cashIn = 0;
    let cashOut = 0;
    const monthPrefix = `${year}-${String(MONTH).padStart(2, "0")}`;
    for (const t of txs ?? []) {
      if (t.status === "cancelado") continue;
      const v = amountOf(t);
      const isMonth = t.entry_date.startsWith(monthPrefix);
      if (isMonth) {
        if (t.type === "entrada") revenue += v;
        else expense += v;
      }
      if (t.status === "realizado") {
        if (t.type === "entrada") cashIn += v;
        else cashOut += v;
      }
    }
    return { revenue, expense, result: revenue - expense, cash: cashIn - cashOut };
  }, [txs, year]);

  const latest = (txs ?? []).slice(0, 8);

  const cards = [
    { label: `Receitas — mês ${MONTH}/${year}`, value: kpis.revenue },
    { label: `Despesas — mês ${MONTH}/${year}`, value: kpis.expense },
    { label: `Resultado — mês ${MONTH}/${year}`, value: kpis.result },
    { label: `Caixa realizado — ${year}`, value: kpis.cash },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Visão geral do resultado e do caixa no período corrente.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((k) => (
          <Card key={k.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{k.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={"text-2xl font-semibold " + (k.value < 0 ? "text-destructive" : "")}>
                {isLoading ? "—" : formatBRL(k.value)}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Últimos lançamentos</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Histórico</TableHead>
                <TableHead>Conta</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {latest.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    {isLoading ? "Carregando…" : "Nenhum lançamento no período."}
                  </TableCell>
                </TableRow>
              ) : (
                latest.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="whitespace-nowrap">
                      {t.entry_date.split("-").reverse().join("/")}
                    </TableCell>
                    <TableCell className="max-w-[320px] truncate">{t.description ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{accountName.get(t.account_id) ?? "—"}</TableCell>
                    <TableCell className="capitalize">{t.status}</TableCell>
                    <TableCell>{t.external_source?.startsWith("bling:") ? "Bling" : "Manual"}</TableCell>
                    <TableCell className={"text-right whitespace-nowrap " + (t.type === "saida" ? "text-destructive" : "")}>
                      {t.type === "saida" ? "−" : ""}
                      {formatBRL(amountOf(t))}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
