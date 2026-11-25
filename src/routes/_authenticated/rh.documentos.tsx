import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Pencil, Plus, Trash2 } from "lucide-react";
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
  ColabSelect,
  EmpresaSelect,
  EmpresaTag,
  Field,
  Kpi,
  Nota,
  Pill,
  RhGate,
  Tabela,
  eyebrow,
} from "@/components/rh/ui";
import {
  TIPOS_DOC,
  diasAte,
  fmtData,
  rdb,
  useColaboradores,
  useDocumentos,
  useInvalidateRh,
  useRhCtx,
  type Colaborador,
  type Documento,
} from "@/os/rh/data";
import type { CompanyId } from "@/os/companies";

export const Route = createFileRoute("/_authenticated/rh/documentos")({
  head: () => ({ meta: [{ title: "Documentos e prazos · RH — render.os" }] }),
  component: DocumentosPage,
});

const STATUS: Record<Documento["status"], string> = {
  pendente: "Pendente",
  em_dia: "Em dia",
  concluido: "Concluído",
};
const ALERTAS = [
  ["Vencimento de contrato", "90 / 60 / 30 dias"],
  ["Vencimento de ASO", "60 / 30 / 7 dias"],
  ["Fim de experiência", "15 / 7 dias"],
  ["Férias a programar", "Por período concessivo"],
  ["Treinamentos a renovar", "Conforme matriz"],
];

function situacao(d: Documento): {
  l: string;
  tone: "good" | "warn" | "bad" | "neutral";
  ordem: number;
} {
  if (d.status === "concluido") return { l: "Concluído", tone: "neutral", ordem: 9 };
  if (!d.vencimento)
    return { l: STATUS[d.status], tone: d.status === "pendente" ? "warn" : "good", ordem: 5 };
  const n = diasAte(d.vencimento);
  if (n < 0) return { l: `Vencido há ${-n} dia(s)`, tone: "bad", ordem: 0 };
  if (n <= 7) return { l: `Vence em ${n} dia(s)`, tone: "bad", ordem: 1 };
  if (n <= 30) return { l: `Vence em ${n} dias`, tone: "warn", ordem: 2 };
  return {
    l: d.status === "pendente" ? "Pendente" : "Em dia",
    tone: d.status === "pendente" ? "warn" : "good",
    ordem: 4,
  };
}

