import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/os/page";
import {
  Card,
  ColabSelect,
  EmpresaTag,
  Field,
  Kpi,
  Nota,
  NumInput,
  Pill,
  RhGate,
  Tabela,
  eyebrow,
} from "@/components/rh/ui";
import {
  TIPO_REM,
  beneficiosEm,
  brl,
  fmtComp,
  fmtData,
  mesISO,
  pct,
  rdb,
  salarioEm,
  useColaboradores,
  useInvalidateRh,
  useParametros,
  useRemuneracao,
  useRhCtx,
  type Colaborador,
  type Remuneracao,
  type TipoRem,
} from "@/os/rh/data";

export const Route = createFileRoute("/_authenticated/rh/remuneracao")({
  head: () => ({ meta: [{ title: "Salários e benefícios · RH — render.os" }] }),
  component: RemuneracaoPage,
});

/** Histórico de salário com o % de cada reajuste. */
function historicoSalario(rems: Remuneracao[], id: string) {
  const s = rems
    .filter((r) => r.colaborador_id === id && r.tipo === "salario")
    .sort((a, b) => a.competencia.localeCompare(b.competencia));
  return s
    .map((r, i) => ({
      ...r,
      reajuste:
        i > 0 && s[i - 1]!.valor ? ((r.valor - s[i - 1]!.valor) / s[i - 1]!.valor) * 100 : null,
    }))
    .reverse();
}

function RemuneracaoPage() {
  const ctx = useRhCtx("rh.remuneracao");
  const colabs = useColaboradores(ctx.empresas);
  const lista = (colabs.data ?? []).filter((c) => c.status !== "desligado");
  const remQ = useRemuneracao(colabs.data ?? [], (colabs.data ?? []).length > 0);
  const rems = remQ.data ?? [];
  const params = useParametros(ctx.empresas);
  const [novo, setNovo] = useState<Partial<Remuneracao> | null>(null);
  const [aberto, setAberto] = useState<Colaborador | null>(null);
  const ano = String(new Date().getFullYear());
  const mes = mesISO();

  const linhas = useMemo(
    () =>
      lista.map((c) => {
        const hist = historicoSalario(rems, c.id);
        const ultimoReaj = hist.find((h) => h.reajuste !== null);
        const variaveisAno = rems
          .filter(
            (r) =>
              r.colaborador_id === c.id &&
              (r.tipo === "gratificacao" || r.tipo === "adicional") &&
              r.competencia.startsWith(ano),
          )
          .reduce((a, r) => a + r.valor, 0);
        return {
          c,
          salario: salarioEm(rems, c.id),
          ultimoReaj,
          beneficios: beneficiosEm(rems, c.id, mes),
          variaveisAno,
        };
      }),
    [lista, rems, ano, mes],
  );

  const folhaMes = linhas.reduce((a, l) => a + l.salario, 0);
  const benMes = linhas.reduce((a, l) => a + l.beneficios, 0);
  const gratAno = linhas.reduce((a, l) => a + l.variaveisAno, 0);
  const semSalario = linhas.filter((l) => !l.salario).length;

  return (
    <RhGate
      ver={ctx.ver}
      loading={ctx.loading || colabs.isLoading}
      erro={colabs.error ?? remQ.error}
    >
      <div className="mx-auto max-w-[1400px]">
        <PageHeader
          eyebrow={eyebrow(ctx.ws)}
          title="Salários e benefícios"
          description="Salário contratual, reajustes, gratificações, VR/VA, VT e outros benefícios por pessoa."
          actions={
            ctx.edita() && (
              <Button size="sm" onClick={() => setNovo({ tipo: "salario", competencia: mes })}>
                <Plus className="mr-1.5 h-4 w-4" />
                Novo lançamento
              </Button>
            )
          }
        />
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi
            label="Salários vigentes"
            value={brl(folhaMes)}
            sub={`${linhas.length} pessoas ativas`}
          />
          <Kpi label="Benefícios no mês" value={brl(benMes)} sub="VR/VA, VT e outros vigentes" />
          <Kpi
            label={`Gratificações ${ano}`}
            value={brl(gratAno)}
            sub="Gratificações e adicionais lançados"
          />
          <Kpi
            label="Sem salário cadastrado"
            value={semSalario}
            tone={semSalario ? "warn" : undefined}
            sub={semSalario ? "Lance o salário para entrar nos custos" : "Tudo cadastrado"}
          />
        </div>

        {!ctx.grupo && params.data && (
          <Parametros empresa={ctx.ws} p={params.data(ctx.ws)} edita={ctx.edita(ctx.ws)} />
        )}

        <Tabela
          colSpan={7}
          vazio={!linhas.length && "Cadastre colaboradores para lançar salários e benefícios."}
          cab={
            <tr>
              <th>Colaborador</th>
              {ctx.grupo && <th>Empresa</th>}
              <th className="text-right">Salário vigente</th>
              <th>Último reajuste</th>
              <th className="text-right">Benefícios / mês</th>
              <th className="text-right">Variáveis {ano}</th>
              <th />
            </tr>
          }
        >
          {linhas.map(({ c, salario, ultimoReaj, beneficios, variaveisAno }) => (
            <tr
              key={c.id}
              className="cursor-pointer hover:bg-muted/30"
              onClick={() => setAberto(c)}
            >
              <td>
                <div className="font-medium">{c.nome}</div>
                <div className="text-xs text-muted-foreground">
                  {[c.cargo, c.vinculo].filter(Boolean).join(" · ")}
                </div>
              </td>
              {ctx.grupo && (
                <td>
                  <EmpresaTag id={c.empresa} />
                </td>
              )}
              <td className="text-right tabular-nums">
                {salario ? brl(salario) : <Pill tone="warn">Sem salário</Pill>}
              </td>
              <td className="text-xs">
                {ultimoReaj ? (
                  <>
                    {fmtComp(ultimoReaj.competencia)} · <b>{pct(ultimoReaj.reajuste!)}</b>
                  </>
                ) : (
                  "—"
                )}
              </td>
              <td className="text-right tabular-nums">{brl(beneficios)}</td>
              <td className="text-right tabular-nums">{brl(variaveisAno)}</td>
              <td className="text-right text-xs text-brand-blue">Ver histórico</td>
            </tr>
          ))}
        </Tabela>
        <Nota>
          Cada pagamento registra colaborador, motivo, valor e competência para alimentar o custo
          total. Salário vale a partir da competência lançada (o reajuste é um novo salário).
          Benefício é mensal e vale até a data de fim, se houver; gratificação e adicional valem só
          na competência.
        </Nota>

        {aberto && (
          <Historico
            c={aberto}
            rems={rems}
            edita={ctx.edita(aberto.empresa)}
            onNovo={(t) => setNovo({ colaborador_id: aberto.id, tipo: t, competencia: mes })}
            onClose={() => setAberto(null)}
          />
        )}
        {novo && (
          <LancamentoDialog
            value={novo}
            colabs={lista.filter((c) => ctx.edita(c.empresa))}
            onClose={() => setNovo(null)}
          />
        )}
      </div>
    </RhGate>
  );
}

