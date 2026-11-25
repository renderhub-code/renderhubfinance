import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle, ArrowRight, CheckCircle2, CircleDashed, Clock, ListChecks } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { PageHeader } from "@/components/os/page";
import { ContabilGate, PrioridadePill, StatusPill } from "@/components/contabil/ui";
import { useAtividades, useClientes, useContabilMe, useMembros, useSetores } from "@/os/contabil/hooks";
import { dataBR, STATUS_DOT, STATUS_LABEL, statusEfetivo, type Status } from "@/os/contabil/db";
import { cn } from "@/lib/utils";
import { contabilHead } from "@/os/contabil/head";

export const Route = createFileRoute("/_authenticated/contabil/")({
  head: () => contabilHead("Painel", "Atividades, prazos e andamento dos setores da Union Contadores."),
  component: () => <ContabilGate><Painel /></ContabilGate>,
});

const ORDEM: Status[] = ["nao_iniciado", "em_andamento", "atrasado", "concluido"];

function Painel() {
  const { membro } = useContabilMe();
  const { data: atividades = [] } = useAtividades();
  const { data: setores = [] } = useSetores();
  const { data: membros = [] } = useMembros();
  const { data: clientes = [] } = useClientes();

  const nome = useMemo(() => new Map(membros.map((m) => [m.user_id, m.nome || m.email || "—"])), [membros]);
  const clienteNome = useMemo(() => new Map(clientes.map((c) => [c.id, c.razao_social])), [clientes]);

  const lista = useMemo(() => atividades.map((a) => ({ ...a, eff: statusEfetivo(a.status, a.prazo) })), [atividades]);
  const contagem = useMemo(() => {
    const c: Record<Status, number> = { nao_iniciado: 0, em_andamento: 0, atrasado: 0, concluido: 0 };
    lista.forEach((a) => c[a.eff]++);
    return c;
  }, [lista]);
  const minhas = lista.filter((a) => a.responsavel_id === membro?.user_id && a.eff !== "concluido");
  const atrasadas = lista.filter((a) => a.eff === "atrasado").sort((a, b) => (a.prazo ?? "").localeCompare(b.prazo ?? "")).slice(0, 8);
  const recentes = [...lista]
    .sort((a, b) => (b.ultima_atualizacao ?? b.criado_em).localeCompare(a.ultima_atualizacao ?? a.criado_em))
    .slice(0, 8);
  const porSetor = setores.map((s) => {
    const doSetor = lista.filter((a) => a.setor_id === s.id);
    const c = Object.fromEntries(ORDEM.map((st) => [st, doSetor.filter((a) => a.eff === st).length])) as Record<Status, number>;
    return { setor: s, total: doSetor.length, c };
  }).filter((x) => x.total > 0);

  const total = lista.length;
  const pct = total ? Math.round((contagem.concluido / total) * 100) : 0;
  const donut = ORDEM.map((s) => ({ name: STATUS_LABEL[s], value: contagem[s], color: STATUS_DOT[s] })).filter((d) => d.value > 0);

  const cards = [
    { label: "Não iniciadas", value: contagem.nao_iniciado, icon: CircleDashed, status: "nao_iniciado", tone: "text-zinc-500" },
    { label: "Em andamento", value: contagem.em_andamento, icon: Clock, status: "em_andamento", tone: "text-blue-600" },
    { label: "Atrasadas", value: contagem.atrasado, icon: AlertTriangle, status: "atrasado", tone: "text-red-600" },
    { label: "Concluídas", value: contagem.concluido, icon: CheckCircle2, status: "concluido", tone: "text-emerald-600" },
  ] as const;

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        eyebrow="Contábil · Union Contadores"
        title={`Olá, ${membro?.nome?.split(" ")[0] ?? ""}`}
        description={minhas.length ? `Você tem ${minhas.length} atividade(s) em aberto.` : "Nenhuma atividade em aberto com você."}
        actions={<Link to="/contabil/atividades" className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"><ListChecks className="h-4 w-4" /> Ver atividades</Link>}
      />

      <div className="ros-stagger grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <Link key={c.label} to="/contabil/atividades" search={{ status: c.status }} className="group rounded-xl border bg-background p-4 transition-colors hover:border-primary/40">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              {c.label}
              <c.icon className={cn("h-4 w-4", c.tone)} />
            </div>
            <div className="mt-2 text-3xl font-semibold tabular-nums tracking-tight">{c.value}</div>
          </Link>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card title="Distribuição por status">
          {total === 0 ? <Empty /> : (
            <div className="relative h-56">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={donut} dataKey="value" nameKey="name" innerRadius={62} outerRadius={88} paddingAngle={2} stroke="none">
                    {donut.map((d) => <Cell key={d.name} fill={d.color} />)}
                  </Pie>
                  <Tooltip formatter={(v) => [`${v}`, ""]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                <div><div className="text-2xl font-semibold tabular-nums">{pct}%</div><div className="text-[11px] text-muted-foreground">concluído</div></div>
              </div>
            </div>
          )}
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {ORDEM.map((s) => (
              <span key={s} className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: STATUS_DOT[s] }} />{STATUS_LABEL[s]} · {contagem[s]}</span>
            ))}
          </div>
        </Card>

        <Card title="Por setor" className="lg:col-span-2">
          {porSetor.length === 0 ? <Empty /> : (
            <div className="space-y-4">
              {porSetor.map(({ setor, total: t, c }) => (
                <div key={setor.id}>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="font-medium">{setor.nome}</span>
                    <span className="text-xs tabular-nums text-muted-foreground">{c.concluido}/{t} concluídas{c.atrasado ? ` · ${c.atrasado} atrasada(s)` : ""}</span>
                  </div>
                  <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
                    {ORDEM.map((s) => c[s] > 0 && (
                      <div key={s} title={`${STATUS_LABEL[s]}: ${c[s]}`} style={{ width: `${(c[s] / t) * 100}%`, background: STATUS_DOT[s] }} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Atrasadas" action={<Link to="/contabil/atividades" search={{ status: "atrasado" }} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">todas <ArrowRight className="h-3 w-3" /></Link>}>
          {atrasadas.length === 0 ? <Empty text="Nada atrasado. 👏" /> : (
            <ul className="divide-y">
              {atrasadas.map((a) => (
                <li key={a.id} className="flex items-start gap-3 py-2.5">
                  <PrioridadePill p={a.prioridade} />
                  <div className="min-w-0 flex-1">
                    <div className="line-clamp-1 text-sm font-medium">{a.atividade}</div>
                    <div className="text-xs text-muted-foreground">{clienteNome.get(a.cliente_id ?? "") ?? "Avulsa"} · {nome.get(a.responsavel_id)}</div>
                  </div>
                  <span className="whitespace-nowrap text-xs font-medium tabular-nums text-red-600">{dataBR(a.prazo)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Últimas atualizações">
          {recentes.length === 0 ? <Empty /> : (
            <ul className="divide-y">
              {recentes.map((a) => (
                <li key={a.id} className="flex items-start gap-3 py-2.5">
                  <StatusPill status={a.eff} />
                  <div className="min-w-0 flex-1">
                    <div className="line-clamp-1 text-sm font-medium">{a.atividade}</div>
                    <div className="text-xs text-muted-foreground">
                      {nome.get(a.atualizado_por ?? a.criado_por ?? "") ?? "—"} · {formatDistanceToNow(new Date(a.ultima_atualizacao ?? a.criado_em), { locale: ptBR, addSuffix: true })}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function Card({ title, action, className, children }: { title: string; action?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <section className={cn("rounded-xl border bg-background p-5", className)}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Empty({ text = "Sem dados ainda." }: { text?: string }) {
  return <p className="py-8 text-center text-sm text-muted-foreground">{text}</p>;
}
