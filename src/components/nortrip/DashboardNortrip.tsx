import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, CalendarClock, CheckCircle2, Receipt, Users, Wallet } from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Delta, Flow, MESES, cap, money, short, sign } from "@/components/padrao/DashboardPadrao";
import { useCashflowTree, type CashflowNode } from "@/lib/cashflow";
import { useAccounts, useTransactions } from "@/lib/queries";
import { useCompanyStore } from "@/lib/company-store";
import { cn } from "@/lib/utils";

const TIP = { background: "var(--popover)", color: "var(--popover-foreground)", borderRadius: 8, border: "1px solid var(--border)", fontSize: 12 };
const hoje = () => new Date().toISOString().slice(0, 10);
const diasDepois = (n: number) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const dataBR = (d: string) => d.slice(0, 10).split("-").reverse().join("/");

/**
 * Dashboard da Nortrip. O caixa vem do mesmo extrato sincronizado do Bling que
 * alimenta o Fluxo de Caixa (os números batem entre as duas telas). Os títulos
 * do Bling entram só onde são títulos: faturado no mês e contas em aberto.
 */
export function DashboardNortrip() {
  const companyId = useCompanyStore((s) => s.activeCompanyId);
  const businessUnitId = useCompanyStore((s) => s.activeBusinessUnitId);
  const { tree, summary, year, isLoading, snapshot, movements, error } = useCashflowTree();
  // Mesma consulta (e mesmo cache) que o fluxo de caixa usa.
  const { data: txs } = useTransactions(companyId, { businessUnitId });
  const { data: accounts } = useAccounts(companyId);
  const [month, setMonth] = useState<number | null>(null);
  useEffect(() => setMonth(null), [companyId, businessUnitId, year]);

  const temDados = (i: number) =>
    summary.inflow[i].realized !== 0 || summary.outflow[i].realized !== 0;
  let auto = new Date().getFullYear() === year ? new Date().getMonth() : 11;
  if (!temDados(auto)) for (let i = 11; i >= 0; i--) if (temDados(i)) { auto = i; break; }
  const m = month ?? auto;
  const mes = cap(MESES[m]);

  // ---- Caixa do mês ----
  const ent = summary.inflow[m];
  const sai = summary.outflow[m];
  const socios = summary.shareholders[m];
  const resultado = { r: ent.realized - sai.realized, e: ent.expected - sai.expected };
  const margem = ent.realized ? (resultado.r / ent.realized) * 100 : 0;
  const variacao = summary.variation[m].realized;
  const saldo = summary.balance[m];
  const saldoPendente = snapshot?.opening == null;

  const serie = MESES.map((n, i) => ({
    mes: cap(n).slice(0, 3),
    Entradas: summary.inflow[i].realized,
    Saídas: summary.outflow[i].realized,
    "Entradas previstas": summary.inflow[i].expected,
    "Saídas previstas": summary.outflow[i].expected,
    saldo: summary.balance[i].realized,
  }));

  // ---- Categorias do mês (folhas do plano de contas) ----
  const { topEnt, topSai } = useMemo(() => {
    const folhas: { nome: string; v: number }[] = [];
    const walk = (ns: CashflowNode[]) => ns.forEach((n) => {
      if (n.level === 2) { const v = n.months[m].realized; if (v) folhas.push({ nome: n.name, v }); }
      walk(n.children);
    });
    walk(tree);
    return {
      topEnt: folhas.filter((f) => f.v > 0).sort((a, b) => b.v - a.v).slice(0, 6),
      topSai: folhas.filter((f) => f.v < 0).map((f) => ({ ...f, v: -f.v })).sort((a, b) => b.v - a.v).slice(0, 6),
    };
  }, [tree, m]);

  // ---- Títulos do Bling: faturado no mês e contas em aberto ----
  const titulos = useMemo(() => {
    const prefixo = `${year}-${String(m + 1).padStart(2, "0")}`;
    const h = hoje(), em30 = diasDepois(30);
    let faturado = 0, compras = 0;
    const aberto = { receber: { vencido: 0, prox: 0, total: 0, nVencido: 0 }, pagar: { vencido: 0, prox: 0, total: 0, nVencido: 0 } };
    for (const t of txs ?? []) {
      if (t.status === "cancelado") continue;
      const valor = Number(t.amount_expected ?? 0) || Number(t.amount_realized ?? 0);
      if (t.entry_date.startsWith(prefixo)) { if (t.type === "entrada") faturado += valor; else compras += valor; }
      if (t.status === "realizado") continue;
      const venc = (t.due_date ?? t.entry_date).slice(0, 10);
      const b = t.type === "entrada" ? aberto.receber : aberto.pagar;
      b.total += valor;
      if (venc < h) { b.vencido += valor; b.nVencido++; } else if (venc <= em30) b.prox += valor;
    }
    return { faturado, compras, aberto };
  }, [txs, year, m]);

  // ---- Movimentos de caixa do mês ----
  const nomeConta = useMemo(() => new Map((accounts ?? []).map((a) => [a.id, a.name])), [accounts]);
  const movsMes = useMemo(() => {
    const prefixo = `${year}-${String(m + 1).padStart(2, "0")}`;
    return movements
      .filter((x) => x.date.startsWith(prefixo) && x.kind !== "adjustment" && x.kind !== "transfer")
      .sort((a, b) => b.date.localeCompare(a.date) || b.amount - a.amount)
      .slice(0, 10);
  }, [movements, year, m]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3.5">
          <img src="/brand/nortrip-logo.png" alt="Nortrip" className="h-14 w-14 shrink-0 rounded-xl" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Dashboard · Nortrip</h1>
            <p className="text-sm text-muted-foreground">Caixa de {MESES[m]} de {year}, realizado x previsto, a partir do extrato do Bling.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SyncBadge hasSnapshot={!!snapshot?.hasSnapshot} syncedAt={snapshot?.syncedAt ?? null} />
          <Select value={String(m)} onValueChange={(v) => setMonth(Number(v))}>
            <SelectTrigger className="w-44" aria-label="Mês"><SelectValue /></SelectTrigger>
            <SelectContent>{MESES.map((n, i) => <SelectItem key={i} value={String(i)}>{cap(n)} de {year}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">Não foi possível carregar o caixa: {error.message}</p>}

      {isLoading ? (
        <div className="grid gap-4 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Card key={i} className="h-40 animate-pulse" />)}</div>
      ) : (
        <>
          {/* Saldo + resultado */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-primary to-primary/75 text-primary-foreground lg:col-span-2">
              <CardContent className="grid gap-4 pt-6 pb-4 sm:grid-cols-[1fr_1.3fr] sm:items-end">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] opacity-80"><Wallet className="h-4 w-4" /> {saldoPendente ? "Caixa acumulado no ano" : "Saldo de caixa"}</div>
                  <div className="whitespace-nowrap text-4xl font-bold tabular-nums sm:text-5xl">{money(saldo.realized)}</div>
                  <div className="text-sm tabular-nums">Variação em {MESES[m]}: <strong>{variacao >= 0 ? "+" : ""}{money(variacao)}</strong></div>
                  {saldoPendente && <div className="text-xs opacity-80">Saldo inicial do ano ainda não informado no Fluxo de Caixa.</div>}
                </div>
                <div className="h-32">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={serie} margin={{ top: 8, left: 0, right: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="nt-hero" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--primary-foreground)" stopOpacity={0.45} />
                          <stop offset="100%" stopColor="var(--primary-foreground)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="mes" tick={{ fill: "var(--primary-foreground)", fontSize: 10, opacity: 0.8 }} axisLine={false} tickLine={false} interval={1} />
                      <ReferenceLine x={mes.slice(0, 3)} stroke="var(--primary-foreground)" strokeDasharray="3 3" />
                      <Tooltip formatter={(v) => money(Number(v))} contentStyle={TIP} />
                      <Area dataKey="saldo" name="Saldo" type="monotone" stroke="var(--primary-foreground)" strokeWidth={2.5} fill="url(#nt-hero)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="flex h-full flex-col justify-center gap-3 pt-5 pb-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Resultado do caixa em {MESES[m]}</div>
                <div className="text-3xl font-semibold tabular-nums" style={{ color: sign(resultado.r) }}>{money(resultado.r)}</div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground tabular-nums">Previsto {money(resultado.e)} <Delta expected={resultado.e} realized={resultado.r} /></div>
                <div>
                  <div className="mb-1 flex justify-between text-xs text-muted-foreground"><span>Margem de caixa</span><span className="tabular-nums" style={{ color: sign(margem) }}>{margem.toFixed(0)}%</span></div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, Math.abs(margem))}%`, background: sign(margem) }} /></div>
                </div>
                {(socios.realized !== 0) && (
                  <div className="flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2 text-xs">
                    <Users className="h-3.5 w-3.5 text-muted-foreground" />
                    Sócios (aportes/retiradas): <strong className="tabular-nums" style={{ color: sign(socios.realized) }}>{money(socios.realized)}</strong>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Entradas, saídas, faturado */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Flow icon={<ArrowUpRight className="h-4 w-4" />} label="Entradas de caixa" color="var(--flow-in)" r={ent.realized} e={ent.expected} series={summary.inflow.map((x) => x.realized)} m={m} />
            <Flow icon={<ArrowDownRight className="h-4 w-4" />} label="Saídas de caixa" color="var(--flow-out)" r={sai.realized} e={sai.expected} series={summary.outflow.map((x) => x.realized)} m={m} invert />
            <Card className="sm:col-span-2 lg:col-span-1">
              <CardContent className="space-y-3 pt-5">
                <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground"><Receipt className="h-4 w-4" /> Faturado x recebido em {MESES[m]}</div>
                {[{ l: "Títulos emitidos (Bling)", v: titulos.faturado, c: "var(--flow-invest)" }, { l: "Recebido no caixa", v: ent.realized, c: "var(--flow-in)" }].map((x) => {
                  const max = Math.max(titulos.faturado, ent.realized, 1);
                  return (
                    <div key={x.l} className="space-y-1">
                      <div className="flex justify-between text-sm"><span>{x.l}</span><span className="font-medium tabular-nums">{money(x.v)}</span></div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full transition-all duration-500" style={{ width: `${(Math.max(0, x.v) / max) * 100}%`, background: x.c }} /></div>
                    </div>
                  );
                })}
                <p className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
                  {titulos.faturado > 0
                    ? <>O caixa recebeu <strong className="text-foreground tabular-nums">{Math.round((ent.realized / titulos.faturado) * 100)}%</strong> do valor emitido no mês. A diferença é prazo de recebimento ou título ainda em aberto.</>
                    : <>Nenhum título de venda emitido neste mês.</>}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Ano: entradas x saídas */}
          <Card>
            <CardContent className="pt-5">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <div className="font-semibold">Entradas x saídas no ano</div>
                  <div className="text-xs text-muted-foreground">Barras cheias: realizado. Barras claras: previsto ainda por acontecer.</div>
                </div>
                <div className="text-sm tabular-nums text-muted-foreground">
                  Acumulado: <strong style={{ color: sign(summary.inflow.reduce((a, x) => a + x.realized, 0) - summary.outflow.reduce((a, x) => a + x.realized, 0)) }}>
                    {money(summary.inflow.reduce((a, x) => a + x.realized, 0) - summary.outflow.reduce((a, x) => a + x.realized, 0))}
                  </strong>
                </div>
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={serie} margin={{ top: 8, left: 4, right: 8, bottom: 0 }} barGap={2}>
                    <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
                    <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(v) => short.format(v)} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={48} />
                    <Tooltip cursor={{ fill: "var(--muted)", opacity: 0.4 }} formatter={(v) => money(Number(v))} contentStyle={TIP} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                    <ReferenceLine x={mes.slice(0, 3)} stroke="var(--primary)" strokeDasharray="3 3" />
                    <Bar dataKey="Entradas" stackId="e" fill="var(--flow-in)" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="Entradas previstas" stackId="e" fill="var(--flow-in)" fillOpacity={0.3} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Saídas" stackId="s" fill="var(--flow-out)" />
                    <Bar dataKey="Saídas previstas" stackId="s" fill="var(--flow-out)" fillOpacity={0.3} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Categorias */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Ranking titulo={`Para onde foi o dinheiro em ${MESES[m]}`} itens={topSai} cor="var(--flow-out)" total={sai.realized} vazio="Sem saídas neste mês." />
            <Ranking titulo={`De onde veio o dinheiro em ${MESES[m]}`} itens={topEnt} cor="var(--flow-in)" total={ent.realized} vazio="Sem entradas neste mês." />
          </div>

          {/* Em aberto + movimentos */}
          <div className="grid gap-4 lg:grid-cols-5">
            <Card className="lg:col-span-2">
              <CardContent className="space-y-4 pt-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-semibold"><CalendarClock className="h-4 w-4 text-muted-foreground" /> Contas em aberto</div>
                  <Link to="/lancamentos" className="text-xs font-medium text-primary hover:underline">Ver lançamentos</Link>
                </div>
                <Aberto titulo="A receber" cor="var(--flow-in)" d={titulos.aberto.receber} />
                <Aberto titulo="A pagar" cor="var(--flow-out)" d={titulos.aberto.pagar} />
                <p className="text-[11px] text-muted-foreground">Títulos do Bling ainda não baixados, de todos os anos.</p>
              </CardContent>
            </Card>

            <Card className="lg:col-span-3">
              <CardContent className="pt-5">
                <div className="mb-3 flex items-center justify-between">
                  <div className="font-semibold">Movimentos de caixa de {MESES[m]}</div>
                  <Link to="/fluxo-de-caixa" className="text-xs font-medium text-primary hover:underline">Abrir fluxo de caixa</Link>
                </div>
                {movsMes.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">Nenhum movimento sincronizado neste mês.</p>
                ) : (
                  <ul className="divide-y">
                    {movsMes.map((x, i) => (
                      <li key={i} className="flex items-center gap-3 py-2 text-sm">
                        <span className="w-12 shrink-0 text-xs tabular-nums text-muted-foreground">{dataBR(x.date).slice(0, 5)}</span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate">{x.description || x.category_name || "—"}</div>
                          <div className="truncate text-xs text-muted-foreground">{x.category_name ?? (x.account_id ? nomeConta.get(x.account_id) : null) ?? "Sem categoria"}{x.kind === "shareholder" ? " · sócios" : ""}</div>
                        </div>
                        <span className={cn("whitespace-nowrap font-medium tabular-nums", x.type === "saida" ? "text-destructive" : "text-positive")}>
                          {x.type === "saida" ? "−" : "+"}{money(x.amount)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function SyncBadge({ hasSnapshot, syncedAt }: { hasSnapshot: boolean; syncedAt: string | null }) {
  if (!hasSnapshot) {
    return <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive"><AlertTriangle className="h-3.5 w-3.5" /> Caixa do Bling não sincronizado</span>;
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-positive/10 px-2.5 py-1 text-xs font-medium text-positive" title={syncedAt ? new Date(syncedAt).toLocaleString("pt-BR") : undefined}>
      <CheckCircle2 className="h-3.5 w-3.5" /> Bling sincronizado{syncedAt ? ` ${formatDistanceToNow(new Date(syncedAt), { locale: ptBR, addSuffix: true })}` : ""}
    </span>
  );
}

function Ranking({ titulo, itens, cor, total, vazio }: { titulo: string; itens: { nome: string; v: number }[]; cor: string; total: number; vazio: string }) {
  const max = Math.max(1, ...itens.map((i) => i.v));
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="mb-4 font-semibold">{titulo}</div>
        {itens.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">{vazio}</p> : (
          <ul className="space-y-3">
            {itens.map((i) => (
              <li key={i.nome} className="space-y-1">
                <div className="flex justify-between gap-3 text-sm">
                  <span className="truncate">{i.nome}</span>
                  <span className="whitespace-nowrap tabular-nums"><strong className="font-medium">{money(i.v)}</strong> <span className="text-xs text-muted-foreground">{total ? Math.round((i.v / total) * 100) : 0}%</span></span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full transition-all duration-500" style={{ width: `${(i.v / max) * 100}%`, background: cor }} /></div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function Aberto({ titulo, cor, d }: { titulo: string; cor: string; d: { vencido: number; prox: number; total: number; nVencido: number } }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium">{titulo}</span>
        <span className="text-lg font-semibold tabular-nums" style={{ color: cor }}>{money(d.total)}</span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
        <div className={cn("rounded-md px-2 py-1.5", d.vencido > 0 ? "bg-destructive/10 text-destructive" : "bg-muted/60 text-muted-foreground")}>
          Vencido{d.nVencido ? ` (${d.nVencido})` : ""}<div className="font-semibold tabular-nums">{money(d.vencido)}</div>
        </div>
        <div className="rounded-md bg-muted/60 px-2 py-1.5 text-muted-foreground">
          Próximos 30 dias<div className="font-semibold tabular-nums text-foreground">{money(d.prox)}</div>
        </div>
      </div>
    </div>
  );
}
