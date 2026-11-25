import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Download, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  EmpresaSelect,
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
  baixarCsv,
  brl,
  brl0,
  diasAte,
  fmtData,
  nomeEmpresa,
  rdb,
  useContratosPj,
  useInvalidateRh,
  useRhCtx,
  type ContratoPj,
} from "@/os/rh/data";
import type { CompanyId } from "@/os/companies";

export const Route = createFileRoute("/_authenticated/rh/pj")({
  head: () => ({ meta: [{ title: "Contratos PJ · RH — render.os" }] }),
  component: PjPage,
});

const STATUS: Record<ContratoPj["status"], string> = {
  ativo: "Ativo",
  renovar: "Renovar",
  encerrado: "Encerrado",
};

function situacao(c: ContratoPj): { l: string; tone: "good" | "warn" | "bad" | "neutral" } {
  if (c.status === "encerrado") return { l: "Encerrado", tone: "neutral" };
  if (!c.fim)
    return {
      l: c.status === "renovar" ? "Renovar" : "Sem prazo",
      tone: c.status === "renovar" ? "warn" : "good",
    };
  const d = diasAte(c.fim);
  if (d < 0) return { l: `Venceu há ${-d} dia(s)`, tone: "bad" };
  if (d <= 30) return { l: `Vence em ${d} dia(s)`, tone: "bad" };
  if (d <= 90 || c.status === "renovar")
    return {
      l: c.status === "renovar" ? `Renovar · ${d} dias` : `Vence em ${d} dias`,
      tone: "warn",
    };
  return { l: "Ativo", tone: "good" };
}

