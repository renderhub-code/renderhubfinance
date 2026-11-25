import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Copy, ExternalLink, Plus, Search, Send, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/os/page";
import { EmpresaChips, FieldLabel, IaGate, StatusPill } from "@/components/ia/ui";
import {
  brl, idb, nf, roi, STATUS, TIPOS, useAtualizacoes, useIaMe, useInvalidateIa, useSolucoes, type Solucao,
} from "@/os/ia/data";
import { GROUP_COMPANIES } from "@/os/companies";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/ia/entregas")({
  head: () => ({ meta: [{ title: "Entregas · IA — render.os" }] }),
  component: () => <IaGate><Entregas /></IaGate>,
});

type Draft = Omit<Solucao, "id" | "criado_em" | "atualizado_em"> & { id?: string };
const BLANK: Draft = { titulo: "", tipo: "Automação", status: "Ideia", ganho: 0, custo: 0, horas: 0, link: "", responsavel: "", descricao: "", empresas: [], previsao: null };
type SortK = "titulo" | "ganho" | "custo" | "horas" | "roi" | "atualizado_em";

function Entregas() {
  const { canEdit } = useIaMe(true, "ia.entregas");
  const { data: solucoes = [], isLoading } = useSolucoes();
  const { data: atualizacoes = [] } = useAtualizacoes();
  const [q, setQ] = useState("");
  const [st, setSt] = useState("");
  const [tipo, setTipo] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [sort, setSort] = useState<{ k: SortK; d: 1 | -1 }>({ k: "atualizado_em", d: -1 });
  const [edit, setEdit] = useState<Draft | null>(null);

  const nAtual = useMemo(() => {
    const m = new Map<string, number>();
    atualizacoes.forEach((a) => m.set(a.solucao_id, (m.get(a.solucao_id) ?? 0) + 1));
    return m;
  }, [atualizacoes]);

  const val = (s: Solucao, k: SortK) => (k === "roi" ? roi(s) ?? -1 : s[k]);
  const list = solucoes
    .filter((s) => (!st || s.status === st) && (!tipo || s.tipo === tipo) && (!empresa || s.empresas.includes(empresa)))
    .filter((s) => !q || `${s.titulo} ${s.responsavel ?? ""} ${s.tipo} ${s.descricao ?? ""}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => {
      const x = val(a, sort.k), y = val(b, sort.k);
      return (typeof x === "string" ? x.localeCompare(String(y), "pt") : Number(x) - Number(y)) * sort.d;
    });

  function csv() {
    const head = ["Entrega", "Tipo", "Status", "Empresas", "Ganho/mês", "Custo/mês", "Horas/mês", "Responsável", "Previsão", "Link"];
    const rows = list.map((s) => [s.titulo, s.tipo, s.status, s.empresas.map((id) => GROUP_COMPANIES.find((c) => c.id === id)?.name ?? id).join("; "), s.ganho, s.custo, s.horas, s.responsavel ?? "", s.previsao ?? "", s.link ?? ""]);
    const txt = [head, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    navigator.clipboard.writeText(txt).then(() => toast.success("CSV copiado"));
  }

  const Th = ({ k, children, r }: { k: SortK; children: string; r?: boolean }) => (
    <th className={cn("cursor-pointer select-none px-3 py-2.5 font-medium hover:text-foreground", r && "text-right")} onClick={() => setSort((s) => ({ k, d: s.k === k ? (s.d === 1 ? -1 : 1) : -1 }))}>
      {children}{sort.k === k ? (sort.d === 1 ? " ↑" : " ↓") : ""}
    </th>
  );

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        eyebrow="Departamento de IA"
        title="Entregas"
        description="Plataformas, automações, painéis e agentes, com ganho, custo e andamento."
        actions={<>
          <Button variant="outline" onClick={csv}><Copy className="mr-1.5 h-4 w-4" /> Copiar CSV</Button>
          {canEdit && <Button onClick={() => setEdit({ ...BLANK })}><Plus className="mr-1.5 h-4 w-4" /> Nova entrega</Button>}
        </>}
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {["", ...STATUS].map((s) => (
          <button key={s || "all"} type="button" onClick={() => setSt(s)}
            className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors", st === s ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted")}>
            {s || "Todas"} <span className="opacity-60">{s ? solucoes.filter((x) => x.status === s).length : solucoes.length}</span>
          </button>
        ))}
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="h-9 pl-8" placeholder="Buscar entrega, responsável…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Filtro label="Tipo" value={tipo} onChange={setTipo} options={TIPOS.map((t) => [t, t])} />
        <Filtro label="Empresa" value={empresa} onChange={setEmpresa} options={GROUP_COMPANIES.map((c) => [c.id, c.name])} />
      </div>

      <div className="overflow-hidden rounded-xl border">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
              <tr>
                <Th k="titulo">Entrega</Th>
                <th className="px-3 py-2.5 font-medium">Status</th>
                <th className="px-3 py-2.5 font-medium">Empresas</th>
                <Th k="ganho" r>Ganho/mês</Th>
                <Th k="custo" r>Custo/mês</Th>
                <Th k="horas" r>Horas/mês</Th>
                <Th k="roi" r>Retorno</Th>
                <Th k="atualizado_em" r>Atualizado</Th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading && <tr><td colSpan={9} className="py-10 text-center text-muted-foreground">Carregando…</td></tr>}
              {!isLoading && list.length === 0 && (
                <tr><td colSpan={9} className="py-14 text-center">
                  <Sparkles className="mx-auto mb-2 h-6 w-6 text-muted-foreground/60" />
                  <div className="text-sm text-muted-foreground">Nenhuma entrega encontrada.</div>
                </td></tr>
              )}
              {list.map((s) => {
                const r = roi(s);
                return (
                  <tr key={s.id} className="cursor-pointer transition-colors hover:bg-muted/20" onClick={() => setEdit({ ...s })}>
                    <td className="max-w-[360px] px-3 py-2.5">
                      <div className="font-medium">{s.titulo}</div>
                      <div className="text-xs text-muted-foreground">{s.tipo} · {s.responsavel || "sem responsável"}{nAtual.get(s.id) ? ` · ${nAtual.get(s.id)} atualização(ões)` : ""}</div>
                    </td>
                    <td className="px-3"><StatusPill s={s.status} /></td>
                    <td className="px-3"><EmpresaChips ids={s.empresas} /></td>
                    <td className="px-3 text-right tabular-nums">{brl(s.ganho)}</td>
                    <td className="px-3 text-right tabular-nums text-muted-foreground">{brl(s.custo)}</td>
                    <td className="px-3 text-right tabular-nums">{nf(s.horas)} h</td>
                    <td className="px-3 text-right tabular-nums">{r === null ? "—" : `${nf(r, 1)}×`}</td>
                    <td className="whitespace-nowrap px-3 text-right text-xs text-muted-foreground">{formatDistanceToNow(new Date(s.atualizado_em), { locale: ptBR, addSuffix: true })}</td>
                    <td className="px-3 text-right">
                      {s.link && /^https:\/\//.test(s.link) && (
                        <a href={s.link} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-muted-foreground hover:text-primary" aria-label="Abrir link"><ExternalLink className="h-4 w-4" /></a>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Sheet open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {edit && <Editor draft={edit} setDraft={setEdit} canEdit={canEdit} onClose={() => setEdit(null)} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Editor({ draft, setDraft, canEdit, onClose }: { draft: Draft; setDraft: (d: Draft) => void; canEdit: boolean; onClose: () => void }) {
  const invalidate = useInvalidateIa();
  const { data: atualizacoes = [] } = useAtualizacoes();
  const { user, isAdmin } = useIaMe();
  const [nota, setNota] = useState("");
  const [saving, setSaving] = useState(false);
  const diario = draft.id ? atualizacoes.filter((a) => a.solucao_id === draft.id) : [];
  const set = (p: Partial<Draft>) => setDraft({ ...draft, ...p });

  async function salvar() {
    if (!draft.titulo.trim()) { toast.error("Informe o título."); return; }
    if (draft.link && !/^https:\/\//.test(draft.link)) { toast.error("O link precisa começar com https://"); return; }
    setSaving(true);
    const { id, ...row } = draft;
    const payload = { ...row, titulo: row.titulo.trim(), link: row.link?.trim() || null, responsavel: row.responsavel?.trim() || null, descricao: row.descricao?.trim() || null, previsao: row.previsao || null };
    const { error } = id ? await idb.from("ia_solucoes").update(payload).eq("id", id) : await idb.from("ia_solucoes").insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    invalidate();
    toast.success(id ? "Entrega atualizada." : "Entrega criada.");
    onClose();
  }

  async function excluir() {
    if (!draft.id) return;
    const original = draft as Solucao;
    const { error } = await idb.from("ia_solucoes").delete().eq("id", draft.id);
    if (error) { toast.error(error.message); return; }
    invalidate();
    onClose();
    toast("Entrega excluída", {
      action: { label: "Desfazer", onClick: async () => { await idb.from("ia_solucoes").insert(original); invalidate(); } },
    });
  }

  async function registrar() {
    if (!nota.trim() || !draft.id) return;
    const { error } = await idb.from("ia_atualizacoes").insert({ solucao_id: draft.id, texto: nota.trim() });
    if (error) { toast.error(error.message); return; }
    setNota("");
    invalidate();
  }

  async function apagarNota(id: string) {
    const { error } = await idb.from("ia_atualizacoes").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    invalidate();
  }

  const ro = !canEdit;
  return (
    <>
      <SheetHeader className="px-1">
        <SheetTitle>{draft.id ? (ro ? draft.titulo : "Editar entrega") : "Nova entrega"}</SheetTitle>
        <SheetDescription className="text-xs">{ro ? "Somente leitura." : "Ganho, custo e horas são mensais. O ganho conta no painel quando o status é Produção."}</SheetDescription>
      </SheetHeader>

      <div className="grid gap-4 px-1 pb-6 pt-4">
        <div><FieldLabel>Título</FieldLabel><Input disabled={ro} value={draft.titulo} onChange={(e) => set({ titulo: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><FieldLabel>Tipo</FieldLabel><Opcoes disabled={ro} value={draft.tipo} options={TIPOS} onChange={(v) => set({ tipo: v })} /></div>
          <div><FieldLabel>Status</FieldLabel><Opcoes disabled={ro} value={draft.status} options={STATUS} onChange={(v) => set({ status: v })} /></div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div><FieldLabel>Ganho/mês (R$)</FieldLabel><Input disabled={ro} type="number" min={0} value={draft.ganho} onChange={(e) => set({ ganho: +e.target.value })} /></div>
          <div><FieldLabel>Custo/mês (R$)</FieldLabel><Input disabled={ro} type="number" min={0} value={draft.custo} onChange={(e) => set({ custo: +e.target.value })} /></div>
          <div><FieldLabel>Horas/mês</FieldLabel><Input disabled={ro} type="number" min={0} value={draft.horas} onChange={(e) => set({ horas: +e.target.value })} /></div>
        </div>
        <div>
          <div className="flex items-center justify-between">
            <FieldLabel>Empresas atendidas</FieldLabel>
            {!ro && (
              <button type="button" className="mb-1.5 text-[11px] font-medium text-primary hover:underline"
                onClick={() => set({ empresas: draft.empresas.length === GROUP_COMPANIES.length ? [] : GROUP_COMPANIES.map((c) => c.id) })}>
                {draft.empresas.length === GROUP_COMPANIES.length ? "Limpar" : "Todo o grupo"}
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {GROUP_COMPANIES.map((c) => {
              const on = draft.empresas.includes(c.id);
              return (
                <button key={c.id} type="button" disabled={ro}
                  onClick={() => set({ empresas: on ? draft.empresas.filter((x) => x !== c.id) : [...draft.empresas, c.id] })}
                  className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors", on ? "border-transparent text-white" : "hover:bg-muted")}
                  style={on ? { background: c.color } : undefined}>
                  {c.name}
                </button>
              );
            })}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><FieldLabel>Responsável</FieldLabel><Input disabled={ro} value={draft.responsavel ?? ""} onChange={(e) => set({ responsavel: e.target.value })} /></div>
          <div><FieldLabel>Previsão de entrega</FieldLabel><Input disabled={ro} type="date" value={draft.previsao ?? ""} onChange={(e) => set({ previsao: e.target.value || null })} /></div>
        </div>
        <div><FieldLabel>Link (https://)</FieldLabel><Input disabled={ro} value={draft.link ?? ""} onChange={(e) => set({ link: e.target.value })} /></div>
        <div><FieldLabel>Descrição</FieldLabel><Textarea disabled={ro} rows={3} value={draft.descricao ?? ""} onChange={(e) => set({ descricao: e.target.value })} /></div>

        {canEdit && (
          <div className="flex gap-2">
            <Button onClick={salvar} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
            <Button variant="ghost" onClick={onClose}>Cancelar</Button>
            {draft.id && <Button variant="ghost" className="ml-auto text-destructive hover:text-destructive" onClick={excluir}><Trash2 className="mr-1.5 h-4 w-4" /> Excluir</Button>}
          </div>
        )}

        {draft.id && (
          <section className="mt-2 border-t pt-5">
            <h3 className="mb-3 text-sm font-semibold">Diário da entrega</h3>
            {canEdit && (
              <form className="mb-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); void registrar(); }}>
                <Input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="O que andou? Ex.: publicado o módulo Contábil" />
                <Button type="submit" size="icon" disabled={!nota.trim()} aria-label="Registrar"><Send className="h-4 w-4" /></Button>
              </form>
            )}
            {diario.length ? (
              <ul className="space-y-3">
                {diario.map((a) => (
                  <li key={a.id} className="group border-l-2 border-primary/30 pl-3">
                    <div className="whitespace-pre-wrap text-sm">{a.texto}</div>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      {a.autor_nome ?? "—"} · {formatDistanceToNow(new Date(a.criado_em), { locale: ptBR, addSuffix: true })}
                      {(isAdmin || a.autor_id === user?.id) && (
                        <button type="button" onClick={() => apagarNota(a.id)} className="opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100">apagar</button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : <p className="text-xs text-muted-foreground">Nenhum registro ainda.</p>}
          </section>
        )}
      </div>
    </>
  );
}

function Opcoes({ value, options, onChange, disabled }: { value: string; options: readonly string[]; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
      <SelectContent>{options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
    </Select>
  );
}

function Filtro({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <Select value={value || "__all"} onValueChange={(v) => onChange(v === "__all" ? "" : v)}>
      <SelectTrigger className={cn("h-9 w-44 text-[13px]", value && "border-primary/40 text-primary")} aria-label={label}><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="__all">{label}: todos</SelectItem>
        {options.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
