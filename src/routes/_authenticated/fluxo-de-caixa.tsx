import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MatrixSkeleton } from "@/components/skeletons";
import { useForecastByMonth } from "@/lib/forecast";
import { formatBRL, MONTHS_PT } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/fluxo-de-caixa")({
  head: () => ({ meta: [
    { title: "Fluxo de Caixa — Hub Financial Command" },
    { name: "description", content: "Fluxo de caixa realizado e projetado mês a mês." },
    { property: "og:title", content: "Fluxo de Caixa — Hub Financial Command" },
    { property: "og:description", content: "Entradas, saídas e saldo mensal realizado e projetado." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: FluxoCaixaPage,
});

function FluxoCaixaPage() {
  const { expectedIn, expectedOut, realizedIn, realizedOut, year, isLoading } = useForecastByMonth();
  const realizedVariation = realizedIn.map((value, index) => value - realizedOut[index]);
  const projectedVariation = expectedIn.map((value, index) => value - expectedOut[index]);
  let realizedBalance = 0;
  let projectedBalance = 0;
  const realizedClosing = realizedVariation.map((value) => (realizedBalance += value));
  const projectedClosing = realizedVariation.map((value, index) => (projectedBalance += value + projectedVariation[index]));
  const rows = [
    { label: "(+) Entradas", mode: "Realizado", values: realizedIn },
    { label: "(−) Saídas", mode: "Realizado", values: realizedOut.map((v) => -v) },
    { label: "(=) Variação de caixa", mode: "Realizado", values: realizedVariation, strong: true },
    { label: "Saldo acumulado", mode: "Realizado", values: realizedClosing, strong: true },
    { label: "(+) Entradas", mode: "Previsto", values: expectedIn },
    { label: "(−) Saídas", mode: "Previsto", values: expectedOut.map((v) => -v) },
    { label: "(=) Variação projetada", mode: "Previsto", values: projectedVariation, strong: true },
    { label: "Saldo final projetado", mode: "Realizado + previsto", values: projectedClosing, strong: true },
  ];
  return <div className="space-y-6">
    <div><h1 className="text-2xl font-semibold">Fluxo de Caixa</h1><p className="text-sm text-muted-foreground">Caixa realizado e projeção dos títulos em aberto de {year}.</p></div>
    <Card><CardHeader><CardTitle className="text-base">Movimentação mensal — {year}</CardTitle></CardHeader><CardContent className="overflow-x-auto">
      {isLoading ? <MatrixSkeleton rows={8} /> : <Table><TableHeader><TableRow><TableHead>Descrição</TableHead><TableHead>Visão</TableHead>{MONTHS_PT.map((m) => <TableHead key={m} className="text-right">{m}</TableHead>)}<TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
        <TableBody>{rows.map((row) => <TableRow key={`${row.label}-${row.mode}`} className={row.strong ? "bg-muted/40" : ""}><TableCell className={row.strong ? "font-medium whitespace-nowrap" : "whitespace-nowrap"}>{row.label}</TableCell><TableCell className="text-xs text-muted-foreground whitespace-nowrap">{row.mode}</TableCell>{row.values.map((value, index) => <TableCell key={index} className="text-right text-xs whitespace-nowrap">{formatBRL(value)}</TableCell>)}<TableCell className="text-right font-medium whitespace-nowrap">{formatBRL(row.values.reduce((a, b) => a + b, 0))}</TableCell></TableRow>)}</TableBody>
      </Table>}
    </CardContent></Card>
  </div>;
}