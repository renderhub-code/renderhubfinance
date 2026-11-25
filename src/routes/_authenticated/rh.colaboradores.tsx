import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Download, Pencil, Plus, Search, Trash2 } from "lucide-react";
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
  VINCULOS,
  baixarCsv,
  brl,
  fmtData,
  hojeISO,
  mesISO,
  rdb,
  salarioEm,
  useColaboradores,
  useInvalidateRh,
  useRemuneracao,
  useRhCtx,
  type Colaborador,
  type StatusColab,
} from "@/os/rh/data";
import type { CompanyId } from "@/os/companies";

export const Route = createFileRoute("/_authenticated/rh/colaboradores")({
  head: () => ({ meta: [{ title: "Colaboradores · RH — render.os" }] }),
  component: Colaboradores,
});

const STATUS: Record<StatusColab, { label: string; tone: "good" | "warn" | "neutral" }> = {
  ativo: { label: "Ativo", tone: "good" },
  afastado: { label: "Afastado", tone: "warn" },
  desligado: { label: "Desligado", tone: "neutral" },
};

function Colaboradores() {
  const ctx = useRhCtx("rh.colaboradores");
  const rem = useRhCtx("rh.remuneracao");
  const colabs = useColaboradores(ctx.empresas);
  const lista = colabs.data ?? [];
  const veSalario = rem.ver;
  const { data: rems = [] } = useRemuneracao(lista, veSalario && lista.length > 0);
  const invalidate = useInvalidateRh();
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState<"todos" | StatusColab>("ativo");
  const [editando, setEditando] = useState<Partial<Colaborador> | null>(null);

  const filtrados = useMemo(() => {
    const b = busca.trim().toLowerCase();
    return lista.filter(
      (c) =>
        (status === "todos" || c.status === status) &&
        (!b ||
          [c.nome, c.matricula, c.setor, c.cargo, c.gestor].some((v) =>
            v?.toLowerCase().includes(b),
          )),
    );
  }, [lista, busca, status]);

  async function excluir(c: Colaborador) {
    if (
      !confirm(
        `Excluir o cadastro de ${c.nome}? Salários, avaliações, ASOs e documentos dele também saem. Para quem saiu da empresa, prefira marcar como desligado. Não dá para desfazer.`,
      )
    )
      return;
    const { error } = await rdb.from("rh_colaboradores").delete().eq("id", c.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Cadastro excluído.");
    void invalidate();
  }

  function exportar() {
    baixarCsv(
      "colaboradores.csv",
      [
        "Empresa",
        "Nome",
        "Matrícula",
        "E-mail",
        "Setor",
        "Cargo",
        "Vínculo",
        "Admissão",
        "Desligamento",
        "Jornada",
        "Gestor",
        "Status",
        ...(veSalario ? ["Salário vigente"] : []),
      ],
      filtrados.map((c) => [
        c.empresa,
        c.nome,
        c.matricula,
        c.email,
        c.setor,
        c.cargo,
        c.vinculo,
        fmtData(c.admissao),
        fmtData(c.desligamento),
        c.jornada,
        c.gestor,
        STATUS[c.status].label,
        ...(veSalario ? [salarioEm(rems, c.id).toFixed(2).replace(".", ",")] : []),
      ]),
    );
  }

  const ativos = lista.filter((c) => c.status === "ativo").length;
  const afastados = lista.filter((c) => c.status === "afastado").length;
  const mes = mesISO();
  const admMes = lista.filter((c) => c.admissao && c.admissao >= mes).length;
  const deslMes = lista.filter((c) => c.desligamento && c.desligamento >= mes).length;

  return (
    <RhGate ver={ctx.ver} loading={ctx.loading || colabs.isLoading} erro={colabs.error}>
      <div className="mx-auto max-w-[1400px]">
        <PageHeader
          eyebrow={eyebrow(ctx.ws)}
          title="Colaboradores"
          description="Cadastro único de vínculos, lotação, jornada e status. Folha, benefícios, ASO e avaliações partem daqui."
          actions={
            <>
              <Button size="sm" variant="outline" onClick={exportar}>
                <Download className="mr-1.5 h-4 w-4" />
                CSV
              </Button>
              {ctx.edita() && (
                <Button
                  size="sm"
                  onClick={() =>
                    setEditando({ empresa: ctx.editaveis[0], vinculo: "CLT", status: "ativo" })
                  }
                >
                  <Plus className="mr-1.5 h-4 w-4" />
                  Cadastrar colaborador
                </Button>
              )}
            </>
          }
        />
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label="Ativos" value={ativos} />
          <Kpi label="Afastados" value={afastados} tone={afastados ? "warn" : undefined} />
          <Kpi label="Admissões no mês" value={admMes} />
          <Kpi label="Desligamentos no mês" value={deslMes} />
        </div>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Buscar nome, setor, cargo, gestor"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
          <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ativo">Ativos</SelectItem>
              <SelectItem value="afastado">Afastados</SelectItem>
              <SelectItem value="desligado">Desligados</SelectItem>
              <SelectItem value="todos">Todos</SelectItem>
            </SelectContent>
          </Select>
          <span className="ml-auto text-xs text-muted-foreground">
            {filtrados.length} de {lista.length}
          </span>
        </div>
        <Tabela
          colSpan={9}
          vazio={
            !filtrados.length &&
            (lista.length ? "Ninguém neste filtro." : "Nenhum colaborador cadastrado ainda.")
          }
          cab={
            <tr>
              <th>Colaborador</th>
              {ctx.grupo && <th>Empresa</th>}
              <th>Setor / cargo</th>
              <th>Vínculo</th>
              <th>Admissão</th>
              <th>Jornada</th>
              {veSalario && <th className="text-right">Salário</th>}
              <th>Status</th>
              <th className="w-20" />
            </tr>
          }
        >
          {filtrados.map((c) => (
            <tr key={c.id} className="align-top">
              <td>
                <div className="font-medium">{c.nome}</div>
                <div className="text-xs text-muted-foreground">
                  {c.matricula ? `Matrícula ${c.matricula}` : (c.email ?? "")}
                </div>
              </td>
              {ctx.grupo && (
                <td>
                  <EmpresaTag id={c.empresa} />
                </td>
              )}
              <td>
                <div>{c.setor || "—"}</div>
                <div className="text-xs text-muted-foreground">{c.cargo}</div>
              </td>
              <td>{c.vinculo}</td>
              <td className="tabular-nums">
                {fmtData(c.admissao)}
                {c.desligamento && (
                  <div className="text-xs text-muted-foreground">
                    saiu {fmtData(c.desligamento)}
                  </div>
                )}
              </td>
              <td className="text-xs">{c.jornada || "—"}</td>
              {veSalario && (
                <td className="text-right tabular-nums">
                  {salarioEm(rems, c.id) ? (
                    brl(salarioEm(rems, c.id))
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
              )}
              <td>
                <Pill tone={STATUS[c.status].tone}>{STATUS[c.status].label}</Pill>
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
          ))}
        </Tabela>
        <Nota>
          Cadastro mestre como origem única para folha estimada, benefícios, indicadores, ASO,
          avaliações e documentos. Para quem saiu, marque como desligado com a data: o turnover usa
          essa informação.
        </Nota>
        {editando && (
          <ColabDialog
            value={editando}
            empresas={ctx.editaveis}
            podeSalario={rem.edita(editando.empresa)}
            onClose={() => setEditando(null)}
          />
        )}
      </div>
    </RhGate>
  );
}

function ColabDialog({
  value,
  empresas,
  podeSalario,
  onClose,
}: {
  value: Partial<Colaborador>;
  empresas: CompanyId[];
  podeSalario: boolean;
  onClose: () => void;
}) {
  const invalidate = useInvalidateRh();
  const [f, setF] = useState<Partial<Colaborador>>(value);
  const [salario, setSalario] = useState(0);
  const [salvando, setSalvando] = useState(false);
  const novo = !value.id;
  const txt =
    (k: keyof Colaborador) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setF({ ...f, [k]: e.target.value || null });

  async function salvar() {
    if (!f.empresa || !f.nome?.trim()) {
      toast.error("Informe empresa e nome.");
      return;
    }
    if (f.status === "desligado" && !f.desligamento) {
      toast.error("Informe a data de desligamento.");
      return;
    }
    setSalvando(true);
    const row = {
      empresa: f.empresa,
      nome: f.nome.trim(),
      matricula: f.matricula ?? null,
      email: f.email ?? null,
      setor: f.setor ?? null,
      cargo: f.cargo ?? null,
      vinculo: f.vinculo ?? "CLT",
      admissao: f.admissao ?? null,
      desligamento: f.desligamento ?? null,
      motivo_desligamento: f.motivo_desligamento ?? null,
      jornada: f.jornada ?? null,
      gestor: f.gestor ?? null,
      status: f.status ?? "ativo",
      obs: f.obs ?? null,
    };
    const r = novo
      ? await rdb.from("rh_colaboradores").insert(row).select("id").single()
      : await rdb.from("rh_colaboradores").update(row).eq("id", value.id!).select("id").single();
    if (r.error) {
      setSalvando(false);
      toast.error(r.error.message);
      return;
    }
    if (novo && podeSalario && salario > 0) {
      const comp = (f.admissao ?? hojeISO()).slice(0, 7) + "-01";
      const s = await rdb.from("rh_remuneracao").insert({
        colaborador_id: r.data.id,
        tipo: "salario",
        descricao: "Salário de admissão",
        valor: salario,
        competencia: comp,
      });
      if (s.error) toast.error(`Cadastro salvo, mas o salário não: ${s.error.message}`);
    }
    setSalvando(false);
    toast.success(novo ? "Colaborador cadastrado." : "Cadastro atualizado.");
    void invalidate();
    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{novo ? "Cadastrar colaborador" : f.nome}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          {empresas.length > 1 && novo && (
            <Field label="Empresa" full>
              <EmpresaSelect
                value={f.empresa}
                onChange={(e) => setF({ ...f, empresa: e })}
                empresas={empresas}
              />
            </Field>
          )}
          <Field label="Nome completo" full>
            <Input value={f.nome ?? ""} onChange={txt("nome")} />
          </Field>
          <Field label="Matrícula">
            <Input value={f.matricula ?? ""} onChange={txt("matricula")} />
          </Field>
          <Field label="E-mail">
            <Input type="email" value={f.email ?? ""} onChange={txt("email")} />
          </Field>
          <Field label="Setor">
            <Input value={f.setor ?? ""} onChange={txt("setor")} placeholder="Ex.: Operações" />
          </Field>
          <Field label="Cargo">
            <Input value={f.cargo ?? ""} onChange={txt("cargo")} />
          </Field>
          <Field label="Vínculo">
            <Select value={f.vinculo ?? "CLT"} onValueChange={(v) => setF({ ...f, vinculo: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VINCULOS.map((v) => (
                  <SelectItem key={v} value={v}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Gestor">
            <Input value={f.gestor ?? ""} onChange={txt("gestor")} />
          </Field>
          <Field label="Admissão">
            <Input type="date" value={f.admissao ?? ""} onChange={txt("admissao")} />
          </Field>
          <Field label="Jornada / escala">
            <Input
              value={f.jornada ?? ""}
              onChange={txt("jornada")}
              placeholder="Seg–Sex · 08h–17h"
            />
          </Field>
          {novo && podeSalario && (
            <Field
              label="Salário de admissão (R$)"
              hint="Fica no histórico em Salários e benefícios."
            >
              <NumInput value={salario || null} onChange={setSalario} />
            </Field>
          )}
          <Field label="Status">
            <Select
              value={f.status ?? "ativo"}
              onValueChange={(v) =>
                setF({
                  ...f,
                  status: v as StatusColab,
                  ...(v !== "desligado" ? { desligamento: null, motivo_desligamento: null } : {}),
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS).map(([k, s]) => (
                  <SelectItem key={k} value={k}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {f.status === "desligado" && (
            <>
              <Field label="Data de desligamento">
                <Input type="date" value={f.desligamento ?? ""} onChange={txt("desligamento")} />
              </Field>
              <Field label="Motivo">
                <Input
                  value={f.motivo_desligamento ?? ""}
                  onChange={txt("motivo_desligamento")}
                  placeholder="Pedido, dispensa, fim de contrato…"
                />
              </Field>
            </>
          )}
          <Field label="Observações" full>
            <Textarea rows={2} value={f.obs ?? ""} onChange={txt("obs")} />
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
