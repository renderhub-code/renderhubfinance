import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClienteCombobox } from "./ClienteCombobox";
import { FieldLabel } from "./ui";
import { cdb, PRIORIDADE_LABEL, STATUS_LABEL, type Atividade, type Categoria, type Membro, type Setor } from "@/os/contabil/db";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

/**
 * Criar / editar atividade.
 * Regras (as mesmas do Hub da Union, garantidas também no banco):
 *  - o setor comanda as listas de responsável e de tipo;
 *  - quem não é admin pode criar no próprio setor ou para quem tem liberação geral;
 *  - ao editar, quem não é admin só muda status, prazo, follow-up, tipo e empresa.
 */
export function AtividadeDialog({
  atividade, setores, membros, categorias, me, isAdmin, onClose,
}: {
  atividade: Atividade | null;
  setores: Setor[];
  membros: Membro[];
  categorias: Categoria[];
  me: Membro;
  isAdmin: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const isNew = !atividade;
  const locked = !isNew && !isAdmin;
  const [form, setForm] = useState({
    cliente_id: atividade?.cliente_id ?? "",
    setor_id: atividade?.setor_id ?? (isAdmin ? "" : me.setor_id ?? ""),
    categoria_id: atividade?.categoria_id ?? "",
    atividade: atividade?.atividade ?? "",
    responsavel_id: atividade?.responsavel_id ?? (isAdmin ? "" : me.user_id),
    prioridade: String(atividade?.prioridade ?? 3),
    status: atividade?.status === "atrasado" ? "em_andamento" : (atividade?.status ?? "nao_iniciado"),
    prazo: atividade?.prazo ?? "",
    follow_up: atividade?.follow_up ?? "",
  });
  const [novoTipo, setNovoTipo] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  // Responsáveis possíveis: pessoas ativas do setor escolhido que eu posso acionar.
  const podeTodos = isAdmin || me.atribuicao_global || form.setor_id === me.setor_id;
  const responsaveis = membros.filter(
    (m) => m.ativo && m.setor_id === form.setor_id && (podeTodos || m.papel === "admin" || m.atribuicao_global),
  );
  const tipos = categorias.filter((c) => c.setor_id === form.setor_id);

  async function criarTipo() {
    const nome = (novoTipo ?? "").trim();
    if (!nome || !form.setor_id) return;
    const { data, error } = await cdb
      .from("contabil_categorias")
      .insert({ setor_id: form.setor_id, nome, criado_por: me.user_id })
      .select("id")
      .single();
    if (error || !data) { toast.error(error?.message ?? "Não foi possível criar o tipo."); return; }
    await qc.invalidateQueries({ queryKey: ["contabil", "categorias"] });
    set({ categoria_id: (data as { id: string }).id });
    setNovoTipo(null);
    toast.success("Tipo criado.");
  }

  async function salvar() {
    setSaving(true);
    setErro(null);
    const completo = {
      cliente_id: form.cliente_id || null,
      categoria_id: form.categoria_id || null,
      setor_id: form.setor_id,
      atividade: form.atividade.trim(),
      responsavel_id: form.responsavel_id,
      prioridade: Number(form.prioridade),
      status: form.status,
      prazo: form.prazo || null,
      follow_up: form.follow_up.trim() || null,
    };
    const parcial = {
      cliente_id: completo.cliente_id, categoria_id: completo.categoria_id,
      status: completo.status, prazo: completo.prazo, follow_up: completo.follow_up,
    };
    const res = isNew
      ? await cdb.from("contabil_atividades").insert(completo).select("id").single()
      : await cdb.from("contabil_atividades").update(isAdmin ? completo : parcial).eq("id", atividade!.id);
    if (res.error) {
      setSaving(false);
      setErro(res.error.message);
      return;
    }
    // Criou para si mesmo: ciência registrada na hora.
    const novoId = isNew ? (res.data as { id: string } | null)?.id : null;
    if (novoId && form.responsavel_id === me.user_id) {
      await cdb.from("contabil_ciencias").insert({ atividade_id: novoId, user_id: me.user_id });
    }
    setSaving(false);
    await qc.invalidateQueries({ queryKey: ["contabil"] });
    toast.success(isNew ? "Atividade criada." : "Atividade atualizada.");
    onClose();
  }

  const podeSalvar = form.atividade.trim() && form.setor_id && form.responsavel_id && form.categoria_id;

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl gap-0 p-0">
        <DialogHeader className="border-b px-6 py-5">
          <DialogTitle className="text-base">{isNew ? "Nova atividade" : "Editar atividade"}</DialogTitle>
          <DialogDescription className="text-xs">
            {locked
              ? "Você pode alterar status, prazo, follow-up, tipo e empresa. O restante é do administrador."
              : "Escolha o setor primeiro: ele define os responsáveis e os tipos disponíveis."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[65vh] grid-cols-2 gap-x-4 gap-y-4 overflow-y-auto px-6 py-5">
          <div className="col-span-2">
            <FieldLabel>Empresa cliente</FieldLabel>
            <ClienteCombobox value={form.cliente_id} onChange={(v) => set({ cliente_id: v })} />
          </div>

          <div>
            <FieldLabel>Setor</FieldLabel>
            <Select
              value={form.setor_id}
              disabled={locked}
              onValueChange={(v) => set({ setor_id: v, responsavel_id: v === me.setor_id && !isAdmin ? me.user_id : "", categoria_id: "" })}
            >
              <SelectTrigger className="h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{setores.map((s) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div>
            <FieldLabel>Tipo da atividade</FieldLabel>
            {novoTipo === null ? (
              <>
                <Select value={form.categoria_id} onValueChange={(v) => set({ categoria_id: v })} disabled={!form.setor_id}>
                  <SelectTrigger className="h-9"><SelectValue placeholder={form.setor_id ? "Selecione o tipo" : "Escolha o setor"} /></SelectTrigger>
                  <SelectContent>{tipos.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                </Select>
                {form.setor_id && (
                  <button type="button" className="mt-1 text-[11px] font-medium text-primary hover:underline" onClick={() => setNovoTipo("")}>
                    + Adicionar novo tipo
                  </button>
                )}
              </>
            ) : (
              <div className="flex gap-1.5">
                <Input autoFocus className="h-9" value={novoTipo} onChange={(e) => setNovoTipo(e.target.value)} placeholder="Nome do tipo" />
                <Button type="button" size="sm" className="h-9" onClick={criarTipo} disabled={!novoTipo.trim()}>Criar</Button>
                <Button type="button" size="sm" variant="ghost" className="h-9" onClick={() => setNovoTipo(null)}>×</Button>
              </div>
            )}
          </div>

          <div className="col-span-2">
            <FieldLabel>Atividade</FieldLabel>
            <Textarea rows={3} value={form.atividade} disabled={locked} onChange={(e) => set({ atividade: e.target.value })} placeholder="O que precisa ser feito?" />
          </div>

          <div>
            <FieldLabel>Responsável</FieldLabel>
            <Select value={form.responsavel_id} onValueChange={(v) => set({ responsavel_id: v })} disabled={locked || !form.setor_id}>
              <SelectTrigger className="h-9"><SelectValue placeholder={form.setor_id ? "Selecione" : "Escolha o setor"} /></SelectTrigger>
              <SelectContent>
                {responsaveis.map((m) => <SelectItem key={m.user_id} value={m.user_id}>{m.nome || m.email}</SelectItem>)}
                {form.responsavel_id && !responsaveis.some((m) => m.user_id === form.responsavel_id) && (
                  <SelectItem value={form.responsavel_id}>{membros.find((m) => m.user_id === form.responsavel_id)?.nome ?? "Responsável atual"}</SelectItem>
                )}
              </SelectContent>
            </Select>
            {form.setor_id && responsaveis.length === 0 && (
              <p className="mt-1 text-[11px] text-destructive">Ninguém desse setor está disponível para você.</p>
            )}
          </div>

          <div>
            <FieldLabel>Prioridade</FieldLabel>
            <Select value={form.prioridade} onValueChange={(v) => set({ prioridade: v })} disabled={locked}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>{[1, 2, 3, 4].map((p) => <SelectItem key={p} value={String(p)}>P{p} · {PRIORIDADE_LABEL[p]}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div>
            <FieldLabel>Status</FieldLabel>
            <Select value={form.status} onValueChange={(v) => set({ status: v as typeof form.status })}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(["nao_iniciado", "em_andamento", "concluido"] as const).map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="mt-1 text-[11px] text-muted-foreground">“Atrasado” aparece sozinho quando o prazo vence.</p>
          </div>

          <div>
            <FieldLabel>Prazo</FieldLabel>
            <Input type="date" className="h-9" value={form.prazo} onChange={(e) => set({ prazo: e.target.value })} />
          </div>

          <div className="col-span-2">
            <FieldLabel>Follow-up</FieldLabel>
            <Textarea rows={4} value={form.follow_up} onChange={(e) => set({ follow_up: e.target.value })} placeholder="Andamento, próximos passos, bloqueios…" />
          </div>
        </div>

        {erro && <p className="mx-6 mb-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">{erro}</p>}

        <DialogFooter className="border-t px-6 py-4">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={salvar} disabled={saving || !podeSalvar} className={cn(saving && "opacity-80")}>
            {saving ? "Salvando…" : isNew ? "Criar atividade" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
