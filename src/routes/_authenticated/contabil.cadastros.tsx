import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Layers, Plus, Tags } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { PageHeader, Section } from "@/components/os/page";
import { ContabilGate } from "@/components/contabil/ui";
import { useSetores, useInvalidateContabil } from "@/os/contabil/hooks";
import { cdb, type Categoria, type Setor } from "@/os/contabil/db";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/contabil/cadastros")({
  head: () => ({ meta: [{ title: "Setores e tipos · Contábil — render.os" }] }),
  component: () => <ContabilGate adminOnly><Cadastros /></ContabilGate>,
});

function Cadastros() {
  const { data: setores = [] } = useSetores();
  const invalidate = useInvalidateContabil();
  const [setorSel, setSetorSel] = useState<string>("");
  const [novoSetor, setNovoSetor] = useState("");
  const [novoTipo, setNovoTipo] = useState("");

  // Aqui o admin vê também os tipos desativados.
  const { data: tipos = [] } = useQuery({
    queryKey: ["contabil", "categorias", "todas"],
    queryFn: async () => {
      const { data, error } = await cdb.from("contabil_categorias").select("*").order("ordem").order("nome");
      if (error) throw error;
      return (data ?? []) as Categoria[];
    },
  });

  const atual = setorSel || setores[0]?.id || "";
  const tiposDoSetor = tipos.filter((t) => t.setor_id === atual);

  async function run(p: PromiseLike<{ error: { message: string; code?: string } | null }>, ok?: string) {
    const { error } = await p;
    if (error) { toast.error(error.code === "23505" ? "Esse nome já existe." : error.message); return false; }
    if (ok) toast.success(ok);
    invalidate();
    return true;
  }

  return (
    <div className="mx-auto max-w-[1000px]">
      <PageHeader eyebrow="Contábil" title="Setores e tipos" description="Os setores organizam a equipe; cada setor tem seus tipos de atividade." />

      <div className="grid gap-8 md:grid-cols-[280px_1fr]">
        <Section icon={Layers} title="Setores">
          <ul className="space-y-1">
            {setores.map((s) => (
              <SetorRow key={s.id} setor={s} active={s.id === atual} onSelect={() => setSetorSel(s.id)}
                onRename={(nome) => run(cdb.from("contabil_setores").update({ nome }).eq("id", s.id), "Setor renomeado.")} />
            ))}
          </ul>
          <form className="mt-3 flex gap-1.5" onSubmit={async (e) => {
            e.preventDefault();
            if (!novoSetor.trim()) return;
            if (await run(cdb.from("contabil_setores").insert({ nome: novoSetor.trim(), ordem: setores.length + 1 }), "Setor criado.")) setNovoSetor("");
          }}>
            <Input className="h-9" placeholder="Novo setor" value={novoSetor} onChange={(e) => setNovoSetor(e.target.value)} />
            <Button size="icon" className="h-9 w-9 shrink-0" disabled={!novoSetor.trim()} aria-label="Criar setor"><Plus className="h-4 w-4" /></Button>
          </form>
        </Section>

        <Section icon={Tags} title={`Tipos de atividade · ${setores.find((s) => s.id === atual)?.nome ?? ""}`}>
          <form className="mb-3 flex gap-1.5" onSubmit={async (e) => {
            e.preventDefault();
            if (!novoTipo.trim() || !atual) return;
            if (await run(cdb.from("contabil_categorias").insert({ setor_id: atual, nome: novoTipo.trim() }), "Tipo criado.")) setNovoTipo("");
          }}>
            <Input className="h-9" placeholder="Novo tipo para este setor" value={novoTipo} onChange={(e) => setNovoTipo(e.target.value)} />
            <Button className="h-9 shrink-0" disabled={!novoTipo.trim() || !atual}><Plus className="mr-1 h-4 w-4" /> Adicionar</Button>
          </form>
          <div className="overflow-hidden rounded-xl border">
            {tiposDoSetor.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Nenhum tipo neste setor.</p>}
            <ul className="divide-y">
              {tiposDoSetor.map((t) => (
                <li key={t.id} className={cn("flex items-center gap-3 px-3 py-2", !t.ativo && "opacity-50")}>
                  <InlineName value={t.nome} onSave={(nome) => run(cdb.from("contabil_categorias").update({ nome }).eq("id", t.id), "Tipo renomeado.")} />
                  <label className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                    {t.ativo ? "Ativo" : "Inativo"}
                    <Switch checked={t.ativo} onCheckedChange={(v) => run(cdb.from("contabil_categorias").update({ ativo: v }).eq("id", t.id))} />
                  </label>
                </li>
              ))}
            </ul>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Desativar um tipo tira ele das listas, mas mantém o histórico das atividades.</p>
        </Section>
      </div>
    </div>
  );
}

function SetorRow({ setor, active, onSelect, onRename }: { setor: Setor; active: boolean; onSelect: () => void; onRename: (n: string) => void }) {
  return (
    <li className={cn("flex items-center rounded-lg border px-1", active ? "border-primary/40 bg-primary/5" : "border-transparent hover:bg-muted/40")}>
      <button type="button" onClick={onSelect} className="h-2 w-2 shrink-0 rounded-full bg-primary/70 mx-2" aria-label={`Ver tipos de ${setor.nome}`} />
      <div className="flex-1" onClick={onSelect}><InlineName value={setor.nome} onSave={onRename} /></div>
    </li>
  );
}

/** Nome editável no próprio lugar: clique, edite, Enter salva. */
function InlineName({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [v, setV] = useState<string | null>(null);
  if (v === null) {
    return <button type="button" onDoubleClick={() => setV(value)} title="Duplo clique para renomear" className="min-w-0 flex-1 truncate py-1.5 text-left text-sm">{value}</button>;
  }
  return (
    <form className="flex min-w-0 flex-1 gap-1 py-1" onSubmit={(e) => { e.preventDefault(); if (v.trim() && v.trim() !== value) onSave(v.trim()); setV(null); }}>
      <Input autoFocus className="h-8" value={v} onChange={(e) => setV(e.target.value)} onBlur={() => setV(null)} onKeyDown={(e) => e.key === "Escape" && setV(null)} />
      <Button size="icon" className="h-8 w-8 shrink-0" onMouseDown={(e) => e.preventDefault()} aria-label="Salvar"><Check className="h-4 w-4" /></Button>
    </form>
  );
}
