import { createFileRoute, Link } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Banknote, Clock, GraduationCap, TrendingUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/os/page";
import { Card, Empty, IaGate, StatusPill } from "@/components/ia/ui";
import { brl, metricas, nf, pctPessoa, roi, STATUS, STATUS_COLOR, useAtualizacoes, useModulos, usePessoas, useProgresso, useSolucoes } from "@/os/ia/data";
import { GROUP_COMPANIES } from "@/os/companies";

export const Route = createFileRoute("/_authenticated/ia/")({
  head: () => ({ meta: [{ title: "Visão geral · IA — render.os" }] }),
  component: () => <IaGate><Visao /></IaGate>,
});

function Kpi({ icon: Icon, label, value, foot }: { icon: LucideIcon; label: string; value: string; foot: string }) {
  return (
    <div className="rounded-xl border bg-background p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><Icon className="h-4 w-4 text-brand-blue" />{label}</div>
      <div className="mt-2 font-display text-[26px] font-semibold leading-none tabular-nums tracking-tight">{value}</div>
      <div className="mt-2 text-xs text-muted-foreground">{foot}</div>
    </div>
  );
}

function Visao() {
  const { data: solucoes = [] } = useSolucoes();
  const { data: pessoas = [] } = usePessoas();
  const { data: modulos = [] } = useModulos();
  const { data: progresso = [] } = useProgresso();
  const { data: atualizacoes = [] } = useAtualizacoes();
  const m = metricas(solucoes, pessoas, modulos, progresso);

  const rows = GROUP_COMPANIES.map((c) => ({ c, v: m.porEmpresa[c.id] ?? 0 })).sort((a, b) => b.v - a.v);
  const mx = Math.max(1, ...rows.map((r) => r.v));
  const pipe = STATUS.map((s) => {
    const l = solucoes.filter((x) => x.status === s);
    return { s, n: l.length, g: l.reduce((a, x) => a + x.ganho, 0) };
  });
  const tot = solucoes.length || 1;
  const emAndamento = solucoes.filter((s) => s.status === "Em desenvolvimento");
  const top = solucoes.filter((s) => s.status === "Produção").sort((a, b) => b.ganho - a.ganho).slice(0, 5);
  const titulo = new Map(solucoes.map((s) => [s.id, s.titulo]));

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader eyebrow="Departamento de IA" title="Visão geral" description="O que o time de IA entregou, o que está construindo e quanto isso rende para o grupo." />

      <div className="ros-stagger grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={Banknote} label="Ganho mensal" value={brl(m.ganho)} foot={`+ ${brl(m.dev)} em desenvolvimento`} />
        <Kpi icon={Clock} label="Horas economizadas" value={`${nf(m.horas)} h/mês`} foot={`≈ ${nf(m.fte, 1)} pessoa(s) em tempo integral`} />
        <Kpi icon={TrendingUp} label="Retorno sobre o custo" value={m.retorno === null ? "—" : `${nf(m.retorno, 1)}×`} foot={`Resultado líquido ${brl(m.liquido)}/mês`} />
        <Kpi icon={GraduationCap} label="Capacitação do time" value={`${nf(m.pct)}%`} foot={`${m.completos} de ${pessoas.length} pessoa(s) com a trilha completa`} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-7" title="Em construção agora" sub={`${emAndamento.length} entrega(s) em desenvolvimento`}
          action={<Link to="/ia/entregas" className="text-xs font-medium text-primary hover:underline">Ver entregas</Link>}>
          {emAndamento.length ? (
            <ul className="divide-y">
              {emAndamento.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{s.titulo}</div>
                    <div className="text-xs text-muted-foreground">{s.tipo} · {s.responsavel || "sem responsável"}{s.previsao ? ` · previsão ${new Date(s.previsao + "T12:00").toLocaleDateString("pt-BR")}` : ""}</div>
                  </div>
                  <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(s.atualizado_em), { locale: ptBR, addSuffix: true })}</span>
                </li>
              ))}
            </ul>
          ) : <Empty text="Nada em desenvolvimento no momento." />}
        </Card>

        <Card className="lg:col-span-5" title="Pipeline de entregas" sub="Quantidade e ganho estimado por status">
          <div className="mb-4 flex h-2.5 overflow-hidden rounded-full bg-muted">
            {pipe.map((p) => p.n > 0 && <span key={p.s} style={{ width: `${(p.n / tot) * 100}%`, background: STATUS_COLOR[p.s] }} />)}
          </div>
          <ul className="grid gap-2.5">
            {pipe.map((p) => (
              <li key={p.s} className="flex items-center justify-between gap-2">
                <StatusPill s={p.s} />
                <span className="text-sm tabular-nums">{p.n} <span className="text-xs text-muted-foreground">· {brl(p.g)}/mês</span></span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="lg:col-span-7" title="Ganho mensal por marca" sub="Entregas em produção · rateio igual entre as marcas atendidas">
          <ul className="grid gap-3">
            {rows.map(({ c, v }) => (
              <li key={c.id} className="grid grid-cols-[minmax(0,170px)_1fr_auto] items-center gap-3 text-sm">
                <span className="flex items-center gap-2 truncate">
                  {c.mark ? <img src={c.mark} alt="" className="h-6 w-6 shrink-0 rounded-full" /> : <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[9px] font-semibold text-white" style={{ background: c.color }}>{c.initials}</span>}
                  {c.name}
                </span>
                <span className="h-2 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full" style={{ width: `${(v / mx) * 100}%`, background: c.color }} /></span>
                <span className="w-32 text-right tabular-nums">{brl(v)} <span className="text-xs text-muted-foreground">{m.ganho ? nf((v / m.ganho) * 100) : 0}%</span></span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="lg:col-span-5" title="Últimas atualizações" sub="Diário do departamento">
          {atualizacoes.length ? (
            <ul className="space-y-3">
              {atualizacoes.slice(0, 6).map((a) => (
                <li key={a.id} className="border-l-2 border-primary/30 pl-3">
                  <div className="text-xs font-medium text-primary">{titulo.get(a.solucao_id) ?? "—"}</div>
                  <div className="line-clamp-2 text-sm">{a.texto}</div>
                  <div className="text-[11px] text-muted-foreground">{a.autor_nome ?? "—"} · {formatDistanceToNow(new Date(a.criado_em), { locale: ptBR, addSuffix: true })}</div>
                </li>
              ))}
            </ul>
          ) : <Empty text="Registre o andamento em cada entrega para ele aparecer aqui." />}
        </Card>

        <Card className="lg:col-span-7" title="Entregas com maior retorno">
          {top.length ? (
            <ul className="divide-y">
              {top.map((s) => {
                const r = roi(s);
                return (
                  <li key={s.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0"><div className="truncate text-sm font-medium">{s.titulo}</div><div className="text-xs text-muted-foreground">{s.tipo} · {s.responsavel || "—"}</div></div>
                    <div className="text-right"><div className="text-sm tabular-nums">{brl(s.ganho)}</div><div className="text-xs text-muted-foreground">{r === null ? "—" : `${nf(r, 1)}× retorno`}</div></div>
                  </li>
                );
              })}
            </ul>
          ) : <Empty text="Quando uma entrega entrar em produção, aparece aqui." />}
        </Card>

        <Card className="lg:col-span-5" title="Capacitação do time" action={<Link to="/ia/treinamento" className="text-xs font-medium text-primary hover:underline">Abrir trilha</Link>}>
          {pessoas.length ? (
            <ul className="grid gap-2.5">
              {pessoas.map((p) => {
                const pct = pctPessoa(p.id, modulos, m.pm);
                return (
                  <li key={p.id} className="grid grid-cols-[minmax(0,1fr)_100px_40px] items-center gap-3 text-sm">
                    <span className="truncate">{p.nome}</span>
                    <span className="h-1.5 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} /></span>
                    <span className="text-right text-xs tabular-nums">{nf(pct)}%</span>
                  </li>
                );
              })}
            </ul>
          ) : <Empty text="Cadastre o time em Treinamento." />}
        </Card>
      </div>
    </div>
  );
}
