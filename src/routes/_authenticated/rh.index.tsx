import { Link, createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { AlertTriangle, CalendarClock } from "lucide-react";
import { PageHeader } from "@/components/os/page";
import { Card, Kpi, Nota, RhGate, eyebrow } from "@/components/rh/ui";
import {
  ativoNoMes,
  brl0,
  custoPessoa,
  fmtComp,
  pct,
  turnover12,
  useAlertas,
  useCalendario,
  useColaboradores,
  useCustos,
  useParametros,
  useRemuneracao,
  useRhCtx,
} from "@/os/rh/data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/rh/")({
  head: () => ({ meta: [{ title: "Painel · RH — render.os" }] }),
  component: Painel,
});

function ultimosMeses(n: number): string[] {
  const out: string[] = [];
  const d = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const x = new Date(d.getFullYear(), d.getMonth() - i, 1);
    out.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-01`);
  }
  return out;
}

function Painel() {
  const ctx = useRhCtx("rh.painel");
  const colabs = useColaboradores(ctx.empresas);
  const lista = colabs.data ?? [];
  const { data: rems = [] } = useRemuneracao(lista, lista.length > 0);
  const params = useParametros(ctx.empresas);
  const { data: custos = [] } = useCustos(ctx.empresas);
  const { data: tarefas = [] } = useCalendario(ctx.empresas);
  const { data: alertas } = useAlertas(ctx.empresas, ctx.empresas.length > 0);

  const ativos = lista.filter((c) => c.status !== "desligado");
  const t = turnover12(lista);
  const meta = params.data
    ? params.data(ctx.grupo ? (ctx.empresas[0] ?? "render") : ctx.ws).meta_turnover
    : 10;

  const mesAtual = useMemo(() => {
    if (!params.data) return null;
    const k = ativos.map((c) => custoPessoa(rems, c, params.data!(c.empresa)));
    const s = (f: (x: (typeof k)[number]) => number) => k.reduce((a, x) => a + f(x), 0);
    return {
      salarios: s((x) => x.salario + x.variaveis),
      encargos: s((x) => x.encargos + x.provisoes),
      beneficios: s((x) => x.beneficios),
      total: s((x) => x.total),
    };
  }, [ativos, rems, params.data]);

  const serie = useMemo(
    () =>
      ultimosMeses(8).map((m) => {
        const realizado = custos
          .filter((c) => c.competencia.slice(0, 7) === m.slice(0, 7))
          .reduce((a, c) => a + c.valor, 0);
        const estimado = params.data
          ? lista
              .filter((c) => ativoNoMes(c, m))
              .reduce((a, c) => a + custoPessoa(rems, c, params.data!(c.empresa), m).total, 0)
          : 0;
        return { m, realizado, estimado, valor: realizado || estimado };
      }),
    [custos, lista, rems, params.data],
  );
  const maxSerie = Math.max(1, ...serie.map((s) => s.valor));

  const dia = new Date().getDate();
  const proximas = [...tarefas.filter((x) => x.ativo)]
    .sort((a, b) => ((a.dia - dia + 31) % 31) - ((b.dia - dia + 31) % 31))
    .slice(0, 4);
  const pendencias =
    (alertas?.aso_vencidos ?? 0) +
    (alertas?.aso_30 ?? 0) +
    (alertas?.pj_30 ?? 0) +
    (alertas?.docs_30 ?? 0);

  const listaAlertas = alertas
    ? ([
        { l: "ASO vencido", v: alertas.aso_vencidos, u: "pessoa(s)", tone: "bad", to: "/rh/aso" },
        {
          l: "ASO vence em 30 dias",
          v: alertas.aso_30,
          u: "pessoa(s)",
          tone: "warn",
          to: "/rh/aso",
        },
        {
          l: "Sem ASO registrado",
          v: alertas.sem_aso,
          u: "pessoa(s)",
          tone: "warn",
          to: "/rh/aso",
        },
        {
          l: "Contrato PJ vence em 60 dias",
          v: alertas.pj_60,
          u: "contrato(s)",
          tone: "warn",
          to: "/rh/pj",
        },
        {
          l: "Documentos pendentes",
          v: alertas.docs_pendentes,
          u: "item(ns)",
          tone: "warn",
          to: "/rh/documentos",
        },
      ] as const)
    : [];

  return (
    <RhGate ver={ctx.ver} loading={ctx.loading || colabs.isLoading} erro={colabs.error}>
      <div className="mx-auto max-w-[1400px]">
        <PageHeader
          eyebrow={eyebrow(ctx.ws)}
          title="Painel geral de RH"
          description="Pessoas, custos, indicadores e riscos em uma única visão."
        />
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Kpi
            label="Colaboradores ativos"
            value={ativos.length}
            sub={`${t.admissoes} admissões em 12 meses`}
          />
          <Kpi
            label="Custo mensal estimado"
            value={mesAtual ? brl0(mesAtual.total) : "—"}
            sub="Folha + encargos + benefícios"
          />
          <Kpi
            label="Turnover 12 meses"
            value={pct(t.taxa)}
            tone={t.taxa > meta ? "bad" : "good"}
            sub={`Meta: até ${pct(meta, 0)}`}
          />
          <Kpi
            label="Pendências de prazo"
            value={alertas ? pendencias : "—"}
            tone={pendencias ? "warn" : undefined}
            sub="ASOs, contratos e documentos em 30 dias"
          />
          <Kpi
            label="Contratos PJ ativos"
            value={alertas?.pj_ativos ?? "—"}
            sub={
              alertas
                ? `${brl0(alertas.pj_valor)}/mês · ${alertas.pj_30} vence(m) em 30 dias`
                : undefined
            }
          />
        </div>

        <div className="mb-6 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <Card
            title="Evolução do custo mensal de pessoal"
            sub="Realizado (Custos anuais) ou, sem lançamento, estimado pelo cadastro."
          >
            <div className="flex h-48 items-end gap-2">
              {serie.map((s) => (
                <div key={s.m} className="flex flex-1 flex-col items-center gap-1.5">
                  <span className="text-[10px] tabular-nums text-muted-foreground">
                    {s.valor ? brl0(s.valor / 1000).replace(",00", "") + "k" : ""}
                  </span>
                  <div
                    className={cn(
                      "w-full rounded-t-md",
                      s.realizado ? "bg-brand-blue" : "bg-brand-blue/25",
                    )}
                    style={{ height: `${(s.valor / maxSerie) * 140}px` }}
                    title={
                      s.realizado
                        ? `Realizado ${brl0(s.realizado)}`
                        : `Estimado ${brl0(s.estimado)}`
                    }
                  />
                  <span className="text-[11px] capitalize text-muted-foreground">
                    {fmtComp(s.m).split(" ")[0]}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex gap-4 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-brand-blue" />
                Realizado
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-brand-blue/25" />
                Estimado
              </span>
            </div>
          </Card>
          <Card title="Alertas que exigem atenção">
            <ul className="divide-y">
              {listaAlertas.map((a) => (
                <li key={a.l}>
                  <Link
                    to={a.to}
                    className="flex items-center justify-between gap-3 py-2.5 text-sm hover:text-brand-blue"
                  >
                    <span className="flex items-center gap-2">
                      <AlertTriangle
                        className={cn(
                          "h-4 w-4",
                          a.v
                            ? a.tone === "bad"
                              ? "text-red-600"
                              : "text-amber-500"
                            : "text-muted-foreground/40",
                        )}
                      />
                      {a.l}
                    </span>
                    <span
                      className={cn(
                        "tabular-nums",
                        a.v ? "font-semibold" : "text-muted-foreground",
                      )}
                    >
                      {a.v} {a.u}
                    </span>
                  </Link>
                </li>
              ))}
              {!alertas && <li className="py-4 text-sm text-muted-foreground">Carregando…</li>}
            </ul>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card
            title="Indicadores acompanhados"
            action={
              <Link to="/rh/indicadores" className="text-xs text-brand-blue hover:underline">
                Ver todos
              </Link>
            }
          >
            <dl className="divide-y text-sm">
              <div className="flex justify-between py-2">
                <dt className="text-muted-foreground">Turnover 12 meses</dt>
                <dd className="font-semibold tabular-nums">{pct(t.taxa)}</dd>
              </div>
              <div className="flex justify-between py-2">
                <dt className="text-muted-foreground">Custo por pessoa (mês)</dt>
                <dd className="font-semibold tabular-nums">
                  {mesAtual && ativos.length ? brl0(mesAtual.total / ativos.length) : "—"}
                </dd>
              </div>
              <div className="flex justify-between py-2">
                <dt className="text-muted-foreground">Desligamentos 12 meses</dt>
                <dd className="font-semibold tabular-nums">{t.desligamentos}</dd>
              </div>
              <div className="flex justify-between py-2">
                <dt className="text-muted-foreground">Afastados</dt>
                <dd className="font-semibold tabular-nums">
                  {lista.filter((c) => c.status === "afastado").length}
                </dd>
              </div>
            </dl>
          </Card>
          <Card title="Composição do custo mensal" sub="Estimativa pelo cadastro e parâmetros">
            {mesAtual && mesAtual.total > 0 ? (
              <div className="space-y-3 text-sm">
                {[
                  ["Salários e variáveis", mesAtual.salarios],
                  ["Encargos e provisões", mesAtual.encargos],
                  ["VR / VA e benefícios", mesAtual.beneficios],
                ].map(([l, v]) => (
                  <div key={l as string}>
                    <div className="mb-1 flex justify-between">
                      <span className="text-muted-foreground">{l}</span>
                      <span className="font-medium tabular-nums">{brl0(v as number)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted">
                      <div
                        className="h-1.5 rounded-full bg-brand-blue"
                        style={{ width: `${((v as number) / mesAtual.total) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Lance salários e benefícios para ver a composição.
              </p>
            )}
          </Card>
          <Card
            title="Próximas datas do RH"
            action={
              <Link to="/rh/calendario" className="text-xs text-brand-blue hover:underline">
                Calendário
              </Link>
            }
          >
            {proximas.length ? (
              <ul className="space-y-3 text-sm">
                {proximas.map((x) => (
                  <li key={x.id} className="flex gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-muted text-xs font-semibold tabular-nums">
                      {String(x.dia).padStart(2, "0")}
                    </span>
                    <div className="min-w-0">
                      <div className="leading-snug">{x.atividade}</div>
                      <div className="text-xs text-muted-foreground">
                        {x.responsavel ?? "RH"} · {x.recorrencia}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarClock className="h-4 w-4" />
                Sem atividades no calendário.
              </p>
            )}
          </Card>
        </div>
        <Nota>
          Custos e turnover vêm do cadastro de colaboradores, de Salários e benefícios e de Custos
          anuais. São estimativas gerenciais; a folha oficial segue com DP/Contabilidade.
        </Nota>
      </div>
    </RhGate>
  );
}
