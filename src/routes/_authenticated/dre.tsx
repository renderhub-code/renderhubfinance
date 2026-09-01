import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MatrixSkeleton } from "@/components/skeletons";
import { useForecastByMonth, FORECAST_YEAR } from "@/lib/forecast";
import { formatBRL } from "@/lib/format";


export const Route = createFileRoute("/_authenticated/dre")({
  head: () => ({
    meta: [
      { title: "DRE — Hub Financial Command" },
      { name: "description", content: "Demonstração do Resultado do Exercício mês a mês." },
      { property: "og:title", content: "DRE — Hub Financial Command" },
      { property: "og:description", content: "Resultado gerencial mês a mês, com receitas e custos previstos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DrePage,
});

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const YEAR = FORECAST_YEAR;

const STATIC_ROWS: { label: string; total?: boolean }[] = [
  { label: "(−) Deduções da Receita" },
  { label: "(=) Receita Operacional Líquida", total: true },
  { label: "(−) Despesas Comerciais" },
  { label: "(−) Despesas Administrativas" },
  { label: "(−) Outras Despesas Operacionais" },
  { label: "(=) EBITDA", total: true },
  { label: "(−) Depreciação e Amortização" },
  { label: "(=) EBIT — Resultado Operacional", total: true },
  { label: "(+) Receitas Financeiras" },
  { label: "(−) Despesas Financeiras" },
  { label: "(=) LAIR — Lucro Antes do IR/CSLL", total: true },
  { label: "(−) IRPJ / CSLL" },
  { label: "(=) Lucro Líquido do Exercício", total: true },
];


function DrePage() {
  const { revenue, cost, isLoading } = useForecastByMonth();
  const grossProfit = revenue.map((r, i) => r - cost[i]);
  const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">DRE</h1>
        <p className="text-sm text-muted-foreground">
          Demonstração do Resultado do Exercício (NBC TG 26 / CPC 26) — colunas previstas de {YEAR}.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Estrutura gerencial — previsto {YEAR}</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {isLoading ? (
            <MatrixSkeleton rows={10} />
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
                <TableRow className="bg-muted/40">
                  <TableCell className="font-medium whitespace-nowrap">Receita Operacional Bruta</TableCell>
                  {revenue.map((v, i) => (
                    <TableCell key={i} className="text-right whitespace-nowrap text-xs">{formatBRL(v)}</TableCell>
                  ))}
                  <TableCell className="text-right font-medium whitespace-nowrap">{formatBRL(sum(revenue))}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="whitespace-nowrap">(−) Custo dos Produtos/Serviços Vendidos (CMV/CPV)</TableCell>
                  {cost.map((v, i) => (
                    <TableCell key={i} className="text-right whitespace-nowrap text-xs">{formatBRL(v)}</TableCell>
                  ))}
                  <TableCell className="text-right whitespace-nowrap">{formatBRL(sum(cost))}</TableCell>
                </TableRow>
                <TableRow className="bg-muted/40">
                  <TableCell className="font-medium whitespace-nowrap">(=) Lucro Bruto</TableCell>
                  {grossProfit.map((v, i) => (
                    <TableCell key={i} className="text-right whitespace-nowrap text-xs font-medium">{formatBRL(v)}</TableCell>
                  ))}
                  <TableCell className="text-right font-medium whitespace-nowrap">{formatBRL(sum(grossProfit))}</TableCell>
                </TableRow>
                {STATIC_ROWS.map((r) => (
                  <TableRow key={r.label} className={r.total ? "bg-muted/40" : ""}>
                    <TableCell className={(r.total ? "font-medium " : "") + "whitespace-nowrap"}>{r.label}</TableCell>
                    {MONTHS.map((m) => (
                      <TableCell key={m} className="text-right text-muted-foreground">—</TableCell>
                    ))}
                    <TableCell className="text-right text-muted-foreground">—</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
