import { useState, Fragment, type CSSProperties } from "react";
import { Plus, Minus, ChevronsDownUp, ChevronsUpDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MatrixSkeleton } from "@/components/skeletons";
import { useCashFlow } from "@/lib/forecast";
import { useFinancialStore } from "@/lib/financial-store";
import { useCompanies } from "@/lib/queries";
import { deltaOf, type PR } from "@/lib/cashflow-blocks";
import {
  ResponsiveContainer, ComposedChart, Bar, Line, Area, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTip({ active, payload, label }: any) {
  const year = useFinancialStore((s) => s.year);
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as { Entradas: number; Saídas: number; Saldo: number; empresas?: { nome: string; e: number; s: number }[] };
  const res = d.Entradas - d.Saídas;
  const row = (n: string, v: number, c: string) => (
    <div className="flex items-center justify-between gap-6">
      <span className="inline-flex items-center gap-1.5 text-muted-foreground"><span className="h-2 w-2 rounded-full" style={{ background: c }} />{n}</span>
      <span className="font-medium">{money(v)}</span>
    </div>
  );
  return (
    <div className="rounded-lg border bg-popover text-popover-foreground shadow-md px-3 py-2 text-xs tabular-nums space-y-1 min-w-48">
      <div className="font-semibold mb-1">{label} {year}</div>
      {row("Entradas", d.Entradas, "var(--flow-in)")}
      {row("Saídas", d.Saídas, "var(--flow-out)")}
      {row("Saldo", d.Saldo, "var(--primary)")}
      <div className="flex justify-between gap-6 border-t pt-1 mt-1">
        <span className="text-muted-foreground">Resultado do mês</span>
        <span className={`font-semibold ${res >= 0 ? "text-positive" : "text-destructive"}`}>{money(res)}</span>
      </div>
      {!!d.empresas?.length && (
        <div className="border-t pt-1.5 mt-1.5 space-y-1">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Por empresa</div>
          {d.empresas.map((c) => (
            <div key={c.nome} className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3">
              <span className="font-medium truncate max-w-32">{c.nome}</span>
              <span style={{ color: "var(--flow-in)" }}>{money(c.e)}</span>
              <span style={{ color: "var(--flow-out)" }}>{money(c.s)}</span>
              <span className={c.e - c.s >= 0 ? "text-positive" : "text-destructive"}>{money(c.e - c.s)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0, minimumFractionDigits: 0 });
const compact = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });
const money = (v: number) => fmt.format(Math.round(v) || 0);
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

const BLOCK_COLOR: Record<string, string> = {
  in: "var(--flow-in)", out: "var(--flow-out)", inv: "var(--flow-invest)", fin: "var(--flow-finance)", tr: "var(--flow-transfer)",
};
const BLOCK_NAME: Record<string, string> = {
  in: "Entradas", out: "Saídas", inv: "Investimento", fin: "Financiamento", tr: "Transferências",
};
const soft = (c: string, pct: number) => `color-mix(in oklab, ${c} ${pct}%, var(--card))`;

type RowKind = "balance" | "band" | "section" | "item" | "sectionTotal" | "blockTotal" | "spacer";

const BLOCK_TITLE: Record<string, { band: string; total: string; sign: string }> = {
  in: { band: "(+) Recebimentos", total: "Total de Recebimentos", sign: "(+)" },
  out: { band: "(−) Pagamentos", total: "Total de Pagamentos", sign: "(−)" },
  inv: { band: "(+/−) Investimentos", total: "Total de Investimentos", sign: "(+/−)" },
  fin: { band: "(+/−) Financiamentos", total: "Total de Financiamentos", sign: "(+/−)" },
  tr: { band: "(+/−) Transferências e Não Operacional", total: "Total de Transferências e Não Operacional", sign: "(+/−)" },
};

function Num({ v, className = "", onColor }: { v: number; className?: string; onColor?: boolean }) {
  const r = Math.round(v);
  if (!r) return <span className={onColor ? "opacity-50" : "text-muted-foreground/40"}>–</span>;
  return <span className={className}>{money(r)}</span>;
}

function Delta({ d, onColor }: { d: number; onColor?: boolean }) {
  const r = Math.round(d);
  if (!r) return <span className={onColor ? "opacity-50" : "text-muted-foreground/40"}>–</span>;
  const pos = r > 0;
  if (onColor) return <span className="font-semibold">{pos ? "▲ +" : "▼ "}{money(r)}</span>;
  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${pos ? "text-positive" : "text-destructive"}`}
      style={{ background: `color-mix(in oklab, ${pos ? "var(--positive)" : "var(--destructive)"} 12%, transparent)` }}
    >
      {pos ? "+" : ""}{money(r)}
    </span>
  );
}

function Cells({ v, balance, closingTotal, strong, onColor }: { v: PR | null; balance?: boolean; closingTotal?: PR; strong?: boolean; onColor?: boolean }) {
  const cell = "px-2 py-1.5 text-right text-xs whitespace-nowrap tabular-nums border-b border-border/40";
  const shade = (total: boolean) => (total && !onColor ? "bg-muted/50" : "");
  const trio = (e: number, r: number, key: string | number, total = false) => (
    <Fragment key={key}>
      <td className={`${cell} border-l border-l-border/40 ${shade(total)}`}>
        <Num v={e} onColor={onColor} className={onColor ? "opacity-80" : strong ? "font-semibold" : "text-muted-foreground"} />
      </td>
      <td className={`${cell} ${shade(total)}`}>
        <Num v={r} onColor={onColor} className={strong ? "font-bold" : "font-medium text-foreground"} />
      </td>
      <td className={`${cell} ${shade(total)}`}><Delta d={deltaOf(e, r)} onColor={onColor} /></td>
    </Fragment>
  );
  if (!v) return <>{Array.from({ length: 39 }, (_, i) => <td key={i} className={`${cell} ${i % 3 === 0 ? "border-l border-l-border/40" : ""}`} />)}</>;
  return (
    <>
      {MONTHS.map((_, i) => trio(v.expected[i], v.realized[i], i))}
      {balance
        ? closingTotal
          ? trio(closingTotal.expected[11], closingTotal.realized[11], "t", true)
          : trio(v.expected[0], v.realized[0], "t", true)
        : trio(sum(v.expected), sum(v.realized), "t", true)}
    </>
  );
}

function Kpi({ label, color, realized, expected, hint }: { label: string; color: string; realized: number; expected: number; hint?: string }) {
  const d = deltaOf(expected, realized);
  return (
    <Card className="relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-1" style={{ background: color }} />
      <CardContent className="pt-5 pb-4 space-y-1">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="text-2xl font-semibold tabular-nums" style={{ color }}>{money(realized)}</div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground tabular-nums">
          <span>Previsto {money(expected)}</span>
          <Delta d={d} />
        </div>
        {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}

export function FluxoCaixaPadrao() {
  const { blocks, other, hasOther, variation, opening, closing, byCompany, year, isLoading } = useCashFlow();
  const { data: companies } = useCompanies();
  const coName = new Map((companies ?? []).map((c) => [c.id, c.name]));
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const allGroups = blocks.flatMap((b) => b.groups.map((g) => g.code));
  const toggle = (c: string) =>
    setCollapsed((s) => {
      const n = new Set(s);
      n.has(c) ? n.delete(c) : n.add(c);
      return n;
    });

  const inB = blocks.find((b) => b.key === "in");
  const outB = blocks.find((b) => b.key === "out");
  const chartData = MONTHS.map((m, i) => ({
    mes: m,
    Entradas: Math.round(inB?.totals.realized[i] ?? 0),
    Saídas: Math.abs(Math.round(outB?.totals.realized[i] ?? 0)),
    Saldo: Math.round(closing?.realized[i] ?? 0),
    empresas: Object.entries(byCompany)
      .map(([id, v]) => ({ nome: coName.get(id) ?? "—", e: v.in[i], s: v.out[i] }))
      .filter((c) => Math.round(c.e) || Math.round(c.s))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
  }));

  const Row = ({ label, kind, v, onToggle, open, balance, closingTotal, color = "var(--primary)", title }: {
    label: string; kind: RowKind; v: PR | null; onToggle?: () => void; open?: boolean; balance?: boolean; closingTotal?: PR; color?: string; title?: string;
  }) => {
    if (kind === "spacer") return <tr aria-hidden><td colSpan={40} className="h-3 bg-card" /></tr>;
    let style: CSSProperties = { background: "var(--card)" };
    let text = "";
    if (kind === "balance") { style = { background: "var(--primary)" }; text = "text-primary-foreground font-bold uppercase tracking-wide"; }
    else if (kind === "band" || kind === "blockTotal") { style = { background: soft(color, 85) }; text = "text-primary-foreground font-bold uppercase tracking-wide"; }
    else if (kind === "section") { style = { background: soft(color, 14) }; text = "font-semibold uppercase text-xs tracking-wide"; }
    else if (kind === "sectionTotal") { style = { background: soft(color, 30) }; text = "font-semibold uppercase text-xs tracking-wide"; }
    const strong = kind !== "item";
    return (
      <tr className={`${text} ${kind === "item" ? "hover:brightness-95 dark:hover:brightness-110" : ""}`} style={style}>
        <td
          title={title}
          className={`sticky left-0 z-10 px-3 py-1.5 text-sm whitespace-nowrap border-b border-border/40 ${kind === "item" ? "pl-9" : ""} ${kind === "section" || kind === "sectionTotal" ? "pl-5" : ""}`}
          style={style}
        >
          {onToggle ? (
            <button type="button" onClick={onToggle} className="inline-flex items-center gap-1.5 uppercase" aria-label={open ? "Recolher" : "Expandir"}>
              {open ? <Minus className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
              {label}
            </button>
          ) : label}
        </td>
        <Cells v={v} balance={balance} closingTotal={closingTotal} strong={strong} onColor={kind === "balance" || kind === "band" || kind === "blockTotal"} />
      </tr>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Fluxo de Caixa</h1>
        <p className="text-sm text-muted-foreground">Relatório gerencial — previsto x realizado de {year}.</p>
      </div>

      {!isLoading && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi label="Saldo Final" color="var(--primary)" realized={closing?.realized[11] ?? 0} expected={closing?.expected[11] ?? 0} />
            <Kpi label="Entradas Operacionais" color="var(--flow-in)" realized={sum(inB?.totals.realized ?? [])} expected={sum(inB?.totals.expected ?? [])} />
            <Kpi label="Saídas Operacionais" color="var(--flow-out)" realized={sum(outB?.totals.realized ?? [])} expected={sum(outB?.totals.expected ?? [])} />
            {(() => {
              const r = sum(variation?.realized ?? []);
              return <Kpi label="Variação de Caixa" color={r >= 0 ? "var(--positive)" : "var(--destructive)"} realized={r} expected={sum(variation?.expected ?? [])} />;
            })()}
          </div>

          <Card>
            <CardHeader className="pb-2 flex flex-row items-start justify-between gap-4 flex-wrap">
              <div>
                <CardTitle className="text-base">Entradas x Saídas realizadas</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">Realizado mês a mês em {year}</p>
              </div>
              <div className="flex gap-6 text-xs tabular-nums">
                <div><div className="text-muted-foreground">Entradas no ano</div><div className="text-sm font-semibold" style={{ color: "var(--flow-in)" }}>{money(sum(chartData.map((d) => d.Entradas)))}</div></div>
                <div><div className="text-muted-foreground">Saídas no ano</div><div className="text-sm font-semibold" style={{ color: "var(--flow-out)" }}>{money(sum(chartData.map((d) => d.Saídas)))}</div></div>
              </div>
            </CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={3} barCategoryGap="28%">
                  <defs>
                    <linearGradient id="gIn" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--flow-in)" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="var(--flow-in)" stopOpacity={0.55} />
                    </linearGradient>
                    <linearGradient id="gOut" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--flow-out)" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="var(--flow-out)" stopOpacity={0.55} />
                    </linearGradient>
                    <linearGradient id="gSaldo" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--border)" strokeOpacity={0.8} strokeDasharray="2 4" vertical horizontal />
                  <XAxis dataKey="mes" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                  <YAxis tickLine={false} axisLine={false} width={64} tickFormatter={(v) => `R$ ${compact.format(v)}`} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                  <Tooltip cursor={{ fill: "var(--muted)", fillOpacity: 0.4 }} content={<ChartTip />} />
                  <Legend verticalAlign="top" align="right" iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingBottom: 8, color: "var(--muted-foreground)" }} />
                  <Area dataKey="Saldo" type="monotone" stroke="none" fill="url(#gSaldo)" legendType="none" tooltipType="none" />
                  <Bar dataKey="Entradas" fill="url(#gIn)" stroke="var(--flow-in)" strokeOpacity={0.7} radius={[6, 6, 0, 0]} maxBarSize={18} />
                  <Bar dataKey="Saídas" fill="url(#gOut)" stroke="var(--flow-out)" strokeOpacity={0.7} radius={[6, 6, 0, 0]} maxBarSize={18} />
                  <Line dataKey="Saldo" type="monotone" stroke="var(--primary)" strokeOpacity={1} strokeWidth={2.25} dot={false} activeDot={{ r: 3.5, strokeWidth: 0 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
          <div className="space-y-2">
            <CardTitle className="text-base">Mensal — {year}</CardTitle>
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              {Object.entries(BLOCK_NAME).map(([k, n]) => (
                <span key={k} className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: BLOCK_COLOR[k] }} />{n}
                </span>
              ))}
            </div>
          </div>
          <div className="flex gap-1">
            <Button size="icon" variant="ghost" title="Expandir tudo" aria-label="Expandir tudo" onClick={() => setCollapsed(new Set())}>
              <ChevronsUpDown className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" title="Recolher tudo" aria-label="Recolher tudo" onClick={() => setCollapsed(new Set(allGroups))}>
              <ChevronsDownUp className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <MatrixSkeleton rows={8} />
          ) : (
            <div className="overflow-auto max-h-[75vh] rounded-lg border border-border/60">
              <table className="w-max min-w-full border-separate border-spacing-0">
                <thead className="sticky top-0 z-20 bg-card">
                  <tr>
                    <th rowSpan={2} className="sticky left-0 z-30 bg-card px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground border-b">Descrição</th>
                    {[...MONTHS, "Total"].map((m) => (
                      <th key={m} colSpan={3} className={`px-2 pt-2 pb-0.5 text-center text-xs font-semibold border-l border-border/40 ${m === "Total" ? "bg-muted/40" : ""}`}>{m}</th>
                    ))}
                  </tr>
                  <tr>
                    {[...MONTHS, "Total"].map((m) => (
                      <Fragment key={m}>
                        {["Prev.", "Real.", "▲"].map((h, j) => (
                          <th key={h} className={`px-2 pb-1.5 text-right text-[10px] font-normal uppercase text-muted-foreground border-b ${j === 0 ? "border-l border-border/40" : ""} ${m === "Total" ? "bg-muted/40" : ""}`}>{h}</th>
                        ))}
                      </Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <Row label="Saldo Inicial em Caixa" kind="balance" v={opening} balance />
                  {blocks.map((b) => {
                    const color = BLOCK_COLOR[b.key];
                    const t = BLOCK_TITLE[b.key] ?? { band: b.label, total: `Total — ${b.label}` };
                    return (
                      <Fragment key={b.key}>
                        <Row label="" kind="spacer" v={null} />
                        <Row label={t.band} kind="band" color={color} v={null} />
                        {b.groups.map((g) => {
                          const open = !collapsed.has(g.code);
                          return (
                            <Fragment key={g.code}>
                              <Row label={`${t.sign} ${g.name}`} kind="section" color={color} v={g.totals} onToggle={() => toggle(g.code)} open={open} />
                              {open && g.accounts.map((a) => (
                                <Row key={a.code} label={a.name} title={a.code} kind="item" v={a.values} />
                              ))}
                            </Fragment>
                          );
                        })}
                        <Row label={t.total} kind="blockTotal" color={color} v={b.totals} />
                        {b.key === "out" && (
                          <>
                            <Row label="" kind="spacer" v={null} />
                            <Row
                              label="Fluxo de Caixa Operacional"
                              kind="balance"
                              v={{
                                expected: blocks[0].totals.expected.map((x, i) => x + b.totals.expected[i]),
                                realized: blocks[0].totals.realized.map((x, i) => x + b.totals.realized[i]),
                              }}
                            />
                          </>
                        )}
                      </Fragment>
                    );
                  })}
                  {hasOther && (<><Row label="" kind="spacer" v={null} /><Row label="Outras movimentações" kind="sectionTotal" v={other} /></>)}
                  <Row label="" kind="spacer" v={null} />
                  <Row label="Variação de Caixa do Período" kind="balance" v={variation} />
                  <Row label="Saldo Final em Caixa" kind="balance" v={closing} balance closingTotal={closing} />
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
