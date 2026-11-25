import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { PageHeader } from "@/components/os/page";
import { Card, Kpi, Nota, Pill, RhGate, Tabela, eyebrow } from "@/components/rh/ui";
import {
  brl0,
  custoPessoa,
  pct,
  turnover12,
  useColaboradores,
  useParametros,
  useRemuneracao,
  useRhCtx,
  type Colaborador,
} from "@/os/rh/data";

export const Route = createFileRoute("/_authenticated/rh/indicadores")({
  head: () => ({ meta: [{ title: "Indicadores · RH — render.os" }] }),
  component: Indicadores,
});

type Fonte = "ok" | "ponto" | "pesquisa" | "modulo";
const CATALOGO: {
  nome: string;
  responde: string;
  periodo: string;
  fonte: string;
  status: Fonte;
}[] = [
  {
    nome: "CTB / custo total",
    responde: "Quanto custa manter a força de trabalho.",
    periodo: "Mensal",
    fonte: "Folha + benefícios + encargos",
    status: "ok",
  },
  {
    nome: "Turnover",
    responde: "Rotatividade geral e por setor.",
    periodo: "Mensal",
    fonte: "Admissões, desligamentos e quadro médio",
    status: "ok",
  },
  {
    nome: "Custo por colaborador",
    responde: "Custo médio mensal e anual por pessoa.",
    periodo: "Mensal",
    fonte: "Folha + benefícios + encargos",
    status: "ok",
  },
  {
    nome: "Experiência / retenção",
    responde: "Conclusão do período de experiência.",
    periodo: "Mensal",
    fonte: "Admissões e desligamentos",
    status: "ok",
  },
  {
    nome: "Saúde e segurança",
    responde: "ASOs em dia, vencidos e afastamentos.",
    periodo: "Mensal",
    fonte: "ASO / SST",
    status: "ok",
  },
  {
    nome: "Aderência à escala",
    responde: "A jornada realizada corresponde à escala?",
    periodo: "Semanal/mensal",
    fonte: "Ponto + escala",
    status: "ponto",
  },
  {
    nome: "Absenteísmo",
    responde: "Tempo perdido por ausências.",
    periodo: "Mensal",
    fonte: "Ponto + afastamentos",
    status: "ponto",
  },
  {
    nome: "Horas extras",
    responde: "Volume e custo por setor.",
    periodo: "Mensal",
    fonte: "Ponto + folha",
    status: "ponto",
  },
  {
    nome: "Prazo de fechamento de vagas",
    responde: "Tempo para preencher uma vaga.",
    periodo: "Mensal",
    fonte: "Recrutamento",
    status: "modulo",
  },
  {
    nome: "Treinamentos",
    responde: "Execução, presença e eficácia.",
    periodo: "Mensal/trimestral",
    fonte: "Matriz de treinamentos",
    status: "modulo",
  },
  {
    nome: "Clima e engajamento",
    responde: "Percepção do ambiente e da liderança.",
    periodo: "Semestral",
    fonte: "Pesquisa de clima",
    status: "pesquisa",
  },
];
const STATUS: Record<Fonte, { l: string; tone: "good" | "warn" | "neutral" }> = {
  ok: { l: "No render.os", tone: "good" },
  ponto: { l: "Precisa do ponto", tone: "warn" },
  pesquisa: { l: "Precisa de pesquisa", tone: "neutral" },
  modulo: { l: "Módulo futuro", tone: "neutral" },
};

function mesesDeCasa(c: Colaborador): number {
  if (!c.admissao) return 0;
  const fim = c.desligamento ? new Date(c.desligamento) : new Date();
  const ini = new Date(c.admissao);
  return Math.max(
    0,
    (fim.getFullYear() - ini.getFullYear()) * 12 + fim.getMonth() - ini.getMonth(),
  );
}

