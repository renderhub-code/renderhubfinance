import { Fragment, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { MatrixSkeleton } from "@/components/skeletons";
import { useCashflowTree, hasValues, type CashflowNode, type MonthCell } from "@/lib/cashflow";
import { periodTotal } from "@/lib/cashflow-totals";
import { formatBRL, MONTHS_PT } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CashflowControls } from "@/components/CashflowControls";
import { CashflowReconciliation } from "@/components/CashflowReconciliation";

export const Route = createFileRoute("/_authenticated/fluxo-de-caixa")({
  head: () => ({ meta: [
    { title: "Fluxo de Caixa — Hub Financial Command" },
    { name: "description", content: "Fluxo de caixa detalhado por plano de contas, com previsto, realizado e delta mês a mês." },
    { property: "og:title", content: "Fluxo de Caixa — Hub Financial Command" },
    { property: "og:description", content: "Previsto, realizado e delta por categoria em cada mês do ano." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: FluxoCaixaPage,
});

function Cells({ months, strong, closingBalance }: { months: MonthCell[]; strong?: boolean; closingBalance?: boolean }) {
  const total = periodTotal(months, closingBalance);
  const blocks = [...months, total];
  return (
    <>
      {blocks.map((m, i) => {
        const delta = m.realized - m.expected;
        return (
          <Fragment key={i}>
            <td className={cn("px-2 py-1 text-right text-xs whitespace-nowrap tabular-nums", i === 12 && "border-l")}>
              {formatBRL(m.expected)}
            </td>
            <td className="px-2 py-1 text-right text-xs whitespace-nowrap tabular-nums">
              {formatBRL(m.realized)}
            </td>
            <td
              className={cn(
                "px-2 py-1 text-right text-xs whitespace-nowrap tabular-nums border-r",
                delta < 0 ? "text-destructive" : delta > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
                strong && "font-medium",
              )}
            >
              {formatBRL(delta)}
            </td>
          </Fragment>
        );
      })}
    </>
  );
}

function collectIds(nodes: CashflowNode[], acc: string[] = []): string[] {
  for (const n of nodes) {
    if (n.children.length) {
      acc.push(n.id);
      collectIds(n.children, acc);
    }
  }
  return acc;
}

function FluxoCaixaPage() {
  const { tree, summary, year, isLoading, snapshot, movements, error } = useCashflowTree();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showEmpty, setShowEmpty] = useState(false);

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const visibleTree = useMemo(() => {
    const filter = (nodes: CashflowNode[]): CashflowNode[] =>
      nodes
        .map((n) => ({ ...n, children: filter(n.children) }))
        .filter((n) => showEmpty || hasValues(n.months) || n.children.length > 0);
    return filter(tree);
  }, [tree, showEmpty]);

  const rows: CashflowNode[] = [];
  const push = (nodes: CashflowNode[]) => {
    for (const n of nodes) {
      rows.push(n);
      if (n.children.length && expanded.has(n.id)) push(n.children);
    }
  };
  push(visibleTree);

  const summaryRows = [
    { label: "(+) Entradas", months: summary.inflow },
    { label: "(−) Saídas", months: summary.outflow.map((m) => ({ expected: -m.expected, realized: -m.realized })) },
    { label: "Aportes / Movimentações dos sócios", months: summary.shareholders },
    { label: "(=) Variação de caixa", months: summary.variation, strong: true },
    { label: snapshot?.opening == null ? "Variação acumulada (saldo inicial pendente)" : "Saldo acumulado", months: summary.balance, strong: true, closingBalance: true },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Fluxo de Caixa</h1>
          <p className="text-sm text-muted-foreground">
            Detalhamento por plano de contas com previsto, realizado e delta de {year}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <CashflowControls year={year} opening={snapshot?.opening ?? null} />
          <div className="flex items-center gap-2">
            <Switch id="show-empty" checked={showEmpty} onCheckedChange={setShowEmpty} />
            <Label htmlFor="show-empty" className="text-xs text-muted-foreground">Mostrar contas sem valores</Label>
          </div>
          <Button variant="outline" size="sm" onClick={() => setExpanded(new Set(collectIds(visibleTree)))}>
            Expandir tudo
          </Button>
          <Button variant="outline" size="sm" onClick={() => setExpanded(new Set())}>
            Recolher tudo
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">Não foi possível carregar o caixa: {error.message}</p>}
      {!snapshot?.hasSnapshot && <p className="text-sm text-destructive">Caixa do Bling pendente de sincronização completa. Valores realizados importados não são presumidos.</p>}
      {snapshot?.opening == null && <p className="text-sm text-muted-foreground">Saldo inicial não informado: saldo absoluto pendente. A tabela mostra a variação acumulada.</p>}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Movimentação mensal — {year}</CardTitle>
        </CardHeader>
        <CardContent className="overflow-auto max-h-[70vh]">
          {isLoading ? (
            <MatrixSkeleton rows={10} />
          ) : (
            <table className="w-full border-separate border-spacing-0 text-sm">
              <thead>
                <tr>
                  <th
                    rowSpan={2}
                    className="sticky left-0 top-0 z-40 bg-card px-2 py-2 text-left align-bottom border-b border-r min-w-[280px]"
                  >
                    Descrição
                  </th>
                  {[...MONTHS_PT, "Total"].map((m) => (
                    <th key={m} colSpan={3} className="sticky top-0 z-30 h-8 bg-card px-2 py-1 text-center text-xs font-medium border-b border-r whitespace-nowrap">
                      {m}
                    </th>
                  ))}
                </tr>
                <tr>
                  {[...MONTHS_PT, "Total"].map((m) => (
                    <Fragment key={m}>
                      <th className="sticky top-8 z-30 bg-card px-2 py-1 text-right text-[10px] font-normal text-muted-foreground border-b whitespace-nowrap">Prev.</th>
                      <th className="sticky top-8 z-30 bg-card px-2 py-1 text-right text-[10px] font-normal text-muted-foreground border-b whitespace-nowrap">Real.</th>
                      <th className="sticky top-8 z-30 bg-card px-2 py-1 text-right text-[10px] font-normal text-muted-foreground border-b border-r whitespace-nowrap">Δ</th>
                    </Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={40} className="px-2 py-8 text-center text-sm text-muted-foreground">
                      Nenhum lançamento em {year}.
                    </td>
                  </tr>
                )}
                {rows.map((node) => {
                  const isOpen = expanded.has(node.id);
                  const canOpen = node.children.length > 0;
                  return (
                    <tr
                      key={`${node.level}-${node.id}`}
                      className={cn(
                        "border-b",
                        node.level === 0 && "bg-muted/60",
                        node.level === 1 && "bg-muted/25",
                      )}
                    >
                      <td
                        className={cn(
                          "sticky left-0 z-10 px-2 py-1 border-b border-r whitespace-nowrap",
                          node.level === 0 ? "bg-muted font-semibold" : node.level === 1 ? "bg-muted font-medium" : "bg-card",
                          (node.code === "X5" || node.name.includes("Sem categoria")) && hasValues(node.months) && "text-destructive",
                        )}
                        style={{ paddingLeft: 8 + node.level * 18 }}
                      >
                        <Button variant="ghost" size="sm"
                          onClick={() => canOpen && toggle(node.id)}
                          className={cn("h-auto p-0 flex items-center gap-1 text-left", !canOpen && "cursor-default")}
                        >
                          {canOpen ? (
                            isOpen ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                          ) : (
                            <span className="inline-block w-3.5" />
                          )}
                          <span className="text-xs text-muted-foreground">{node.code}</span>
                          <span className="text-xs">{node.name}</span>
                        </Button>
                      </td>
                      <Cells months={node.months} strong={node.level === 0} />
                    </tr>
                  );
                })}
                {summaryRows.map((row) => (
                  <tr key={row.label} className="border-t-2 bg-muted/40">
                    <td className="sticky left-0 z-10 bg-muted px-2 py-1 font-medium border-r whitespace-nowrap text-xs">
                      {row.label}
                    </td>
                    <Cells months={row.months} strong={row.strong} closingBalance={row.closingBalance} />
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
      <CashflowReconciliation year={year} movements={movements} inflow={summary.inflow} outflow={summary.outflow} syncedAt={snapshot?.syncedAt} />
    </div>
  );
}
