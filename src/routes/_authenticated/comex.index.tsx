import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle, ExternalLink, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/os/page";
import { Card, ComexGate, ProcessoCard, ProcessoDialog } from "@/components/comex/ui";
import { GRUPOS, grupoDaEtapa, useAtualizacoes, useClientes, useComexAoVivo, useComexMe, useProcessos, type Grupo, type Processo } from "@/os/comex/data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/comex/")({
  head: () => ({ meta: [{ title: "Follow-up · Render Comex — render.os" }] }),
  component: () => <ComexGate><Painel /></ComexGate>,
});

function Painel() {
  useComexAoVivo();
  const { editaPOs } = useComexMe();
  const { data: clientes = [] } = useClientes();
  const { data: processos = [], isLoading } = useProcessos();
  const { data: feed = [] } = useAtualizacoes(null, 15);
  const [cliente, setCliente] = useState<string>("todos");
  const [grupo, setGrupo] = useState<Grupo | "ativos">("ativos");
  const [busca, setBusca] = useState("");
  const [editando, setEditando] = useState<Partial<Processo> | null>(null);

  const nome = useMemo(() => new Map(clientes.map((c) => [c.id, c.nome])), [clientes]);
  const doCliente = processos.filter((p) => cliente === "todos" || p.cliente_id === cliente);
  const contagem = Object.fromEntries(GRUPOS.map((g) => [g.key, doCliente.filter((p) => grupoDaEtapa(p.etapa) === g.key).length])) as Record<Grupo, number>;
  const q = busca.trim().toLowerCase();
  const lista = doCliente
    .filter((p) => grupo === "ativos" ? p.etapa !== "entregue" : grupoDaEtapa(p.etapa) === grupo)
    .filter((p) => !q || [p.po, p.invoice, p.mercadoria, p.container, nome.get(p.cliente_id)].some((x) => x?.toLowerCase().includes(q)));
  const pendencias = doCliente.filter((p) => p.pendencia && p.etapa !== "entregue");

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        eyebrow="Render Comex · Operacional"
        title="Follow-up de importação"
        description="Atualize as POs aqui: o cliente vê na hora, pelo portal."
        actions={<>
          <Button variant="outline" size="sm" asChild><a href="/portal" target="_blank" rel="noreferrer"><ExternalLink className="mr-1.5 h-4 w-4" />Portal do cliente</a></Button>
          {editaPOs && <Button size="sm" onClick={() => setEditando({ cliente_id: cliente !== "todos" ? cliente : undefined, etapa: "pedido" })} disabled={!clientes.length}><Plus className="mr-1.5 h-4 w-4" />Nova PO</Button>}
        </>}
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {GRUPOS.map((g) => (
          <button key={g.key} type="button" onClick={() => setGrupo(grupo === g.key ? "ativos" : g.key)}
            className={cn("rounded-xl border bg-background p-4 text-left transition hover:border-foreground/20", grupo === g.key && "border-brand-blue ring-1 ring-brand-blue")}>
            <div className="text-xs font-medium text-muted-foreground">{g.label}</div>
            <div className="mt-1.5 font-display text-[26px] font-semibold leading-none tabular-nums">{contagem[g.key]}</div>
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <div className="space-y-3 lg:col-span-8">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={cliente} onValueChange={setCliente}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os clientes</SelectItem>
                {clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="relative min-w-48 flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="PO, invoice, mercadoria, container…" className="pl-8" />
            </div>
            <span className="text-xs text-muted-foreground">{grupo === "ativos" ? "Em andamento" : GRUPOS.find((g) => g.key === grupo)?.label} · {lista.length}</span>
          </div>
          {isLoading ? null : lista.length ? (
            lista.map((p) => <ProcessoCard key={p.id} p={p} clienteNome={cliente === "todos" ? nome.get(p.cliente_id) : undefined} onEdit={editaPOs ? () => setEditando(p) : undefined} />)
          ) : (
            <div className="rounded-xl border border-dashed bg-background py-12 text-center text-sm text-muted-foreground">
              {clientes.length ? "Nenhuma PO neste filtro." : "Cadastre um cliente em Operacional › Clientes para começar."}
            </div>
          )}
        </div>

        <div className="space-y-4 lg:col-span-4">
          <Card title="Pendências dos clientes" sub="O que está travado do lado do cliente">
            {pendencias.length ? (
              <ul className="space-y-2.5">
                {pendencias.map((p) => (
                  <li key={p.id} className="flex gap-2 text-sm">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                    <button type="button" className="text-left" disabled={!editaPOs} onClick={() => setEditando(p)}>
                      <span className="font-mono text-xs text-brand-blue">PO #{p.po}</span>
                      <span className="text-xs text-muted-foreground"> · {nome.get(p.cliente_id)}</span>
                      <span className="block">{p.pendencia}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : <p className="py-4 text-center text-sm text-muted-foreground">Nenhuma pendência.</p>}
          </Card>
          <Card title="Últimas atualizações" sub="O que os clientes estão vendo no feed">
            {feed.length ? (
              <ul className="space-y-3">
                {feed.map((a) => (
                  <li key={a.id} className="border-l-2 border-brand-blue/30 pl-3">
                    <div className="text-xs font-medium text-brand-blue">{nome.get(a.cliente_id) ?? "—"}</div>
                    <div className="line-clamp-3 text-sm">{a.mensagem}</div>
                    <div className="text-[11px] text-muted-foreground">{a.autor ?? "—"} · {formatDistanceToNow(new Date(a.criado_em), { locale: ptBR, addSuffix: true })}</div>
                  </li>
                ))}
              </ul>
            ) : <p className="py-4 text-center text-sm text-muted-foreground">Sem atualizações ainda.</p>}
          </Card>
        </div>
      </div>

      {editando && <ProcessoDialog value={editando} clientes={clientes} onClose={() => setEditando(null)} />}
    </div>
  );
}