function Indicadores() {
  const ctx = useRhCtx("rh.painel");
  const colabs = useColaboradores(ctx.empresas);
  const lista = colabs.data ?? [];
  const { data: rems = [] } = useRemuneracao(lista, lista.length > 0);
  const params = useParametros(ctx.empresas);
  const ativos = lista.filter((c) => c.status !== "desligado");
  const t = turnover12(lista);
  const custo = params.data
    ? ativos.reduce((a, c) => a + custoPessoa(rems, c, params.data!(c.empresa)).total, 0)
    : 0;
  const casa = ativos.length ? ativos.reduce((a, c) => a + mesesDeCasa(c), 0) / ativos.length : 0;

  // Desligados com menos de 90 dias de casa nos últimos 12 meses (saída na experiência).
  const umAno = new Date();
  umAno.setFullYear(umAno.getFullYear() - 1);
  const admitidos12 = lista.filter((c) => c.admissao && new Date(c.admissao) >= umAno);
  const saiuNaExperiencia = admitidos12.filter((c) => c.desligamento && mesesDeCasa(c) < 3).length;

  const porSetor = useMemo(() => {
    const m = new Map<string, Colaborador[]>();
    for (const c of lista)
      m.set(c.setor || "Sem setor", [...(m.get(c.setor || "Sem setor") ?? []), c]);
    return [...m.entries()]
      .map(([setor, cs]) => {
        const tt = turnover12(cs);
        const at = cs.filter((c) => c.status !== "desligado");
        const k = params.data
          ? at.reduce((a, c) => a + custoPessoa(rems, c, params.data!(c.empresa)).total, 0)
          : 0;
        return {
          setor,
          ativos: at.length,
          turnover: tt.taxa,
          desligamentos: tt.desligamentos,
          custo: k,
        };
      })
      .sort((a, b) => b.ativos - a.ativos);
  }, [lista, rems, params.data]);

  return (
    <RhGate ver={ctx.ver} loading={ctx.loading || colabs.isLoading} erro={colabs.error}>
      <div className="mx-auto max-w-[1400px]">
        <PageHeader
          eyebrow={eyebrow(ctx.ws)}
          title="Indicadores de RH"
          description="Fórmulas, periodicidade e fonte de cada indicador, com os números que o render.os já calcula."
        />
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi
            label="Turnover 12 meses"
            value={pct(t.taxa)}
            sub={`${t.desligamentos} desligamentos / quadro médio ${t.quadroMedio.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}`}
          />
          <Kpi
            label="CTB · custo total / mês"
            value={brl0(custo)}
            sub="Salários, variáveis, encargos, provisões e benefícios"
          />
          <Kpi
            label="Custo por pessoa"
            value={ativos.length ? brl0(custo / ativos.length) : "—"}
            sub={ativos.length ? `${brl0((custo / ativos.length) * 12)} por ano` : undefined}
          />
          <Kpi
            label="Tempo médio de casa"
            value={`${(casa / 12).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} anos`}
            sub={`${saiuNaExperiencia} de ${admitidos12.length} admitidos saíram na experiência`}
          />
        </div>

        <Card
          title="Por setor"
          sub="Quadro, turnover 12 meses e custo mensal estimado."
          className="mb-6"
        >
          <div className="-mx-5 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="px-5 py-2 text-left font-medium">Setor</th>
                  <th className="px-3 py-2 text-right font-medium">Ativos</th>
                  <th className="px-3 py-2 text-right font-medium">Desligamentos</th>
                  <th className="px-3 py-2 text-right font-medium">Turnover</th>
                  <th className="px-5 py-2 text-right font-medium">Custo / mês</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {porSetor.map((s) => (
                  <tr key={s.setor}>
                    <td className="px-5 py-2 font-medium">{s.setor}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{s.ativos}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{s.desligamentos}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{pct(s.turnover)}</td>
                    <td className="px-5 py-2 text-right tabular-nums">{brl0(s.custo)}</td>
                  </tr>
                ))}
                {!porSetor.length && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-muted-foreground">
                      Cadastre colaboradores com setor.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <h2 className="mb-3 text-sm font-semibold">Catálogo de indicadores para diretoria</h2>
        <Tabela
          cab={
            <tr>
              <th>Indicador</th>
              <th>O que responde</th>
              <th>Periodicidade</th>
              <th>Fonte</th>
              <th>Situação</th>
            </tr>
          }
        >
          {CATALOGO.map((i) => (
            <tr key={i.nome}>
              <td className="font-medium">{i.nome}</td>
              <td className="text-muted-foreground">{i.responde}</td>
              <td>{i.periodo}</td>
              <td className="text-xs">{i.fonte}</td>
              <td>
                <Pill tone={STATUS[i.status].tone}>{STATUS[i.status].l}</Pill>
              </td>
            </tr>
          ))}
        </Tabela>
        <Nota>
          <b>Fórmulas usadas:</b> turnover = desligamentos nos últimos 12 meses ÷ média do quadro no
          início e no fim do período. CTB = salário vigente + gratificações/adicionais do mês +
          encargos e provisões (parâmetros da empresa) + benefícios vigentes. Confirme a definição
          interna de CTB com a diretoria. Absenteísmo, aderência à escala e horas extras dependem de
          integrar o ponto.
        </Nota>
      </div>
    </RhGate>
  );
}