function PjPage() {
  const ctx = useRhCtx("rh.pj");
  const q = useContratosPj(ctx.empresas);
  const invalidate = useInvalidateRh();
  const [mostrarEncerrados, setMostrarEncerrados] = useState(false);
  const [editando, setEditando] = useState<Partial<ContratoPj> | null>(null);
  const todos = q.data ?? [];
  const vigentes = todos.filter((c) => c.status !== "encerrado");
  const lista = mostrarEncerrados ? todos : vigentes;
  const mensal = vigentes.reduce((a, c) => a + c.valor_mensal, 0);
  const vence30 = vigentes.filter((c) => c.fim && diasAte(c.fim) <= 30).length;

  async function excluir(c: ContratoPj) {
    if (
      !confirm(
        `Excluir o contrato de ${c.prestador}? Para contratos que acabaram, prefira marcar como encerrado.`,
      )
    )
      return;
    const { error } = await rdb.from("rh_contratos_pj").delete().eq("id", c.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    void invalidate();
  }

  return (
    <RhGate ver={ctx.ver} loading={ctx.loading || q.isLoading} erro={q.error}>
      <div className="mx-auto max-w-[1400px]">
        <PageHeader
          eyebrow={eyebrow(ctx.ws)}
          title="Contratos PJ"
          description="Vigência, valores, reajustes e renovação."
          actions={
            <>
              <Button
                size="sm"
                variant="outline"
                disabled={!todos.length}
                onClick={() =>
                  baixarCsv(
                    "contratos_pj.csv",
                    [
                      "Empresa",
                      "Prestador",
                      "CNPJ",
                      "Serviço",
                      "Gestor",
                      "Início",
                      "Fim",
                      "Valor mensal",
                      "Reajuste",
                      "Aviso (dias)",
                      "Status",
                    ],
                    todos.map((c) => [
                      nomeEmpresa(c.empresa),
                      c.prestador,
                      c.cnpj,
                      c.servico,
                      c.gestor,
                      fmtData(c.inicio),
                      fmtData(c.fim),
                      c.valor_mensal.toFixed(2).replace(".", ","),
                      c.reajuste,
                      c.aviso_dias,
                      STATUS[c.status],
                    ]),
                  )
                }
              >
                <Download className="mr-1.5 h-4 w-4" />
                CSV
              </Button>
              {ctx.edita() && (
                <Button
                  size="sm"
                  onClick={() => setEditando({ empresa: ctx.editaveis[0], status: "ativo" })}
                >
                  <Plus className="mr-1.5 h-4 w-4" />
                  Novo contrato
                </Button>
              )}
            </>
          }
        />
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label="Contratos ativos" value={vigentes.length} />
          <Kpi label="Vencem em 30 dias" value={vence30} tone={vence30 ? "bad" : undefined} />
          <Kpi label="Valor mensal contratado" value={brl0(mensal)} />
          <Kpi label="Valor anual projetado" value={brl0(mensal * 12)} />
        </div>
        <label className="mb-3 flex w-fit items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={mostrarEncerrados}
            onChange={(e) => setMostrarEncerrados(e.target.checked)}
          />
          Mostrar encerrados
        </label>
        <Tabela
          colSpan={9}
          vazio={!lista.length && "Nenhum contrato cadastrado."}
          cab={
            <tr>
              <th>Prestador</th>
              {ctx.grupo && <th>Empresa</th>}
              <th>Serviço</th>
              <th>Início</th>
              <th>Vencimento</th>
              <th className="text-right">Valor mensal</th>
              <th>Reajuste</th>
              <th>Situação</th>
              <th className="w-20" />
            </tr>
          }
        >
          {lista.map((c) => {
            const s = situacao(c);
            return (
              <tr key={c.id} className="align-top">
                <td>
                  <div className="font-medium">{c.prestador}</div>
                  <div className="text-xs text-muted-foreground">
                    {[c.cnpj, c.gestor && `gestor ${c.gestor}`].filter(Boolean).join(" · ")}
                  </div>
                </td>
                {ctx.grupo && (
                  <td>
                    <EmpresaTag id={c.empresa} />
                  </td>
                )}
                <td>{c.servico || "—"}</td>
                <td className="tabular-nums">{fmtData(c.inicio)}</td>
                <td className="tabular-nums">
                  {fmtData(c.fim)}
                  {c.aviso_dias ? (
                    <div className="text-xs text-muted-foreground">aviso {c.aviso_dias} dias</div>
                  ) : null}
                </td>
                <td className="text-right tabular-nums">{brl(c.valor_mensal)}</td>
                <td className="text-xs">{c.reajuste || "—"}</td>
                <td>
                  <Pill tone={s.tone}>{s.l}</Pill>
                </td>
                <td className="whitespace-nowrap text-right">
                  {ctx.edita(c.empresa) && (
                    <>
                      <button
                        type="button"
                        className="p-1 text-muted-foreground hover:text-foreground"
                        aria-label="Editar"
                        onClick={() => setEditando(c)}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="p-1 text-muted-foreground hover:text-destructive"
                        aria-label="Excluir"
                        onClick={() => void excluir(c)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </td>
              </tr>
            );
          })}
        </Tabela>
        <Nota>
          Alertas aos 90, 60 e 30 dias do vencimento. Registre escopo, gestor, índice e data-base de
          reajuste e aviso prévio. Valide juridicamente a classificação do vínculo (risco de
          subordinação).
        </Nota>
        {editando && (
          <PjDialog value={editando} empresas={ctx.editaveis} onClose={() => setEditando(null)} />
        )}
      </div>
    </RhGate>
  );
}

function PjDialog({
  value,
  empresas,
  onClose,
}: {
  value: Partial<ContratoPj>;
  empresas: CompanyId[];
  onClose: () => void;
}) {
  const invalidate = useInvalidateRh();
  const [f, setF] = useState<Partial<ContratoPj>>(value);
  const txt =
    (k: keyof ContratoPj) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setF({ ...f, [k]: e.target.value || null });
  async function salvar() {
    if (!f.empresa || !f.prestador?.trim()) {
      toast.error("Informe empresa e prestador.");
      return;
    }
    const row = {
      empresa: f.empresa,
      prestador: f.prestador.trim(),
      cnpj: f.cnpj ?? null,
      servico: f.servico ?? null,
      gestor: f.gestor ?? null,
      inicio: f.inicio ?? null,
      fim: f.fim ?? null,
      valor_mensal: f.valor_mensal ?? 0,
      reajuste: f.reajuste ?? null,
      aviso_dias: f.aviso_dias || null,
      status: f.status ?? "ativo",
      obs: f.obs ?? null,
    };
    const { error } = value.id
      ? await rdb.from("rh_contratos_pj").update(row).eq("id", value.id)
      : await rdb.from("rh_contratos_pj").insert(row);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Contrato salvo.");
    void invalidate();
    onClose();
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{value.id ? value.prestador : "Novo contrato PJ"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          {empresas.length > 1 && !value.id && (
            <Field label="Empresa contratante" full>
              <EmpresaSelect
                value={f.empresa}
                onChange={(e) => setF({ ...f, empresa: e })}
                empresas={empresas}
              />
            </Field>
          )}
          <Field label="Prestador / razão social">
            <Input value={f.prestador ?? ""} onChange={txt("prestador")} />
          </Field>
          <Field label="CNPJ">
            <Input value={f.cnpj ?? ""} onChange={txt("cnpj")} />
          </Field>
          <Field label="Serviço / escopo">
            <Input value={f.servico ?? ""} onChange={txt("servico")} />
          </Field>
          <Field label="Gestor do contrato">
            <Input value={f.gestor ?? ""} onChange={txt("gestor")} />
          </Field>
          <Field label="Início">
            <Input type="date" value={f.inicio ?? ""} onChange={txt("inicio")} />
          </Field>
          <Field label="Vencimento">
            <Input type="date" value={f.fim ?? ""} onChange={txt("fim")} />
          </Field>
          <Field label="Valor mensal (R$)">
            <NumInput value={f.valor_mensal} onChange={(v) => setF({ ...f, valor_mensal: v })} />
          </Field>
          <Field label="Reajuste">
            <Input
              value={f.reajuste ?? ""}
              onChange={txt("reajuste")}
              placeholder="IPCA anual, negociado…"
            />
          </Field>
          <Field label="Aviso prévio (dias)">
            <NumInput
              step="1"
              value={f.aviso_dias}
              onChange={(v) => setF({ ...f, aviso_dias: v })}
            />
          </Field>
          <Field label="Status">
            <Select
              value={f.status}
              onValueChange={(v) => setF({ ...f, status: v as ContratoPj["status"] })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS).map(([k, l]) => (
                  <SelectItem key={k} value={k}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Observações (pagamento, aditivos…)" full>
            <Textarea rows={2} value={f.obs ?? ""} onChange={txt("obs")} />
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