function Parametros({
  empresa,
  p,
  edita,
}: {
  empresa: string;
  p: { encargos_pct: number; provisoes_pct: number; meta_turnover: number };
  edita: boolean;
}) {
  const invalidate = useInvalidateRh();
  const [f, setF] = useState(p);
  const mudou =
    f.encargos_pct !== p.encargos_pct ||
    f.provisoes_pct !== p.provisoes_pct ||
    f.meta_turnover !== p.meta_turnover;
  async function salvar() {
    const { error } = await rdb
      .from("rh_parametros")
      .upsert({ empresa, ...f, atualizado_em: new Date().toISOString() });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Parâmetros salvos.");
    void invalidate();
  }
  return (
    <Card
      title="Parâmetros da empresa"
      sub="Usados nas estimativas de custo do painel, da folha e do simulador."
      className="mb-6"
      action={
        edita &&
        mudou && (
          <Button size="sm" onClick={() => void salvar()}>
            Salvar
          </Button>
        )
      }
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Field
          label="Encargos patronais estimados (%)"
          hint="INSS patronal, FGTS, RAT/FAP, terceiros"
        >
          <NumInput value={f.encargos_pct} onChange={(v) => setF({ ...f, encargos_pct: v })} />
        </Field>
        <Field label="Provisões estimadas (%)" hint="13º, férias e 1/3 (só CLT)">
          <NumInput value={f.provisoes_pct} onChange={(v) => setF({ ...f, provisoes_pct: v })} />
        </Field>
        <Field label="Meta de turnover 12 meses (%)">
          <NumInput value={f.meta_turnover} onChange={(v) => setF({ ...f, meta_turnover: v })} />
        </Field>
      </div>
    </Card>
  );
}

