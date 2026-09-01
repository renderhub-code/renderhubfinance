import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MatrixSkeleton } from "@/components/skeletons";
import { useForecastByMonth, FORECAST_YEAR } from "@/lib/forecast";
import { formatBRL } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/fluxo-de-caixa")({
  head: () => ({
    meta: [
      { title: "Fluxo de Caixa — Hub Financial Command" },
      { name: "description", content: "Fluxo de caixa direto mês a mês, com colunas previstas." },
      { property: "og:title", content: "Fluxo de Caixa — Hub Financial Command" },
      { property: "og:description", content: "Entradas e saídas previstas mês a mês pelo método direto." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FluxoCaixaPage,
});

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const STATIC_ROWS = [
  { label: "(+/−) Atividades de Investimento" },
  { label: "(+/−) Atividades de Financiamento" },
];

function FluxoCaixaPage() {
  const { revenue, cost, isLoading } = useForecastByMonth();
  const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);

  const variation = revenue.map((r, i) => r - cost[i]);
  const opening: number[] = [];
  const closing: number[] = [];
  let balance = 0;
  for (let i = 0; i < 12; i++) {
    opening.push(balance);
    balance += variation[i];
    closing.push(balance);
  }

  const dataRows: { label: string; values: number[]; strong?: boolean; total?: number | null }[] = [
    { label: "Saldo Inicial", values: opening, strong: true, total: null },
    { label: "(+) Entradas Operacionais", values: revenue, total: sum(revenue) },
    { label: "(−) Saídas Operacionais", values: cost, total: sum(cost) },
    { label: "(=) Fluxo de Caixa Operacional", values: variation, strong: true, total: sum(variation) },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Fluxo de Caixa</h1>
        <p className="text-sm text-muted-foreground">
          Método direto (NBC TG 03 / CPC 03) — colunas previstas de {FORECAST_YEAR}.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mensal — previsto {FORECAST_YEAR}</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {isLoading ? (
            <MatrixSkeleton rows={8} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Descrição</TableHead>
                  {MONTHS.map((m) => (
                    <TableHead key={m} className="text-right">{m}</TableHead>
                  ))}
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dataRows.map((r) => (
                  <TableRow key={r.label} className={r.strong ? "bg-muted/40" : ""}>
                    <TableCell className={(r.strong ? "font-medium " : "") + "whitespace-nowrap"}>{r.label}</TableCell>
                    {r.values.map((v, i) => (
                      <TableCell key={i} className="text-right text-xs whitespace-nowrap">{formatBRL(v)}</TableCell>
                    ))}
                    <TableCell className="text-right font-medium whitespace-nowrap">
                      {r.total === null ? "—" : formatBRL(r.total ?? 0)}
                    </TableCell>
                  </TableRow>
                ))}
                {STATIC_ROWS.map((r) => (
                  <TableRow key={r.label}>
                    <TableCell className="whitespace-nowrap">{r.label}</TableCell>
                    {MONTHS.map((m) => (
                      <TableCell key={m} className="text-right text-muted-foreground">—</TableCell>
                    ))}
                    <TableCell className="text-right text-muted-foreground">—</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/40">
                  <TableCell className="font-medium whitespace-nowrap">(=) Variação de Caixa</TableCell>
                  {variation.map((v, i) => (
                    <TableCell key={i} className="text-right text-xs whitespace-nowrap font-medium">{formatBRL(v)}</TableCell>
                  ))}
                  <TableCell className="text-right font-medium whitespace-nowrap">{formatBRL(sum(variation))}</TableCell>
                </TableRow>
                <TableRow className="bg-muted/40">
                  <TableCell className="font-medium whitespace-nowrap">Saldo Final</TableCell>
                  {closing.map((v, i) => (
                    <TableCell key={i} className="text-right text-xs whitespace-nowrap font-medium">{formatBRL(v)}</TableCell>
                  ))}
                  <TableCell className="text-right font-medium whitespace-nowrap">{formatBRL(closing[11] ?? 0)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
