import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle, Anchor, CheckCheck, Loader2, LogOut, Package, Radio, Ship } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProcessoCard } from "@/components/comex/ui";
import { supabase } from "@/integrations/supabase/client";
import { GRUPOS, grupoDaEtapa, useAtualizacoes, useClientes, useComexAoVivo, useProcessos, type Grupo } from "@/os/comex/data";
import { cn } from "@/lib/utils";

/** Portal do cliente da Render Comex: fora do render.os, cada cliente vê só as próprias POs. */
export const Route = createFileRoute("/portal")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({ c: typeof s.c === "string" ? s.c : undefined }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session?.user) throw redirect({ to: "/auth" });
    return { user: data.session.user };
  },
  head: () => ({
    meta: [
      { title: "Meu follow-up — Render Comex" },
      { name: "description", content: "Acompanhe ao vivo as suas importações com a Render Comex." },
    ],
  }),
  component: Portal,
});

const ICONE: Record<Grupo, typeof Anchor> = { porto: Anchor, transito: Ship, nao_embarcada: Package, entregue: CheckCheck };

function Portal() {
  useComexAoVivo();
  const navigate = useNavigate();
  const { c } = Route.useSearch();
  const { user } = Route.useRouteContext();
  const clientes = useClientes();
  const clienteId = c ?? clientes.data?.[0]?.id ?? null;
  const cliente = clientes.data?.find((x) => x.id === clienteId);
  const processos = useProcessos(clienteId);
  const feed = useAtualizacoes(clienteId, 30);

  // "O que mudou desde a sua última visita"
  const [ultimaVisita, setUltimaVisita] = useState<string | null>(null);
  useEffect(() => {
    if (!clienteId) return;
    const k = `comex:ultimaVisita:${clienteId}`;
    setUltimaVisita(localStorage.getItem(k));
    const t = setTimeout(() => localStorage.setItem(k, new Date().toISOString()), 4000);
    return () => clearTimeout(t);
  }, [clienteId]);

  const [filtro, setFiltro] = useState<Grupo | "todos">("todos");
  const lista = processos.data ?? [];
  const contagem = useMemo(() => {
    const r: Record<Grupo, number> = { porto: 0, transito: 0, nao_embarcada: 0, entregue: 0 };
    for (const p of lista) r[grupoDaEtapa(p.etapa)]++;
    return r;
  }, [lista]);
  const visiveis = lista.filter((p) => filtro === "todos" || grupoDaEtapa(p.etapa) === filtro);
  const pendencias = lista.filter((p) => p.pendencia && p.etapa !== "entregue");
  const novo = (iso: string) => !!ultimaVisita && iso > ultimaVisita;
  const novidades = (feed.data ?? []).filter((a) => novo(a.criado_em)).length;
  const poDe = useMemo(() => new Map(lista.map((p) => [p.id, p])), [lista]);

  async function sair() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-[#f4f5f7] text-foreground">
      <header className="bg-[#0b1430] text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="rounded-lg bg-white px-2 py-1"><img src="/brand/render-logo-wide.png" alt="Render Comex" className="h-12 w-auto" /></span>
            <div className="text-[11px] leading-tight text-white/60">Follow-up<br />de importação</div>
          </div>
          <div className="flex items-center gap-3 text-xs text-white/70">
            <span className="hidden sm:inline">{user.email}</span>
            <Button size="sm" variant="ghost" className="text-white hover:bg-white/10 hover:text-white" onClick={() => void sair()}><LogOut className="mr-1.5 h-4 w-4" />Sair</Button>
          </div>
        </div>
        <div className="mx-auto max-w-6xl px-5 pb-8 pt-4">
          {(clientes.data?.length ?? 0) > 1 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {clientes.data!.map((x) => (
                <button key={x.id} type="button" onClick={() => navigate({ to: "/portal", search: { c: x.id } })}
                  className={cn("rounded-md px-3 py-1 text-xs font-medium", x.id === clienteId ? "bg-white text-[#0b1430]" : "bg-white/10 text-white hover:bg-white/20")}>{x.nome}</button>
              ))}
            </div>
          )}
          <p className="flex items-center gap-2 text-xs font-medium text-sky-300"><Radio className="h-3.5 w-3.5 animate-pulse" /> Atualizado em tempo real</p>
          <h1 className="mt-2 break-words text-3xl font-semibold tracking-tight sm:text-4xl">{cliente?.nome ?? (clientes.isLoading ? "…" : "Meu follow-up")}</h1>
          {novidades > 0 && <p className="mt-2 text-sm"><span className="rounded-full bg-amber-400 px-2 py-0.5 font-semibold text-amber-950">{novidades}</span> novidade(s) desde a sua última visita</p>}
          {clientes.isSuccess && clientes.data.length === 0 && (
            <p className="mt-3 max-w-lg text-sm text-white/75">Seu e-mail ainda não está ligado a nenhuma empresa. Peça à equipe da Render Comex para cadastrá-lo no seu follow-up.</p>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 pb-20 pt-6">
        {clientes.isLoading || processos.isLoading ? (
          <div className="grid place-items-center py-20 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : clienteId ? (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {GRUPOS.map((g) => {
                const Icon = ICONE[g.key];
                return (
                  <button key={g.key} type="button" aria-pressed={filtro === g.key} onClick={() => setFiltro(filtro === g.key ? "todos" : g.key)}
                    className={cn("flex h-24 flex-col justify-between rounded-xl border bg-background p-4 text-left transition hover:border-foreground/20", filtro === g.key && "border-[#1E3A8A] ring-1 ring-[#1E3A8A]")}>
                    <span className="flex items-center justify-between"><span className="text-3xl font-semibold tabular-nums">{contagem[g.key]}</span><Icon className={cn("h-5 w-5", g.key === "entregue" ? "text-emerald-600" : g.key === "nao_embarcada" ? "text-amber-500" : "text-[#1E3A8A]")} /></span>
                    <span className="text-xs text-muted-foreground">{g.label}</span>
                  </button>
                );
              })}
            </div>

            {pendencias.length > 0 && (
              <section className="mt-6 rounded-r-xl border-l-4 border-amber-400 bg-amber-50 p-4 text-amber-950">
                <h2 className="flex items-center gap-2 text-sm font-semibold"><AlertTriangle className="h-4 w-4 text-amber-600" />Pendências com você ({pendencias.length})</h2>
                <ul className="mt-2 space-y-1 text-sm">
                  {pendencias.map((p) => <li key={p.id}><span className="font-mono text-xs">PO {p.po}</span> — {p.pendencia}</li>)}
                </ul>
              </section>
            )}

            <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
              <section className="space-y-4">
                {visiveis.length ? visiveis.map((p) => <ProcessoCard key={p.id} p={p} novo={novo(p.atualizado_em)} />)
                  : <p className="rounded-xl border border-dashed bg-background py-12 text-center text-sm text-muted-foreground">Nenhum processo neste filtro.</p>}
              </section>
              <aside>
                <h2 className="mb-3 text-sm font-semibold">Últimas atualizações</h2>
                {(feed.data ?? []).length ? (
                  <ol className="space-y-4">
                    {feed.data!.map((a) => {
                      const p = poDe.get(a.processo_id);
                      return (
                        <li key={a.id} className={cn("border-l-2 pl-3", novo(a.criado_em) ? "border-amber-400" : "border-[#1E3A8A]/25")}>
                          {p && <div className="font-mono text-[11px] text-[#1E3A8A]">PO {p.po} · {p.mercadoria}</div>}
                          <p className="text-sm">{a.mensagem}</p>
                          <div className="text-[11px] text-muted-foreground">{a.autor ?? "Render Comex"} · {formatDistanceToNow(new Date(a.criado_em), { locale: ptBR, addSuffix: true })}</div>
                        </li>
                      );
                    })}
                  </ol>
                ) : <p className="text-sm text-muted-foreground">Sem atualizações ainda.</p>}
              </aside>
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}
