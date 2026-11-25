import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Download, Printer, RefreshCw, Trash2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  ativoNoMes,
  baixarCsv,
  brl,
  calcFolha,
  custoPessoa,
  fmtComp,
  folhaDoCadastro,
  mesISO,
  nomeEmpresa,
  rdb,
  useColaboradores,
  useFolha,
  useInvalidateRh,
  useParametros,
  useRemuneracao,
  useRhCtx,
  PARAM_PADRAO,
  type Colaborador,
  type Folha,
} from "@/os/rh/data";

export const Route = createFileRoute("/_authenticated/rh/folha")({
  head: () => ({ meta: [{ title: "Folha · RH — render.os" }] }),
  component: FolhaPage,
});

function FolhaPage() {
  const ctx = useRhCtx("rh.remuneracao");
  const colabs = useColaboradores(ctx.empresas);
  return (
    <RhGate ver={ctx.ver} loading={ctx.loading || colabs.isLoading} erro={colabs.error}>
      <div className="mx-auto max-w-[1400px]">
        <PageHeader
          eyebrow={eyebrow(ctx.ws)}
          title="Folha"
          description="Prévia individual de bruto, descontos e líquido, e simulação de cenários de custo."
        />
        <Tabs defaultValue="colaborador">
          <TabsList className="mb-6">
            <TabsTrigger value="colaborador">Por colaborador</TabsTrigger>
            <TabsTrigger value="simulador">Simulador de folha</TabsTrigger>
          </TabsList>
          <TabsContent value="colaborador">
            <PorColaborador colabs={colabs.data ?? []} />
          </TabsContent>
          <TabsContent value="simulador">
            <Simulador colabs={colabs.data ?? []} />
          </TabsContent>
        </Tabs>
      </div>
    </RhGate>
  );
}

