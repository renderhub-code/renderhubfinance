import { Card, CardContent } from "@/components/ui/card";
import { useCashFlow } from "@/lib/forecast";
import { deltaOf } from "@/lib/cashflow-blocks";
import { useEffect, useState, type ReactNode } from "react";
import { useCompanyStore } from "@/lib/company-store";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowDownRight, ArrowUpRight, Building2, Landmark, Repeat, Wallet } from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, Cell, LabelList, PolarAngleAxis, RadialBar, RadialBarChart,
  ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const money = (v: number) => fmt.format(Math.round(v) || 0);
const short = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });
const sign = (v: number) => (v >= 0 ? "var(--positive)" : "var(--destructive)");

function Delta({ expected, realized, invert = false }: { expected: number; realized: number; invert?: boolean }) {
  const d = Math.round(deltaOf(expected, realized));
  if (d === 0) return <span className="text-xs text-muted-foreground">= previsto</span>;
  const good = invert ? d < 0 : d > 0;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums ${good ? "bg-positive/15 text-positive" : "bg-destructive/15 text-destructive"}`}>
      {d > 0 ? "▲" : "▼"} {money(Math.abs(d))}
    </span>
  );
}

function Spark({ data, color, m }: { data: number[]; color: string; m: number }) {
  const id = "g" + color.replace(/[^a-z]/gi, "");
  return (
    <ResponsiveContainer width="100%" height={56}>
      <AreaChart data={data.map((v, i) => ({ i, v }))} margin={{ top: 4, bottom: 0, left: 0, right: 0 }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <ReferenceLine x={m} stroke={color} strokeDasharray="2 3" />
        <Area dataKey="v" type="monotone" stroke={color} strokeWidth={2} fill={`url(#${id})`} isAnimationActive />
        <XAxis dataKey="i" hide />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function Flow({ icon, label, color, r, e, series, m, invert }: { icon: ReactNode; label: string; color: string; r: number; e: number; series: number[]; m: number; invert?: boolean }) {
  return (
    <Card className="overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-500">
      <CardContent className="pt-5 pb-2 space-y-2">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
          <span className="grid h-7 w-7 place-items-center rounded-lg" style={{ background: `color-mix(in oklab, ${color} 15%, transparent)`, color }}>{icon}</span>
          {label}
        </div>
        <div className="text-3xl font-semibold tabular-nums" style={{ color }}>{money(r)}</div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground tabular-nums">Previsto {money(e)} <Delta expected={e} realized={r} invert={invert} /></div>
        <Spark data={series} color={color} m={m} />
      </CardContent>
    </Card>
  );
}

function Mini({ icon, label, color, r, e }: { icon: ReactNode; label: string; color: string; r: number; e: number }) {
  return (
    <Card className="relative overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-700">
      <div className="absolute inset-y-0 left-0 w-1" style={{ background: color }} />
      <CardContent className="flex items-center gap-4 py-4">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl" style={{ background: `color-mix(in oklab, ${color} 15%, transparent)`, color }}>{icon}</span>
        <div className="min-w-0 space-y-0.5">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className="whitespace-nowrap text-xl font-semibold tabular-nums" style={{ color: sign(r) }}>{money(r)}</div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground tabular-nums">Previsto {money(e)} <Delta expected={e} realized={r} /></div>
        </div>
      </CardContent>
    </Card>
  );
}

export function DashboardPadrao() {
  const { blocks, closing, year, isLoading } = useCashFlow();
  const companyId = useCompanyStore((s) => s.activeCompanyId);
  const unitId = useCompanyStore((s) => s.activeBusinessUnitId);
  const [month, setMonth] = useState<number | null>(null);
  useEffect(() => setMonth(null), [companyId, unitId, year]);
  const hasData = (i: number) => blocks.some((b) => b.totals.realized[i] !== 0 || b.totals.expected[i] !== 0);
  let auto = new Date().getMonth();
  if (!hasData(auto)) for (let i = 11; i >= 0; i--) if (hasData(i)) { auto = i; break; }
  const m = month ?? auto;

  const blk = (k: string) => blocks.find((x) => x.key === k)?.totals;
  const val = (k: string) => ({ r: blk(k)?.realized[m] ?? 0, e: blk(k)?.expected[m] ?? 0 });
  const rec = val("in");
  const o = val("out");
  const des = { r: -o.r, e: -o.e };
  const op = { r: rec.r - des.r, e: rec.e - des.e };
  const inv = val("inv");
  const fin = val("fin");
  const tr = val("tr");
  const saldo = { r: closing?.realized[m] ?? 0, e: closing?.expected[m] ?? 0 };
  const varM = op.r + inv.r + fin.r + tr.r;
  const margin = rec.r ? (op.r / rec.r) * 100 : 0;
  const recSeries = blk("in")?.realized ?? Array(12).fill(0);
  const desSeries = (blk("out")?.realized ?? Array(12).fill(0)).map((v) => -v);
  const saldoSeries = closing?.realized ?? Array(12).fill(0);

  // cascata
  let acc = 0;
  const steps = [
    { name: "Operacional", v: op.r, color: "var(--flow-in)" },
    { name: "Investimentos", v: inv.r, color: "var(--flow-invest)" },
    { name: "Financiamentos", v: fin.r, color: "var(--flow-finance)" },
    { name: "Transferências", v: tr.r, color: "var(--flow-transfer)" },
  ].map((s) => {
    const start = acc;
    acc += s.v;
    return { ...s, range: [Math.min(start, acc), Math.max(start, acc)] as [number, number] };
  });
  steps.push({ name: "Variação do mês", v: varM, color: "var(--primary)", range: [Math.min(0, varM), Math.max(0, varM)] });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Resultado e caixa de {MESES[m]} de {year} — realizado x previsto.</p>
        </div>
        <Select value={String(m)} onValueChange={(v) => setMonth(Number(v))}>
          <SelectTrigger className="w-44" aria-label="Mês"><SelectValue /></SelectTrigger>
          <SelectContent>
            {MESES.map((n, i) => <SelectItem key={i} value={String(i)}>{cap(n)} de {year}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Card key={i} className="h-40 animate-pulse" />)}
        </div>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            {/* Saldo de Caixa */}
            <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-primary to-primary/75 text-primary-foreground lg:col-span-2 animate-in fade-in zoom-in-95 duration-500">
              <CardContent className="grid gap-4 pt-6 pb-4 sm:grid-cols-[1fr_1.2fr] sm:items-end">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] opacity-80"><Wallet className="h-4 w-4" /> Saldo de Caixa</div>
                  <div className="whitespace-nowrap text-4xl font-bold tabular-nums sm:text-5xl">{money(saldo.r)}</div>
                  <div className="text-sm opacity-80 tabular-nums">Previsto {money(saldo.e)}</div>
                  <div className="text-sm tabular-nums">
                    Variação no mês: <strong>{varM >= 0 ? "+" : ""}{money(varM)}</strong>
                  </div>
                </div>
                <div className="h-32">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={saldoSeries.map((v, i) => ({ mes: cap(MESES[i]).slice(0, 3), v }))} margin={{ top: 8, left: 0, right: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="hero" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--primary-foreground)" stopOpacity={0.45} />
                          <stop offset="100%" stopColor="var(--primary-foreground)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="mes" tick={{ fill: "var(--primary-foreground)", fontSize: 10, opacity: 0.8 }} axisLine={false} tickLine={false} interval={1} />
                      <ReferenceLine x={cap(MESES[m]).slice(0, 3)} stroke="var(--primary-foreground)" strokeDasharray="3 3" />
                      <Tooltip formatter={(v) => money(Number(v))} contentStyle={{ background: "var(--popover)", color: "var(--popover-foreground)", borderRadius: 8, border: "1px solid var(--border)" }} />
                      <Area dataKey="v" name="Saldo" type="monotone" stroke="var(--primary-foreground)" strokeWidth={2.5} fill="url(#hero)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Resultado Operacional */}
            <Card className="animate-in fade-in zoom-in-95 duration-500">
              <CardContent className="flex h-full flex-col items-center justify-center gap-1 pt-5 pb-4 text-center">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Resultado Operacional</div>
                <div className="relative h-36 w-36">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadialBarChart innerRadius="78%" outerRadius="100%" startAngle={90} endAngle={-270} data={[{ v: Math.min(100, Math.abs(margin)) }]}>
                      <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                      <RadialBar dataKey="v" cornerRadius={10} background={{ fill: "var(--muted)" }} fill={sign(op.r)} />
                    </RadialBarChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 grid place-items-center">
                    <div>
                      <div className="text-2xl font-bold tabular-nums" style={{ color: sign(op.r) }}>{margin.toFixed(0)}%</div>
                      <div className="text-[10px] uppercase text-muted-foreground">margem</div>
                    </div>
                  </div>
                </div>
                <div className="text-2xl font-semibold tabular-nums" style={{ color: sign(op.r) }}>{money(op.r)}</div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground tabular-nums">Previsto {money(op.e)} <Delta expected={op.e} realized={op.r} /></div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Flow icon={<ArrowUpRight className="h-4 w-4" />} label="Receitas do Mês" color="var(--flow-in)" r={rec.r} e={rec.e} series={recSeries} m={m} />
            <Flow icon={<ArrowDownRight className="h-4 w-4" />} label="Despesas do Mês" color="var(--flow-out)" r={des.r} e={des.e} series={desSeries} m={m} invert />
            <Card className="sm:col-span-2 lg:col-span-1 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <CardContent className="space-y-4 pt-5">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Receitas x Despesas</div>
                {[{ l: "Receitas", v: rec.r, c: "var(--flow-in)" }, { l: "Despesas", v: des.r, c: "var(--flow-out)" }].map((x) => {
                  const max = Math.max(rec.r, des.r, 1);
                  return (
                    <div key={x.l} className="space-y-1">
                      <div className="flex justify-between text-sm"><span>{x.l}</span><span className="font-medium tabular-nums">{money(x.v)}</span></div>
                      <div className="h-3 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(Math.max(0, x.v) / max) * 100}%`, background: x.c }} />
                      </div>
                    </div>
                  );
                })}
                <div className="rounded-lg bg-muted/60 p-3 text-sm">
                  {rec.r > 0
                    ? <>Para cada <strong>R$ 100</strong> recebidos, <strong className="tabular-nums">{money((des.r / rec.r) * 100)}</strong> foram gastos.</>
                    : <>Sem receitas realizadas neste mês.</>}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="animate-in fade-in slide-in-from-bottom-2 duration-700">
            <CardContent className="pt-5">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <div className="font-semibold">Do resultado ao caixa</div>
                  <div className="text-xs text-muted-foreground">Como o resultado operacional de {MESES[m]} virou a variação do caixa.</div>
                </div>
                <div className="text-sm tabular-nums">Variação: <strong style={{ color: sign(varM) }}>{money(varM)}</strong></div>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={steps} margin={{ top: 24, left: 8, right: 8, bottom: 0 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(v) => short.format(v)} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={48} />
                    <ReferenceLine y={0} stroke="var(--border)" />
                    <Tooltip cursor={{ fill: "var(--muted)", opacity: 0.4 }} formatter={(_v, _n, p) => money(Number((p as { payload?: { v: number } }).payload?.v ?? 0))} contentStyle={{ background: "var(--popover)", color: "var(--popover-foreground)", borderRadius: 8, border: "1px solid var(--border)" }} />
                    <Bar dataKey="range" name="Valor" radius={[6, 6, 6, 6]}>
                      {steps.map((s, i) => <Cell key={i} fill={s.color} fillOpacity={s.v < 0 && i < 4 ? 0.6 : 0.9} />)}
                      <LabelList dataKey="v" position="top" formatter={(v: unknown) => short.format(Number(v))} style={{ fontSize: 11, fill: "var(--foreground)" }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <Mini icon={<Building2 className="h-5 w-5" />} label="Resultado de Investimentos" color="var(--flow-invest)" r={inv.r} e={inv.e} />
            <Mini icon={<Landmark className="h-5 w-5" />} label="Empréstimos/Financiamentos" color="var(--flow-finance)" r={fin.r} e={fin.e} />
            <Mini icon={<Repeat className="h-5 w-5" />} label="Transferências e Não Operacional" color="var(--flow-transfer)" r={tr.r} e={tr.e} />
          </div>
        </>
      )}
    </div>
  );
}
