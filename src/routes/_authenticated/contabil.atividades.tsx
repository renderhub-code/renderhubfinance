import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { z } from "zod";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, ListChecks, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader } from "@/components/os/page";
import { ContabilGate, PrioridadePill, StatusPill } from "@/components/contabil/ui";
import { AtividadeDialog } from "@/components/contabil/AtividadeDialog";
import {
  useAtividades, useCategorias, useCiencias, useClientes, useContabilMe, useMembros, useSetores, useInvalidateContabil,
} from "@/os/contabil/hooks";
import { cdb, dataBR, norm, PRIORIDADE_LABEL, STATUS_LABEL, statusEfetivo, type Atividade, type Status } from "@/os/contabil/db";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/contabil/atividades")({
  head: () => ({ meta: [{ title: "Atividades · Contábil — render.os" }] }),
  validateSearch: (s: Record<string, unknown>) =>
    z.object({ status: z.string().optional(), cliente: z.string().optional(), lote: z.string().optional() }).parse(s),
  component: () => <ContabilGate><AtividadesPage /></ContabilGate>,
});

const EMPTY = { busca: "", setor: "", tipo: "", responsavel: "", status: "", prioridade: "", cliente: "", prazoDe: "", prazoAte: "" };

function AtividadesPage() {
  const search = Route.useSearch();
  const { membro, isAdmin } = useContabilMe();
  const invalidate = useInvalidateContabil();
  const { data: atividades = [], isLoading, error } = useAtividades();
  const { data: setores = [] } = useSetores();
  const { data: categorias = [] } = useCategorias();
  const { data: clientes = [] } = useClientes();
  const { data: membros = [] } = useMembros();
  const { data: ciencias } = useCiencias();

  const [f, setF] = useState({ ...EMPTY, status: search.status ?? "", cliente: search.cliente ?? "" });
  const [editing, setEditing] = useState<Atividade | null>(null);
  const [creating, setCreating] = useState(false);
  const [followup, setFollowup] = useState<Atividade | null>(null);

  const nome = useMemo(() => new Map(membros.map((m) => [m.user_id, m.nome || m.email || "—"])), [membros]);
  const setorNome = useMemo(() => new Map(setores.map((s) => [s.id, s.nome])), [setores]);
  const tipoNome = useMemo(() => new Map(categorias.map((c) => [c.id, c.nome])), [categorias]);
  const clienteNome = useMemo(() => new Map(clientes.map((c) => [c.id, c.razao_social])), [clientes]);

  const filtradas = useMemo(() => {
    const q = norm(f.busca);
    return atividades.filter((a) => {
      if (search.lote && a.criado_em < search.lote) return false;
      const eff = statusEfetivo(a.status, a.prazo);
      if (f.setor && a.setor_id !== f.setor) return false;
      if (f.tipo && a.categoria_id !== f.tipo) return false;
      if (f.responsavel && a.responsavel_id !== f.responsavel) return false;
      if (f.status && eff !== f.status) return false;
      if (f.prioridade && String(a.prioridade) !== f.prioridade) return false;
      if (f.cliente && a.cliente_id !== f.cliente) return false;
      const prazo = a.prazo?.slice(0, 10) ?? null;
      if (f.prazoDe && (!prazo || prazo < f.prazoDe)) return false;
      if (f.prazoAte && (!prazo || prazo > f.prazoAte)) return false;
      if (q) {
        const hay = norm([a.atividade, a.follow_up, clienteNome.get(a.cliente_id ?? ""), nome.get(a.responsavel_id)].join(" "));
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [atividades, f, search.lote, clienteNome, nome]);

  const ativos = Object.entries(f).filter(([, v]) => v).length;

  async function excluir(a: Atividade) {
    if (!confirm(`Excluir a atividade?\n\n${a.atividade.slice(0, 140)}`)) return;
    const { error: e } = await cdb.from("contabil_atividades").delete().eq("id", a.id);
    if (e) { toast.error(e.message); return; }
    toast.success("Atividade excluída.");
    invalidate();
  }

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        eyebrow="Contábil"
        title="Atividades"
        description={`${filtradas.length} de ${atividades.length} atividade(s) visíveis para você`}
        actions={<Button onClick={() => setCreating(true)}><Plus className="mr-1.5 h-4 w-4" /> Nova atividade</Button>}
      />

      {search.lote && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-primary/25 bg-primary/5 px-3 py-2 text-sm">
          Mostrando a importação recente.
          <a href="/contabil/atividades" className="ml-auto inline-flex items-center gap-1 text-primary hover:underline"><X className="h-3 w-3" /> limpar</a>
        </div>
      )}
      {error && (
        <p className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          Não foi possível carregar as atividades: {(error as Error).message}
        </p>
      )}

      {/* Filtros */}
      <div className="mb-4 rounded-xl border bg-muted/20 p-3">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-9">
          <div className="relative col-span-2 xl:col-span-2">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="h-9 bg-background pl-8" placeholder="Buscar atividade, empresa, pessoa…" value={f.busca} onChange={(e) => setF({ ...f, busca: e.target.value })} />
          </div>
          <Filtro label="Setor" value={f.setor} onChange={(v) => setF({ ...f, setor: v, tipo: "" })} options={setores.map((s) => [s.id, s.nome])} />
          <Filtro label="Tipo" value={f.tipo} onChange={(v) => setF({ ...f, tipo: v })} options={categorias.filter((c) => !f.setor || c.setor_id === f.setor).map((c) => [c.id, c.nome])} />
          <Filtro label="Responsável" value={f.responsavel} onChange={(v) => setF({ ...f, responsavel: v })} options={membros.map((m) => [m.user_id, m.nome || m.email || ""])} />
          <Filtro label="Status" value={f.status} onChange={(v) => setF({ ...f, status: v })} options={Object.entries(STATUS_LABEL)} />
          <Filtro label="Prioridade" value={f.prioridade} onChange={(v) => setF({ ...f, prioridade: v })} options={[1, 2, 3, 4].map((p) => [String(p), `P${p} · ${PRIORIDADE_LABEL[p]}`])} />
          <Filtro label="Empresa" value={f.cliente} onChange={(v) => setF({ ...f, cliente: v })} options={clientes.map((c) => [c.id, c.razao_social])} />
          <div className="flex items-center gap-1">
            <Input type="date" title="Prazo a partir de" className="h-9 bg-background px-2 text-xs" value={f.prazoDe} onChange={(e) => setF({ ...f, prazoDe: e.target.value })} />
            <Input type="date" title="Prazo até" className="h-9 bg-background px-2 text-xs" value={f.prazoAte} onChange={(e) => setF({ ...f, prazoAte: e.target.value })} />
          </div>
        </div>
        {ativos > 0 && (
          <button type="button" onClick={() => setF(EMPTY)} className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <X className="h-3 w-3" /> Limpar {ativos} filtro(s)
          </button>
        )}
      </div>

      {/* Tabela */}
      <div className="overflow-hidden rounded-xl border">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-sm">
            <thead className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
              <tr>
                {["Atividade", "Empresa", "Setor · Tipo", "Responsável", "Prioridade", "Status", "Prazo", "Ciência", "Atualização", ""].map((h) => (
                  <th key={h} className="px-3 py-2.5 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="ros-stagger divide-y">
              {isLoading && <tr><td colSpan={10} className="py-10 text-center text-muted-foreground">Carregando…</td></tr>}
              {!isLoading && filtradas.length === 0 && (
                <tr><td colSpan={10} className="py-14 text-center">
                  <ListChecks className="mx-auto mb-2 h-6 w-6 text-muted-foreground/60" />
                  <div className="text-sm text-muted-foreground">Nenhuma atividade encontrada.</div>
                </td></tr>
              )}
              {filtradas.map((a) => {
                const eff = statusEfetivo(a.status, a.prazo);
                const ciente = ciencias?.get(`${a.id}:${a.responsavel_id}`);
                const upd = a.ultima_atualizacao ?? a.criado_em;
                return (
                  <tr key={a.id} className="group align-top transition-colors hover:bg-muted/20">
                    <td className="max-w-[340px] px-3 py-3">
                      <button type="button" className="text-left" onClick={() => setEditing(a)}>
                        <span className="line-clamp-2 font-medium leading-snug">{a.atividade}</span>
                      </button>
                      {a.follow_up && (
                        <button type="button" onClick={() => setFollowup(a)} className="mt-1 line-clamp-1 text-left text-xs text-muted-foreground hover:text-foreground">
                          ↳ {a.follow_up}
                        </button>
                      )}
                    </td>
                    <td className="max-w-[200px] px-3 py-3 text-[13px]"><span className="line-clamp-2">{clienteNome.get(a.cliente_id ?? "") ?? <span className="text-muted-foreground">Avulsa</span>}</span></td>
                    <td className="max-w-[200px] px-3 py-3 text-[13px]">
                      <div>{setorNome.get(a.setor_id)}</div>
                      <div className="line-clamp-1 text-xs text-muted-foreground">{tipoNome.get(a.categoria_id ?? "") ?? "—"}</div>
                    </td>
                    <td className="px-3 py-3 text-[13px]">{nome.get(a.responsavel_id) ?? "—"}</td>
                    <td className="px-3 py-3"><PrioridadePill p={a.prioridade} /></td>
                    <td className="px-3 py-3"><StatusPill status={eff} /></td>
                    <td className={cn("whitespace-nowrap px-3 py-3 text-[13px] tabular-nums", eff === "atrasado" && "font-medium text-red-600")}>{dataBR(a.prazo) ?? "—"}</td>
                    <td className="px-3 py-3 text-xs">
                      {ciente
                        ? <span className="inline-flex items-center gap-1 text-emerald-600" title={new Date(ciente).toLocaleString("pt-BR")}><CheckCircle2 className="h-3.5 w-3.5" /> Ciente</span>
                        : <span className="text-muted-foreground">Pendente</span>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(upd), { locale: ptBR, addSuffix: true })}
                      {a.atualizado_por && <div>por {nome.get(a.atualizado_por) ?? "—"}</div>}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2.5 text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditing(a)} aria-label="Editar"><Pencil className="h-4 w-4" /></Button>
                      {isAdmin && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => excluir(a)} aria-label="Excluir"><Trash2 className="h-4 w-4" /></Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {(creating || editing) && membro && (
        <AtividadeDialog
          atividade={editing}
          setores={setores}
          membros={membros}
          categorias={categorias}
          me={membro}
          isAdmin={isAdmin}
          onClose={() => { setCreating(false); setEditing(null); }}
        />
      )}

      <Dialog open={!!followup} onOpenChange={(v) => { if (!v) setFollowup(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle className="text-base">Follow-up</DialogTitle></DialogHeader>
          {followup && (
            <div className="space-y-3">
              <div className="rounded-lg bg-muted/40 px-3 py-2 text-sm">
                <div className="font-medium">{followup.atividade}</div>
                <div className="text-xs text-muted-foreground">{setorNome.get(followup.setor_id)} · {nome.get(followup.responsavel_id)}</div>
              </div>
              <div className="max-h-[55vh] overflow-auto whitespace-pre-wrap rounded-lg border p-4 text-sm leading-relaxed">{followup.follow_up}</div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Filtro({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <Select value={value || "__all"} onValueChange={(v) => onChange(v === "__all" ? "" : v)}>
      <SelectTrigger className={cn("h-9 bg-background text-[13px]", value && "border-primary/40 text-primary")} aria-label={label}>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__all">{label}: todos</SelectItem>
        {options.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

export type { Status };
