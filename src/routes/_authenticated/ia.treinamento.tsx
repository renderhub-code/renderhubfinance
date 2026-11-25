import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/os/page";
import { Card, Empty, IaGate } from "@/components/ia/ui";
import { chave, idb, metricas, nf, pctPessoa, useIaMe, useInvalidateIa, useModulos, usePessoas, useProgresso, useSolucoes } from "@/os/ia/data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/ia/treinamento")({
  head: () => ({ meta: [{ title: "Treinamento · IA — render.os" }] }),
  component: () => <IaGate><Treinamento /></IaGate>,
});

const CELL = ["bg-muted text-muted-foreground", "bg-blue-100 text-blue-700", "bg-emerald-500 text-white"];
const LABEL = ["Não iniciado", "Em andamento", "Concluído"];

function Treinamento() {
  const { canEdit } = useIaMe();
  const invalidate = useInvalidateIa();
  const { data: solucoes = [] } = useSolucoes();
  const { data: pessoas = [] } = usePessoas();
  const { data: modulos = [] } = useModulos();
  const { data: progresso = [] } = useProgresso();
  const m = metricas(solucoes, pessoas, modulos, progresso);

  async function run(p: PromiseLike<{ error: { message: string } | null }>) {
    const { error } = await p;
    if (error) { toast.error(error.message); return false; }
    invalidate();
    return true;
  }

  function ciclo(pessoa_id: string, modulo_id: string) {
    if (!canEdit) return;
    const status = ((m.pm[chave(pessoa_id, modulo_id)] ?? 0) + 1) % 3;
    void run(idb.from("ia_progresso").upsert({ pessoa_id, modulo_id, status }));
  }

  function renomear(t: "ia_pessoas" | "ia_modulos", id: string, atual: string) {
    if (!canEdit) return;
    const v = window.prompt(t === "ia_pessoas" ? "Nome da pessoa" : "Título do módulo", atual);
    if (!v?.trim() || v === atual) return;
    void run(idb.from(t).update(t === "ia_pessoas" ? { nome: v.trim() } : { titulo: v.trim() }).eq("id", id));
  }

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        eyebrow="Departamento de IA"
        title="Treinamento do time"
        description="Trilha de capacitação em IA: quem já fez o quê."
        actions={<div className="rounded-lg border px-3 py-1.5 text-right"><div className="text-[11px] text-muted-foreground">Capacitação geral</div><div className="font-display text-lg font-semibold tabular-nums">{nf(m.pct)}%</div></div>}
      />

      <Card title="Matriz de capacitação" action={
        <div className="flex gap-3 text-xs text-muted-foreground">
          {LABEL.map((l, i) => <span key={l} className="flex items-center gap-1.5"><span className={cn("h-3 w-3 rounded", CELL[i])} />{l}</span>)}
        </div>
      }>
        {pessoas.length && modulos.length ? (
          <div className="overflow-x-auto">
            <table className="text-sm">
              <thead>
                <tr>
                  <th className="min-w-48" />
                  {modulos.map((md) => (
                    <th key={md.id} className="w-28 px-1 pb-2 align-bottom text-xs font-medium text-muted-foreground">
                      <button type="button" className="text-left hover:text-foreground" onClick={() => renomear("ia_modulos", md.id, md.titulo)}>{md.titulo}</button>
                    </th>
                  ))}
                  <th className="w-16 pb-2 text-right text-xs font-medium text-muted-foreground">Total</th>
                </tr>
              </thead>
              <tbody>
                {pessoas.map((p) => (
                  <tr key={p.id}>
                    <td className="py-1 pr-3">
                      <button type="button" className="text-left" onClick={() => renomear("ia_pessoas", p.id, p.nome)}>
                        <span className="block font-medium">{p.nome}</span>
                        <span className="text-xs text-muted-foreground">{p.cargo ?? ""}</span>
                      </button>
                    </td>
                    {modulos.map((md) => {
                      const v = m.pm[chave(p.id, md.id)] ?? 0;
                      return (
                        <td key={md.id} className="p-1">
                          <button type="button" aria-label={`${p.nome} · ${md.titulo}: ${LABEL[v]}`} title={LABEL[v]} disabled={!canEdit} onClick={() => ciclo(p.id, md.id)}
                            className={cn("flex h-9 w-full items-center justify-center rounded-md text-xs font-medium transition hover:opacity-80 disabled:cursor-default", CELL[v])}>
                            {v === 2 ? <Check className="h-4 w-4" /> : v === 1 ? "…" : ""}
                          </button>
                        </td>
                      );
                    })}
                    <td className="text-right tabular-nums">{nf(pctPessoa(p.id, modulos, m.pm))}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty text="Adicione pessoas e módulos para começar." />}
        {canEdit && <p className="mt-3 text-xs text-muted-foreground">Clique numa célula para avançar o status. Clique no nome de uma pessoa ou módulo para renomear.</p>}
      </Card>

      {canEdit && (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Lista titulo="Pessoas" placeholder="Nome da pessoa" itens={pessoas.map((x) => ({ id: x.id, label: x.nome, sub: x.cargo }))}
            onAdd={(v) => run(idb.from("ia_pessoas").insert({ nome: v, ordem: pessoas.length + 1 }))}
            onDel={(id) => run(idb.from("ia_pessoas").delete().eq("id", id))} />
          <Lista titulo="Módulos" placeholder="Título do módulo" itens={modulos.map((x) => ({ id: x.id, label: x.titulo }))}
            onAdd={(v) => run(idb.from("ia_modulos").insert({ titulo: v, ordem: modulos.length + 1 }))}
            onDel={(id) => run(idb.from("ia_modulos").delete().eq("id", id))} />
        </div>
      )}
    </div>
  );
}

function Lista({ titulo, placeholder, itens, onAdd, onDel }: {
  titulo: string; placeholder: string; itens: { id: string; label: string; sub?: string | null }[];
  onAdd: (v: string) => Promise<boolean>; onDel: (id: string) => void;
}) {
  const [v, setV] = useState("");
  return (
    <Card title={titulo}>
      <form className="mb-2 flex gap-2" onSubmit={async (e) => { e.preventDefault(); if (v.trim() && (await onAdd(v.trim()))) setV(""); }}>
        <Input value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder} />
        <Button type="submit" size="icon" disabled={!v.trim()} aria-label="Adicionar"><Plus className="h-4 w-4" /></Button>
      </form>
      <ul className="divide-y text-sm">
        {itens.map((i) => (
          <li key={i.id} className="flex items-center justify-between py-1.5">
            <span>{i.label}{i.sub && <span className="ml-1.5 text-xs text-muted-foreground">{i.sub}</span>}</span>
            <button type="button" onClick={() => { if (confirm(`Excluir "${i.label}"? O progresso ligado a ele também sai.`)) onDel(i.id); }} className="text-muted-foreground hover:text-destructive" aria-label="Excluir"><Trash2 className="h-4 w-4" /></button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
