import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MatrixSkeleton } from "@/components/skeletons";
import { useAccountsWithDre, useTransactions } from "@/lib/queries";
import { useCompanyStore } from "@/lib/company-store";
import { useFinancialStore } from "@/lib/financial-store";
import { DRE_SECTION_META, type DreSection } from "@/lib/dre";
import { formatBRL, MONTHS_PT } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/dre")({
  head: () => ({ meta: [
    { title: "DRE — Hub Financial Command" },
    { name: "description", content: "Demonstração do Resultado do Exercício por empresa, mês e classificação contábil." },
    { property: "og:title", content: "DRE — Hub Financial Command" },
    { property: "og:description", content: "Resultado gerencial realizado e previsto por classificação contábil." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: DrePage,
});

const SECTIONS = Object.entries(DRE_SECTION_META).sort((a, b) => a[1].order - b[1].order) as [DreSection, (typeof DRE_SECTION_META)[DreSection]][];

function DrePage() {
  const companyId = useCompanyStore((s) => s.activeCompanyId);
  const businessUnitId = useCompanyStore((s) => s.activeBusinessUnitId);
  const year = useFinancialStore((s) => s.year);
  const { data: txs, isLoading } = useTransactions(companyId, { from: `${year}-01-01`, to: `${year}-12-31`, businessUnitId });
  const { data: accounts } = useAccountsWithDre(companyId);

  const report = useMemo(() => {
    const sectionByAccount = new Map(accounts?.map((a) => [a.id, a.subgroup?.group?.dre_section]) ?? []);
    const values = new Map<DreSection, { realized: number[]; expected: number[] }>();
    for (const [key] of SECTIONS) values.set(key, { realized: Array(12).fill(0), expected: Array(12).fill(0) });
    for (const tx of txs ?? []) {
      if (tx.status === "cancelado") continue;
      const section = sectionByAccount.get(tx.account_id) as DreSection | undefined;
      const bucket = section ? values.get(section) : undefined;
      const month = Number(tx.entry_date.slice(5, 7)) - 1;
      if (!bucket || month < 0 || month > 11) continue;
      if (tx.status === "realizado") bucket.realized[month] += Number(tx.amount_realized ?? 0);
      else if (tx.status === "previsto") bucket.expected[month] += Number(tx.amount_expected ?? 0);
    }
    return values;
  }, [accounts, txs]);

  const result = (month: number, mode: "realized" | "expected") => SECTIONS.reduce((total, [key, meta]) => total + (report.get(key)?.[mode][month] ?? 0) * meta.sign, 0);

  return <div className="space-y-6">
    <div><h1 className="text-2xl font-semibold">DRE</h1><p className="text-sm text-muted-foreground">Resultado gerencial realizado e previsto de {year}, conforme o plano de contas.</p></div>
    <Card><CardHeader><CardTitle className="text-base">Demonstração do resultado — {year}</CardTitle></CardHeader><CardContent className="overflow-x-auto">
      {isLoading ? <MatrixSkeleton rows={12} /> : <Table>
        <TableHeader><TableRow><TableHead className="whitespace-nowrap">Descrição</TableHead><TableHead>Visão</TableHead>{MONTHS_PT.map((m) => <TableHead key={m} className="text-right">{m}</TableHead>)}<TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
        <TableBody>
          {SECTIONS.flatMap(([key, meta]) => (["realized", "expected"] as const).map((mode) => {
            const months = report.get(key)?.[mode] ?? Array(12).fill(0);
            return <TableRow key={`${key}-${mode}`} className={mode === "realized" ? "bg-muted/20" : ""}>
              <TableCell className="font-medium whitespace-nowrap">{meta.label}</TableCell><TableCell className="text-xs text-muted-foreground">{mode === "realized" ? "Realizado" : "Previsto"}</TableCell>
              {months.map((value, index) => <TableCell key={index} className="text-right text-xs whitespace-nowrap">{formatBRL(value * meta.sign)}</TableCell>)}
              <TableCell className="text-right font-medium whitespace-nowrap">{formatBRL(months.reduce((a, b) => a + b, 0) * meta.sign)}</TableCell>
            </TableRow>;
          }))}
          {(["realized", "expected"] as const).map((mode) => <TableRow key={mode} className="bg-muted/60">
            <TableCell className="font-semibold">(=) Resultado Líquido</TableCell><TableCell className="text-xs font-medium">{mode === "realized" ? "Realizado" : "Previsto"}</TableCell>
            {MONTHS_PT.map((_, index) => <TableCell key={index} className="text-right text-xs font-semibold whitespace-nowrap">{formatBRL(result(index, mode))}</TableCell>)}
            <TableCell className="text-right font-semibold whitespace-nowrap">{formatBRL(MONTHS_PT.reduce((sum, _, index) => sum + result(index, mode), 0))}</TableCell>
          </TableRow>)}
        </TableBody>
      </Table>}
    </CardContent></Card>
  </div>;
}