function DocumentosPage() {
  const ctx = useRhCtx("rh.documentos");
  const q = useDocumentos(ctx.empresas);
  const colabs = useColaboradores(ctx.empresas);
  const invalidate = useInvalidateRh();
  const [tipo, setTipo] = useState("todos");
  const [verConcluidos, setVerConcluidos] = useState(false);
  const [editando, setEditando] = useState<Partial<Documento> | null>(null);
  const docs = q.data ?? [];
  const porId = new Map((colabs.data ?? []).map((c) => [c.id, c]));
  const lista = docs
    .filter(
      (d) => (tipo === "todos" || d.tipo === tipo) && (verConcluidos || d.status !== "concluido"),
    )
    .map((d) => ({ d, s: situacao(d) }))
    .sort(
      (a, b) =>
        a.s.ordem - b.s.ordem || (a.d.vencimento ?? "9").localeCompare(b.d.vencimento ?? "9"),
    );
  const abertos = docs.filter((d) => d.status !== "concluido");
  const vencidos = abertos.filter((d) => d.vencimento && diasAte(d.vencimento) < 0).length;
  const em30 = abertos.filter(
    (d) => d.vencimento && diasAte(d.vencimento) >= 0 && diasAte(d.vencimento) <= 30,
  ).length;
  const porTipo = TIPOS_DOC.map((t) => ({ t, n: abertos.filter((d) => d.tipo === t).length }));

  async function concluir(d: Documento) {
    const { error } = await rdb
      .from("rh_documentos")
      .update({ status: "concluido" })
      .eq("id", d.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    void invalidate();
  }
  async function excluir(d: Documento) {
    if (!confirm(`Excluir o controle "${d.descricao || d.tipo}"?`)) return;
    const { error } = await rdb.from("rh_documentos").delete().eq("id", d.id);
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
          title="Documentos e prazos"
          description="Central de vencimentos, obrigações, treinamentos e documentos."
          actions={
            ctx.edita() && (
              <Button
                size="sm"
                onClick={() =>
                  setEditando({ empresa: ctx.editaveis[0], tipo: TIPOS_DOC[0], status: "pendente" })
                }
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Adicionar controle
              </Button>
            )
          }
        />
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label="Em aberto" value={abertos.length} />
          <Kpi label="Vencidos" value={vencidos} tone={vencidos ? "bad" : undefined} />
          <Kpi label="Vencem em 30 dias" value={em30} tone={em30 ? "warn" : undefined} />
          <Kpi label="Concluídos" value={docs.length - abertos.length} />
        </div>
        <div className="mb-6 grid gap-6 lg:grid-cols-2">
          <Card title="Tipos de controle" sub="Itens em aberto por tipo. Clique para filtrar.">
            <ul className="grid grid-cols-2 gap-2">
              {porTipo.map(({ t, n }) => (
                <li key={t}>
                  <button
                    type="button"
                    onClick={() => setTipo(tipo === t ? "todos" : t)}
                    className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-xs ${tipo === t ? "border-brand-blue bg-brand-blue/5" : "hover:bg-muted/40"}`}
                  >
                    <span>{t}</span>
                    <span className="font-semibold tabular-nums">{n}</span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
          <Card title="Alertas sugeridos" sub="Antecedência recomendada para cada tipo de prazo.">
            <dl className="divide-y text-sm">
              {ALERTAS.map(([l, v]) => (
                <div key={l} className="flex justify-between py-2">
                  <dt className="text-muted-foreground">{l}</dt>
                  <dd className="font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>
        <div className="mb-3 flex items-center gap-3">
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os tipos</SelectItem>
              {TIPOS_DOC.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={verConcluidos}
              onChange={(e) => setVerConcluidos(e.target.checked)}
            />
            Mostrar concluídos
          </label>
        </div>
        <Tabela
          colSpan={8}
          vazio={!lista.length && "Nada neste filtro."}
          cab={
            <tr>
              <th>Controle</th>
              {ctx.grupo && <th>Empresa</th>}
              <th>Colaborador</th>
              <th>Vencimento</th>
              <th>Responsável</th>
              <th>Situação</th>
              <th className="w-28" />
            </tr>
          }
        >
          {lista.map(({ d, s }) => (
            <tr key={d.id} className="align-top">
              <td>
                <div className="font-medium">{d.descricao || d.tipo}</div>
                {d.descricao && <div className="text-xs text-muted-foreground">{d.tipo}</div>}
              </td>
              {ctx.grupo && (
                <td>
                  <EmpresaTag id={d.empresa} />
                </td>
              )}
              <td>{d.colaborador_id ? (porId.get(d.colaborador_id)?.nome ?? "—") : "—"}</td>
              <td className="tabular-nums">{fmtData(d.vencimento)}</td>
              <td>{d.responsavel || "—"}</td>
              <td>
                <Pill tone={s.tone}>{s.l}</Pill>
              </td>
              <td className="whitespace-nowrap text-right">
                {ctx.edita(d.empresa) && (
                  <>
                    {d.status !== "concluido" && (
                      <button
                        type="button"
                        className="p-1 text-muted-foreground hover:text-emerald-700"
                        aria-label="Concluir"
                        title="Marcar como concluído"
                        onClick={() => void concluir(d)}
                      >
                        <Check className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      className="p-1 text-muted-foreground hover:text-foreground"
                      aria-label="Editar"
                      onClick={() => setEditando(d)}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className="p-1 text-muted-foreground hover:text-destructive"
                      aria-label="Excluir"
                      onClick={() => void excluir(d)}
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
          Contratos CLT e PJ, ASO/PCMSO/PGR, férias, experiência, treinamentos e termos de ciência.
          Os arquivos continuam no repositório da empresa; aqui fica o controle do prazo.
        </Nota>
        {editando && (
          <DocDialog
            value={editando}
            empresas={ctx.editaveis}
            colabs={(colabs.data ?? []).filter((c) => c.status !== "desligado")}
            onClose={() => setEditando(null)}
          />
        )}
      </div>
    </RhGate>
  );
}

function DocDialog({
  value,
  empresas,
  colabs,
  onClose,
}: {
  value: Partial<Documento>;
  empresas: CompanyId[];
  colabs: Colaborador[];
  onClose: () => void;
}) {
  const invalidate = useInvalidateRh();
  const [f, setF] = useState<Partial<Documento>>(value);
  const daEmpresa = colabs.filter((c) => c.empresa === f.empresa);
  async function salvar() {
    if (!f.empresa || !f.tipo) {
      toast.error("Informe empresa e tipo.");
      return;
    }
    const row = {
      empresa: f.empresa,
      tipo: f.tipo,
      descricao: f.descricao || null,
      colaborador_id: f.colaborador_id || null,
      vencimento: f.vencimento || null,
      responsavel: f.responsavel || null,
      status: f.status ?? "pendente",
      obs: f.obs || null,
    };
    const { error } = value.id
      ? await rdb.from("rh_documentos").update(row).eq("id", value.id)
      : await rdb.from("rh_documentos").insert(row);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Controle salvo.");
    void invalidate();
    onClose();
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{value.id ? "Editar controle" : "Adicionar controle"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          {empresas.length > 1 && !value.id && (
            <Field label="Empresa" full>
              <EmpresaSelect
                value={f.empresa}
                onChange={(e) => setF({ ...f, empresa: e, colaborador_id: null })}
                empresas={empresas}
              />
            </Field>
          )}
          <Field label="Tipo">
            <Select value={f.tipo} onValueChange={(v) => setF({ ...f, tipo: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_DOC.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Colaborador (opcional)">
            <div className="flex gap-1">
              <ColabSelect
                value={f.colaborador_id}
                onChange={(id) => setF({ ...f, colaborador_id: id })}
                colabs={daEmpresa}
                placeholder="Nenhum"
              />
              {f.colaborador_id && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setF({ ...f, colaborador_id: null })}
                >
                  ×
                </Button>
              )}
            </div>
          </Field>
          <Field label="Descrição" full>
            <Input
              value={f.descricao ?? ""}
              onChange={(e) => setF({ ...f, descricao: e.target.value })}
              placeholder="Ex.: renovar NR-35, termo de LGPD…"
            />
          </Field>
          <Field label="Vencimento">
            <Input
              type="date"
              value={f.vencimento ?? ""}
              onChange={(e) => setF({ ...f, vencimento: e.target.value || null })}
            />
          </Field>
          <Field label="Responsável">
            <Input
              value={f.responsavel ?? ""}
              onChange={(e) => setF({ ...f, responsavel: e.target.value })}
            />
          </Field>
          <Field label="Status">
            <Select
              value={f.status}
              onValueChange={(v) => setF({ ...f, status: v as Documento["status"] })}
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