function PorColaborador({ colabs }: { colabs: Colaborador[] }) {
  const ctx = useRhCtx("rh.remuneracao");
  const invalidate = useInvalidateRh();
  const [comp, setComp] = useState(mesISO());
  const [filtro, setFiltro] = useState("todas");
  const doMes = colabs.filter(
    (c) => ativoNoMes(c, comp) && (filtro === "todas" || c.empresa === filtro),
  );
  const folha = useFolha(colabs, comp, colabs.length > 0);
  const { data: rems = [] } = useRemuneracao(colabs, colabs.length > 0);
  const params = useParametros(ctx.empresas);
  const [editando, setEditando] = useState<{
    c: Colaborador;
    f: Omit<Folha, "id"> & { id?: string };
  } | null>(null);
  const [gerando, setGerando] = useState(false);

  const porColab = new Map((folha.data ?? []).map((f) => [f.colaborador_id, f]));
  const linhas = doMes
    .map((c) => ({ c, f: porColab.get(c.id) }))
    .sort((a, b) => a.c.empresa.localeCompare(b.c.empresa) || a.c.nome.localeCompare(b.c.nome));
  const feitas = linhas.filter((l) => l.f).map((l) => ({ ...l, calc: calcFolha(l.f!) }));
  const faltam = linhas.filter((l) => !l.f && ctx.edita(l.c.empresa));
  const soma = (k: "base" | "liquido" | "custo") => feitas.reduce((a, l) => a + l.calc[k], 0);

  async function gerar() {
    if (!params.data) return;
    setGerando(true);
    const rows = faltam.map(({ c }) => folhaDoCadastro(c, rems, params.data!(c.empresa), comp));
    const { error } = await rdb
      .from("rh_folha")
      .upsert(rows, { onConflict: "colaborador_id,competencia", ignoreDuplicates: true });
    setGerando(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(
      `${rows.length} linha(s) geradas a partir do cadastro. Ajuste INSS, IRRF e descontos de cada pessoa.`,
    );
    void invalidate();
  }

  async function excluir(f: Folha) {
    const { error } = await rdb.from("rh_folha").delete().eq("id", f.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    void invalidate();
  }

  function exportar() {
    baixarCsv(
      `folha_${comp.slice(0, 7)}.csv`,
      [
        "Empresa",
        "Colaborador",
        "Salário bruto",
        "Gratificação",
        "INSS estimado",
        "IRRF estimado",
        "VT descontado",
        "VA/VR descontado",
        "Outros descontos",
        "Líquido a pagar",
        "Benefícios empresa",
        "Encargos patronais",
        "Custo empresa",
      ],
      feitas.map(({ c, f, calc }) =>
        [
          nomeEmpresa(c.empresa),
          c.nome,
          f!.bruto,
          f!.gratificacao,
          calc.inss.toFixed(2),
          f!.irrf,
          f!.vt,
          f!.va,
          f!.outros_descontos,
          calc.liquido.toFixed(2),
          f!.beneficios,
          calc.encargos.toFixed(2),
          calc.custo.toFixed(2),
        ].map((v) =>
          typeof v === "number"
            ? v.toFixed(2).replace(".", ",")
            : typeof v === "string" && /^-?\d+\.\d+$/.test(v)
              ? v.replace(".", ",")
              : v,
        ),
      ),
    );
  }

  function imprimir() {
    const el = document.getElementById("folha-tabela");
    if (!el) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(
      `<html><head><title>Folha ${fmtComp(comp)}</title><style>body{font-family:system-ui,sans-serif;padding:24px;font-size:12px}table{border-collapse:collapse;width:100%}th,td{border-bottom:1px solid #ddd;padding:6px 8px;text-align:left}td:not(:first-child),th:not(:first-child){text-align:right}button,.no-print{display:none}</style></head><body><h2>Prévia da folha · ${fmtComp(comp)}</h2><p>Estimativa gerencial, não é cálculo legal.</p>${el.outerHTML}</body></html>`,
    );
    w.document.close();
    w.print();
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Field label="Competência">
          <Input
            type="month"
            className="w-44"
            value={comp.slice(0, 7)}
            onChange={(e) => e.target.value && setComp(e.target.value + "-01")}
          />
        </Field>
        {ctx.grupo && (
          <Field label="Empresa">
            <Select value={filtro} onValueChange={setFiltro}>
              <SelectTrigger className="w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as empresas</SelectItem>
                {ctx.empresas.map((e) => (
                  <SelectItem key={e} value={e}>
                    {nomeEmpresa(e)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}
        <div className="ml-auto flex gap-2">
          {faltam.length > 0 && (
            <Button size="sm" onClick={() => void gerar()} disabled={gerando || !params.data}>
              <Wand2 className="mr-1.5 h-4 w-4" />
              {gerando ? "Gerando…" : `Gerar ${faltam.length} do cadastro`}
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={exportar} disabled={!feitas.length}>
            <Download className="mr-1.5 h-4 w-4" />
            CSV
          </Button>
          <Button size="sm" variant="outline" onClick={imprimir} disabled={!feitas.length}>
            <Printer className="mr-1.5 h-4 w-4" />
            Imprimir / PDF
          </Button>
        </div>
      </div>
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Kpi
          label="Total bruto da folha"
          value={brl(soma("base"))}
          sub={`${feitas.length} de ${linhas.length} pessoas na prévia`}
        />
        <Kpi label="Total líquido a pagar" value={brl(soma("liquido"))} />
        <Kpi
          label="Custo total estimado"
          value={brl(soma("custo"))}
          sub="Bruto + encargos + benefícios"
        />
      </div>
      <div id="folha-tabela">
        <Tabela
          colSpan={12}
          vazio={!linhas.length && "Ninguém ativo nesta competência."}
          cab={
            <tr>
              <th>Colaborador</th>
              <th className="text-right">Bruto</th>
              <th className="text-right">Gratif.</th>
              <th className="text-right">INSS</th>
              <th className="text-right">IRRF</th>
              <th className="text-right">VT</th>
              <th className="text-right">VA/VR</th>
              <th className="text-right">Outros</th>
              <th className="text-right">Líquido</th>
              <th className="text-right">Custo empresa</th>
              <th className="no-print" />
            </tr>
          }
        >
          {linhas.map(({ c, f }) => {
            const k = f ? calcFolha(f) : null;
            const edita = ctx.edita(c.empresa);
            return (
              <tr
                key={c.id}
                className={edita ? "cursor-pointer hover:bg-muted/30" : ""}
                onClick={() =>
                  edita &&
                  params.data &&
                  setEditando({ c, f: f ?? folhaDoCadastro(c, rems, params.data(c.empresa), comp) })
                }
              >
                <td>
                  <div className="font-medium">{c.nome}</div>
                  {ctx.grupo && <EmpresaTag id={c.empresa} />}
                </td>
                {f && k ? (
                  <>
                    <td className="text-right tabular-nums">{brl(f.bruto)}</td>
                    <td className="text-right tabular-nums">{brl(f.gratificacao)}</td>
                    <td className="text-right tabular-nums">{brl(k.inss)}</td>
                    <td className="text-right tabular-nums">{brl(f.irrf)}</td>
                    <td className="text-right tabular-nums">{brl(f.vt)}</td>
                    <td className="text-right tabular-nums">{brl(f.va)}</td>
                    <td className="text-right tabular-nums">{brl(f.outros_descontos)}</td>
                    <td className="text-right font-semibold tabular-nums">{brl(k.liquido)}</td>
                    <td className="text-right tabular-nums">{brl(k.custo)}</td>
                    <td className="no-print text-right">
                      {edita && (
                        <button
                          type="button"
                          aria-label="Remover da prévia"
                          className="p-1 text-muted-foreground hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            void excluir(f);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </>
                ) : (
                  <td colSpan={10}>
                    <Pill tone="neutral">Fora da prévia</Pill>{" "}
                    {edita && (
                      <span className="text-xs text-muted-foreground">
                        Clique para preencher, ou gere a partir do cadastro.
                      </span>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </Tabela>
      </div>
      <Nota>
        INSS e IRRF são estimativas configuráveis por pessoa, não cálculo legal automático. O
        cálculo correto depende das tabelas vigentes, dependentes, pensão, rubricas, incidências e
        regras de cada vínculo — valide com DP/Contabilidade. VT e VA/VR entram como desconto só
        quando aplicáveis.
      </Nota>
      {editando && (
        <FolhaDialog c={editando.c} value={editando.f} onClose={() => setEditando(null)} />
      )}
    </>
  );
}

function FolhaDialog({
  c,
  value,
  onClose,
}: {
  c: Colaborador;
  value: Omit<Folha, "id"> & { id?: string };
  onClose: () => void;
}) {
  const invalidate = useInvalidateRh();
  const [f, setF] = useState(value);
  const k = calcFolha(f);
  const n = (key: keyof Folha) => (
    <NumInput value={f[key] as number} onChange={(v) => setF({ ...f, [key]: v })} />
  );
  async function salvar() {
    const { id: _id, ...row } = f;
    const { error } = await rdb
      .from("rh_folha")
      .upsert(row, { onConflict: "colaborador_id,competencia" });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Prévia salva.");
    void invalidate();
    onClose();
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {c.nome} · {fmtComp(f.competencia)}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Salário bruto (R$)">{n("bruto")}</Field>
          <Field label="Gratificação / variável (R$)">{n("gratificacao")}</Field>
          <Field label="INSS estimado (%)">{n("inss_pct")}</Field>
          <Field label="IRRF estimado (R$)">{n("irrf")}</Field>
          <Field label="VT descontado (R$)">{n("vt")}</Field>
          <Field label="VA/VR descontado (R$)">{n("va")}</Field>
          <Field label="Outros descontos (R$)">{n("outros_descontos")}</Field>
          <Field label="Benefícios pagos pela empresa (R$)">{n("beneficios")}</Field>
          <Field label="Encargos patronais (%)">{n("encargos_pct")}</Field>
        </div>
        <dl className="mt-2 grid grid-cols-3 gap-3 rounded-lg bg-muted/40 p-4 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Descontos</dt>
            <dd className="font-semibold tabular-nums">{brl(k.descontos)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Líquido a pagar</dt>
            <dd className="font-semibold tabular-nums">{brl(k.liquido)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Custo empresa</dt>
            <dd className="font-semibold tabular-nums">{brl(k.custo)}</dd>
          </div>
        </dl>
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => void salvar()}>Salvar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface Cenario {
  qtd: number;
  salario: number;
  adicionais: number;
  encargos: number;
  provisoes: number;
  beneficios: number;
  grat: number;
  outros: number;
}
const EXEMPLO: Cenario = {
  qtd: 24,
  salario: 2583.33,
  adicionais: 2500,
  encargos: PARAM_PADRAO.encargos_pct,
  provisoes: PARAM_PADRAO.provisoes_pct,
  beneficios: 450,
  grat: 0,
  outros: 0,
};

function Simulador({ colabs }: { colabs: Colaborador[] }) {
  const ctx = useRhCtx("rh.remuneracao");
  const { data: rems = [] } = useRemuneracao(colabs, colabs.length > 0);
  const params = useParametros(ctx.empresas);
  const [s, setS] = useState<Cenario>(EXEMPLO);

  const atual = useMemo(() => {
    if (!params.data) return null;
    const ativos = colabs.filter((c) => c.status !== "desligado");
    const custos = ativos.map((c) => custoPessoa(rems, c, params.data!(c.empresa)));
    const qtd = ativos.length;
    const p = params.data(ctx.grupo ? (ctx.empresas[0] ?? "render") : ctx.ws);
    return {
      qtd,
      salario: qtd ? custos.reduce((a, k) => a + k.salario, 0) / qtd : 0,
      adicionais: custos.reduce((a, k) => a + k.variaveis, 0),
      encargos: p.encargos_pct,
      provisoes: p.provisoes_pct,
      beneficios: qtd ? custos.reduce((a, k) => a + k.beneficios, 0) / qtd : 0,
      grat: 0,
      outros: 0,
    } satisfies Cenario;
  }, [colabs, rems, params.data, ctx.grupo, ctx.empresas, ctx.ws]);

  const base = s.qtd * s.salario + s.adicionais;
  const enc = base * (s.encargos / 100);
  const prov = base * (s.provisoes / 100);
  const ben = s.qtd * s.beneficios;
  const total = base + enc + prov + ben + s.grat + s.outros;
  const campo = (k: keyof Cenario, label: string, step = "0.01") => (
    <Field label={label}>
      <NumInput step={step} value={s[k]} onChange={(v) => setS({ ...s, [k]: v })} />
    </Field>
  );
  const r2 = (n: number) => Math.round(n * 100) / 100;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <Card
        title="Parâmetros do cenário"
        sub="Contratação, reajuste, gratificação e benefícios."
        action={
          <div className="flex gap-2">
            {atual && atual.qtd > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setS({ ...atual, salario: r2(atual.salario), beneficios: r2(atual.beneficios) })
                }
              >
                <RefreshCw className="mr-1.5 h-4 w-4" />
                Usar quadro atual
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => setS(EXEMPLO)}>
              Restaurar exemplo
            </Button>
          </div>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {campo("qtd", "Quantidade de colaboradores", "1")}
          {campo("salario", "Salário bruto médio (R$)")}
          {campo("adicionais", "Adicionais / variáveis mensais (R$)")}
          {campo("encargos", "Encargos patronais estimados (%)")}
          {campo("provisoes", "Provisões estimadas (%)")}
          {campo("beneficios", "Benefícios mensais por pessoa (R$)")}
          {campo("grat", "Gratificações totais no mês (R$)")}
          {campo("outros", "Outros custos mensais (R$)")}
        </div>
      </Card>
      <Card title="Resultado estimado">
        <div className="space-y-3">
          <div className="rounded-lg bg-brand-blue/5 p-4">
            <div className="text-xs text-muted-foreground">Custo mensal total</div>
            <div className="text-3xl font-semibold tabular-nums text-brand-blue">{brl(total)}</div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Anual (12 meses)</div>
              <div className="font-semibold tabular-nums">{brl(total * 12)}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Por pessoa</div>
              <div className="font-semibold tabular-nums">{brl(s.qtd ? total / s.qtd : 0)}</div>
            </div>
          </div>
          <dl className="divide-y text-sm">
            {[
              ["Salários + adicionais", base],
              ["Encargos estimados", enc],
              ["Provisões estimadas", prov],
              ["Benefícios", ben],
              ["Gratificações + outros", s.grat + s.outros],
            ].map(([l, v]) => (
              <div key={l as string} className="flex justify-between py-2">
                <dt className="text-muted-foreground">{l}</dt>
                <dd className="tabular-nums">{brl(v as number)}</dd>
              </div>
            ))}
          </dl>
        </div>
      </Card>
      <div className="lg:col-span-2">
        <Nota>
          Simulador gerencial simplificado, não é cálculo legal de folha. Percentuais, incidências,
          regime tributário, RAT/FAP, terceiros, FGTS, INSS, convenção coletiva e rubricas devem ser
          validados por DP/Contabilidade. O anual simples multiplica por 12; o orçamento completo
          deve considerar 13º, férias, 1/3, rescisões e eventos variáveis sem duplicidade.
        </Nota>
      </div>
    </div>
  );
}