function Historico({
  c,
  rems,
  edita,
  onNovo,
  onClose,
}: {
  c: Colaborador;
  rems: Remuneracao[];
  edita: boolean;
  onNovo: (t: TipoRem) => void;
  onClose: () => void;
}) {
  const invalidate = useInvalidateRh();
  const sal = historicoSalario(rems, c.id);
  const outros = rems.filter((r) => r.colaborador_id === c.id && r.tipo !== "salario");
  async function excluir(r: Remuneracao) {
    if (
      !confirm(
        `Excluir ${TIPO_REM[r.tipo].toLowerCase()} de ${brl(r.valor)} (${fmtComp(r.competencia)})?`,
      )
    )
      return;
    const { error } = await rdb.from("rh_remuneracao").delete().eq("id", r.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    void invalidate();
  }
  const Linha = ({ r, extra }: { r: Remuneracao; extra?: React.ReactNode }) => (
    <li className="flex items-start justify-between gap-3 py-2.5 text-sm">
      <div className="min-w-0">
        <div className="font-medium tabular-nums">
          {brl(r.valor)} {extra}
        </div>
        <div className="text-xs text-muted-foreground">
          {r.tipo === "beneficio"
            ? `${fmtComp(r.competencia)} → ${r.fim ? fmtComp(r.fim) : "vigente"}`
            : fmtComp(r.competencia)}
          {r.descricao && ` · ${r.descricao}`}
        </div>
      </div>
      {edita && (
        <button
          type="button"
          className="p-1 text-muted-foreground hover:text-destructive"
          aria-label="Excluir"
          onClick={() => void excluir(r)}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </li>
  );
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{c.nome}</SheetTitle>
        </SheetHeader>
        <p className="px-4 text-xs text-muted-foreground">
          {[c.cargo, c.setor, c.vinculo, c.admissao && `admissão ${fmtData(c.admissao)}`]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <div className="space-y-6 p-4">
          <section>
            <div className="mb-1 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Salário e reajustes</h3>
              {edita && (
                <Button size="sm" variant="outline" onClick={() => onNovo("salario")}>
                  Reajustar
                </Button>
              )}
            </div>
            <ul className="divide-y">
              {sal.map((r) => (
                <Linha
                  key={r.id}
                  r={r}
                  extra={
                    r.reajuste !== null && (
                      <Pill tone={r.reajuste >= 0 ? "good" : "bad"}>
                        {r.reajuste >= 0 ? "+" : ""}
                        {pct(r.reajuste)}
                      </Pill>
                    )
                  }
                />
              ))}
            </ul>
            {!sal.length && <p className="text-xs text-muted-foreground">Sem salário lançado.</p>}
          </section>
          <section>
            <div className="mb-1 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Benefícios, gratificações e adicionais</h3>
              {edita && (
                <div className="flex gap-1.5">
                  <Button size="sm" variant="outline" onClick={() => onNovo("beneficio")}>
                    Benefício
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => onNovo("gratificacao")}>
                    Gratificação
                  </Button>
                </div>
              )}
            </div>
            <ul className="divide-y">
              {outros.map((r) => (
                <Linha
                  key={r.id}
                  r={r}
                  extra={
                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                      {TIPO_REM[r.tipo]}
                    </span>
                  }
                />
              ))}
            </ul>
            {!outros.length && <p className="text-xs text-muted-foreground">Nada lançado.</p>}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function LancamentoDialog({
  value,
  colabs,
  onClose,
}: {
  value: Partial<Remuneracao>;
  colabs: Colaborador[];
  onClose: () => void;
}) {
  const invalidate = useInvalidateRh();
  const [f, setF] = useState<Partial<Remuneracao>>(value);
  const [salvando, setSalvando] = useState(false);
  async function salvar() {
    if (!f.colaborador_id || !f.tipo || !f.valor || !f.competencia) {
      toast.error("Preencha colaborador, tipo, valor e competência.");
      return;
    }
    setSalvando(true);
    const { error } = await rdb.from("rh_remuneracao").insert({
      colaborador_id: f.colaborador_id,
      tipo: f.tipo,
      descricao: f.descricao || null,
      valor: f.valor,
      competencia: f.competencia.slice(0, 7) + "-01",
      fim: f.tipo === "beneficio" && f.fim ? f.fim.slice(0, 7) + "-01" : null,
    });
    setSalvando(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Lançamento salvo.");
    void invalidate();
    onClose();
  }
  const sugestoes: Record<TipoRem, string> = {
    salario: "Reajuste anual, promoção…",
    gratificacao: "Meta do trimestre, bônus…",
    adicional: "Hora extra, noturno, insalubridade…",
    beneficio: "VR, VA, VT, plano de saúde, home office…",
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo lançamento</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Colaborador" full>
            <ColabSelect
              value={f.colaborador_id}
              onChange={(id) => setF({ ...f, colaborador_id: id })}
              colabs={colabs}
            />
          </Field>
          <Field label="Tipo">
            <Select value={f.tipo} onValueChange={(v) => setF({ ...f, tipo: v as TipoRem })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TIPO_REM).map(([k, l]) => (
                  <SelectItem key={k} value={k}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Valor (R$)">
            <NumInput value={f.valor} onChange={(v) => setF({ ...f, valor: v })} />
          </Field>
          <Field
            label={
              f.tipo === "salario"
                ? "Vale a partir de"
                : f.tipo === "beneficio"
                  ? "Início"
                  : "Competência"
            }
          >
            <Input
              type="month"
              value={f.competencia?.slice(0, 7) ?? ""}
              onChange={(e) =>
                setF({ ...f, competencia: e.target.value ? e.target.value + "-01" : undefined })
              }
            />
          </Field>
          {f.tipo === "beneficio" && (
            <Field label="Fim (opcional)">
              <Input
                type="month"
                value={f.fim?.slice(0, 7) ?? ""}
                onChange={(e) =>
                  setF({ ...f, fim: e.target.value ? e.target.value + "-01" : null })
                }
              />
            </Field>
          )}
          <Field label="Descrição / motivo" full>
            <Input
              value={f.descricao ?? ""}
              placeholder={f.tipo ? sugestoes[f.tipo] : ""}
              onChange={(e) => setF({ ...f, descricao: e.target.value })}
            />
          </Field>
        </div>
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => void salvar()} disabled={salvando}>
            {salvando ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
