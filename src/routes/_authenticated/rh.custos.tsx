import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Download, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  EmpresaSelect,
  EmpresaTag,
  Field,
  Kpi,
  Nota,
  NumInput,
  RhGate,
  Tabela,
  eyebrow,
} from "@/components/rh/ui";
import {
  CATEGORIAS,
  baixarCsv,
  brl,
  brl0,
  fmtComp,
  mesISO,
  nomeEmpresa,
  rdb,
  useCustos,
  useInvalidateRh,
  useOrcamentos,
  useRhCtx,
  type CategoriaCusto,
  type Custo,
} from "@/os/rh/data";
import type { CompanyId } from "@/os/companies";

export const Route = createFileRoute("/_authenticated/rh/custos")({
  head: () => ({ meta: [{ title: "Custos de pessoal · RH — render.os" }] }),
  component: CustosPage,
});

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function CustosPage() {
  const ctx = useRhCtx("rh.remuneracao");
  const custosQ = useCustos(ctx.empresas);
  const orcQ = useOrcamentos(ctx.empresas);
  const [ano, setAno] = useState(new Date().getFullYear());
  const [novo, setNovo] = useState<Partial<Custo> | null>(null);
  const [orcando, setOrcando] = useState(false);
  const invalidate = useInvalidateRh();

  const doAno = useMemo(
    () => (custosQ.data ?? []).filter((c) => c.competencia.startsWith(String(ano))),
    [custosQ.data, ano],
  );
  const orcamento = (orcQ.data ?? [])
    .filter((o) => o.ano === ano)
    .reduce((a, o) => a + Number(o.valor), 0);
  const total = doAno.reduce((a, c) => a + c.valor, 0);
  const vrva = doAno.filter((c) => c.categoria === "beneficios").reduce((a, c) => a + c.valor, 0);
  const matriz = (Object.keys(CATEGORIAS) as CategoriaCusto[])
    .map((cat) => {
      const meses = MESES.map((_, i) =>
        doAno
          .filter((c) => c.categoria === cat && Number(c.competencia.slice(5, 7)) === i + 1)
          .reduce((a, c) => a + c.valor, 0),
      );
      return { cat, meses, total: meses.reduce((a, v) => a + v, 0) };
    })
    .filter((l) => l.total !== 0);
  const totMes = MESES.map((_, i) => matriz.reduce((a, l) => a + l.meses[i]!, 0));
  const mesesComDado = totMes.filter((v) => v).length;
  const anos = [
    ...new Set([
      new Date().getFullYear(),
      ...(custosQ.data ?? []).map((c) => Number(c.competencia.slice(0, 4))),
    ]),
  ].sort((a, b) => b - a);

  async function excluir(c: Custo) {
    if (
      !confirm(`Excluir ${CATEGORIAS[c.categoria]} de ${brl(c.valor)} (${fmtComp(c.competencia)})?`)
    )
      return;
    const { error } = await rdb.from("rh_custos").delete().eq("id", c.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    void invalidate();
  }

  return (
    <RhGate ver={ctx.ver} loading={ctx.loading || custosQ.isLoading} erro={custosQ.error}>
      <div className="mx-auto max-w-[1400px]">
        <PageHeader
          eyebrow={eyebrow(ctx.ws)}
          title="Custos anuais de pessoal"
          description="Gasto mensal e anual por categoria, orçamento e realizado."
          actions={
            <>
              <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {anos.map((a) => (
                    <SelectItem key={a} value={String(a)}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="outline"
                disabled={!doAno.length}
                onClick={() =>
                  baixarCsv(
                    `custos_pessoal_${ano}.csv`,
                    ["Empresa", "Competência", "Categoria", "Valor", "Descrição"],
                    doAno.map((c) => [
                      nomeEmpresa(c.empresa),
                      c.competencia.slice(0, 7),
                      CATEGORIAS[c.categoria],
                      c.valor.toFixed(2).replace(".", ","),
                      c.descricao,
                    ]),
                  )
                }
              >
                <Download className="mr-1.5 h-4 w-4" />
                CSV
              </Button>
              {ctx.edita() && (
                <Button size="sm" variant="outline" onClick={() => setOrcando(true)}>
                  Orçamento
                </Button>
              )}
              {ctx.edita() && (
                <Button
                  size="sm"
                  onClick={() =>
                    setNovo({
                      empresa: ctx.editaveis[0],
                      competencia: mesISO(),
                      categoria: "folha",
                    })
                  }
                >
                  <Plus className="mr-1.5 h-4 w-4" />
                  Lançar despesa
                </Button>
              )}
            </>
          }
        />
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi
            label="Custo acumulado"
            value={brl0(total)}
            sub={`${mesesComDado} ${mesesComDado === 1 ? "mês lançado" : "meses lançados"} em ${ano}`}
          />
          <Kpi
            label="Orçamento anual"
            value={orcamento ? brl0(orcamento) : "—"}
            sub={orcamento ? undefined : "Defina em Orçamento"}
          />
          <Kpi
            label="Saldo orçamentário"
            value={orcamento ? brl0(orcamento - total) : "—"}
            tone={orcamento ? (orcamento - total < 0 ? "bad" : "good") : undefined}
            sub={orcamento ? `${Math.round((total / orcamento) * 100)}% consumido` : undefined}
          />
          <Kpi label="VR / VA e benefícios" value={brl0(vrva)} sub="Acumulado no ano" />
        </div>

        <Card
          title={`Realizado por categoria · ${ano}`}
          sub="Soma dos lançamentos por competência."
          className="mb-6"
        >
          {matriz.length ? (
            <div className="-mx-5 overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-muted-foreground">
                  <tr className="border-b">
                    <th className="px-5 py-2 text-left font-medium">Categoria</th>
                    {MESES.map((m) => (
                      <th key={m} className="px-2 py-2 text-right font-medium">
                        {m}
                      </th>
                    ))}
                    <th className="px-5 py-2 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {matriz.map((l) => (
                    <tr key={l.cat}>
                      <td className="whitespace-nowrap px-5 py-2 font-medium">
                        {CATEGORIAS[l.cat]}
                      </td>
                      {l.meses.map((v, i) => (
                        <td key={i} className="px-2 py-2 text-right tabular-nums">
                          {v ? (
                            brl0(v).replace("R$", "").trim()
                          ) : (
                            <span className="text-muted-foreground/50">—</span>
                          )}
                        </td>
                      ))}
                      <td className="px-5 py-2 text-right font-semibold tabular-nums">
                        {brl0(l.total)}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-muted/30 font-semibold">
                    <td className="px-5 py-2">Total</td>
                    {totMes.map((v, i) => (
                      <td key={i} className="px-2 py-2 text-right tabular-nums">
                        {v ? brl0(v).replace("R$", "").trim() : ""}
                      </td>
                    ))}
                    <td className="px-5 py-2 text-right tabular-nums">{brl0(total)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhuma despesa lançada em {ano}.
            </p>
          )}
        </Card>

        <h2 className="mb-3 text-sm font-semibold">Lançamentos</h2>
        <Tabela
          colSpan={6}
          vazio={!doAno.length && "Sem lançamentos no ano."}
          cab={
            <tr>
              <th>Competência</th>
              {ctx.grupo && <th>Empresa</th>}
              <th>Categoria</th>
              <th>Descrição</th>
              <th className="text-right">Valor</th>
              <th className="w-12" />
            </tr>
          }
        >
          {doAno.map((c) => (
            <tr key={c.id}>
              <td className="tabular-nums">{fmtComp(c.competencia)}</td>
              {ctx.grupo && (
                <td>
                  <EmpresaTag id={c.empresa} />
                </td>
              )}
              <td>{CATEGORIAS[c.categoria]}</td>
              <td className="text-muted-foreground">{c.descricao || "—"}</td>
              <td className="text-right tabular-nums">{brl(c.valor)}</td>
              <td className="text-right">
                {ctx.edita(c.empresa) && (
                  <button
                    type="button"
                    className="p-1 text-muted-foreground hover:text-destructive"
                    aria-label="Excluir"
                    onClick={() => void excluir(c)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </Tabela>
        <Nota>
          Separe encargos da folha (INSS patronal, FGTS, RAT/FAP, terceiros) de tributos sobre
          faturamento. Concilie com o Financeiro e a Contabilidade antes de fechar o ano.
        </Nota>
        {novo && (
          <CustoDialog value={novo} empresas={ctx.editaveis} onClose={() => setNovo(null)} />
        )}
        {orcando && (
          <OrcamentoDialog
            ano={ano}
            empresas={ctx.editaveis}
            atual={(e) =>
              Number((orcQ.data ?? []).find((o) => o.empresa === e && o.ano === ano)?.valor ?? 0)
            }
            onClose={() => setOrcando(false)}
          />
        )}
      </div>
    </RhGate>
  );
}

function CustoDialog({
  value,
  empresas,
  onClose,
}: {
  value: Partial<Custo>;
  empresas: CompanyId[];
  onClose: () => void;
}) {
  const invalidate = useInvalidateRh();
  const [f, setF] = useState<Partial<Custo>>(value);
  async function salvar() {
    if (!f.empresa || !f.competencia || !f.categoria || !f.valor) {
      toast.error("Preencha empresa, competência, categoria e valor.");
      return;
    }
    const { error } = await rdb.from("rh_custos").insert({
      empresa: f.empresa,
      competencia: f.competencia,
      categoria: f.categoria,
      valor: f.valor,
      descricao: f.descricao || null,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Despesa lançada.");
    void invalidate();
    onClose();
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Lançar despesa de pessoal</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          {empresas.length > 1 && (
            <Field label="Empresa" full>
              <EmpresaSelect
                value={f.empresa}
                onChange={(e) => setF({ ...f, empresa: e })}
                empresas={empresas}
              />
            </Field>
          )}
          <Field label="Competência">
            <Input
              type="month"
              value={f.competencia?.slice(0, 7) ?? ""}
              onChange={(e) =>
                setF({ ...f, competencia: e.target.value ? e.target.value + "-01" : undefined })
              }
            />
          </Field>
          <Field label="Categoria">
            <Select
              value={f.categoria}
              onValueChange={(v) => setF({ ...f, categoria: v as CategoriaCusto })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CATEGORIAS).map(([k, l]) => (
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
          <Field label="Descrição">
            <Input
              value={f.descricao ?? ""}
              onChange={(e) => setF({ ...f, descricao: e.target.value })}
              placeholder="Ex.: folha de março"
            />
          </Field>
        </div>
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

function OrcamentoDialog({
  ano,
  empresas,
  atual,
  onClose,
}: {
  ano: number;
  empresas: CompanyId[];
  atual: (e: CompanyId) => number;
  onClose: () => void;
}) {
  const invalidate = useInvalidateRh();
  const [v, setV] = useState<Record<string, number>>(() =>
    Object.fromEntries(empresas.map((e) => [e, atual(e)])),
  );
  async function salvar() {
    const { error } = await rdb
      .from("rh_orcamentos")
      .upsert(empresas.map((e) => ({ empresa: e, ano, valor: v[e] ?? 0 })));
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Orçamento salvo.");
    void invalidate();
    onClose();
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Orçamento de pessoal · {ano}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {empresas.map((e) => (
            <Field key={e} label={nomeEmpresa(e)}>
              <NumInput value={v[e]} onChange={(n) => setV({ ...v, [e]: n })} />
            </Field>
          ))}
        </div>
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
