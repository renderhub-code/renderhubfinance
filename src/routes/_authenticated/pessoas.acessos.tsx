import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Copy, Crown, Eraser, Loader2, Lock, Search, ShieldAlert, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PageHeader } from "@/components/os/page";
import { Notice } from "@/components/comex/ui";
import { WorkspaceAvatar } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { GROUP_COMPANIES, getCompany } from "@/os/companies";
import { adb, NIVEL_LABEL, PERFIS, recursosDe, useOs, type Escopo, type Nivel } from "@/os/acessos";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/pessoas/acessos")({
  head: () => ({ meta: [{ title: "Acessos · Pessoas — render.os" }] }),
  component: Acessos,
});

interface Usuario {
  id: string; nome: string; email: string; criado_em: string; ultimo_acesso: string | null;
  admin: boolean; cliente: boolean; acessos: { empresa: string; recurso: string; nivel: Nivel }[];
}
type Mapa = Record<string, Nivel>; // "empresa|recurso" -> nivel

const ESCOPOS: { id: Escopo; nome: string }[] = [
  ...GROUP_COMPANIES.map((c) => ({ id: c.id as Escopo, nome: c.name })),
  { id: "grupo", nome: "Grupo · IA" },
];
const chave = (e: string, r: string) => `${e}|${r}`;
const mapaDe = (u: Usuario): Mapa => Object.fromEntries(u.acessos.map((a) => [chave(a.empresa, a.recurso), a.nivel]));

function Acessos() {
  const os = useOs();
  if (os.loading) return <div className="grid min-h-[40vh] place-items-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  if (!os.admin) return <Notice icon={Lock} title="Somente administradores do render.os gerenciam acessos">Peça a um administrador para ajustar o seu acesso.</Notice>;
  return <Lista />;
}

function Lista() {
  const { user } = useAuth();
  const q = useQuery({
    queryKey: ["pessoas", "acessos"],
    queryFn: async () => {
      const { data, error } = await adb.rpc("acessos_usuarios");
      if (error) throw error;
      return (data ?? []) as Usuario[];
    },
  });
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<"todos" | "sem" | "admin" | "clientes">("todos");
  const [aberto, setAberto] = useState<Usuario | null>(null);
  const usuarios = q.data ?? [];
  const t = busca.trim().toLowerCase();
  const semAcesso = (u: Usuario) => !u.admin && !u.cliente && u.acessos.length === 0;
  const lista = usuarios
    .filter((u) => !t || `${u.nome} ${u.email}`.toLowerCase().includes(t))
    .filter((u) => filtro === "todos" || (filtro === "sem" ? semAcesso(u) : filtro === "admin" ? u.admin : u.cliente));
  const pendentes = usuarios.filter(semAcesso).length;

  if (q.error) {
    return <Notice icon={ShieldAlert} title="O novo controle de acessos ainda não está no banco">Rode o SQL <code className="rounded bg-muted px-1">acessos_por_aba</code> no SQL Editor do Supabase e recarregue.<span className="mt-2 block text-xs opacity-70">Detalhe: {(q.error as Error).message}</span></Notice>;
  }

  return (
    <div className="mx-auto max-w-[1200px]">
      <PageHeader eyebrow="Pessoas" title="Acessos" description="O que cada pessoa vê e edita, por empresa e por aba. Conta nova entra sem acesso." />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-72">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome ou e-mail…" className="pl-8" />
        </div>
        {([["todos", "Todos"], ["sem", `Sem acesso${pendentes ? ` (${pendentes})` : ""}`], ["admin", "Administradores"], ["clientes", "Clientes do portal"]] as const).map(([k, l]) => (
          <button key={k} type="button" onClick={() => setFiltro(k)}
            className={cn("rounded-full border px-3 py-1 text-xs font-medium", filtro === k ? "border-foreground bg-foreground text-background" : "bg-background text-muted-foreground hover:text-foreground")}>{l}</button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border bg-background">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">Pessoa</th>
              <th className="px-4 py-2.5 font-medium">Acesso</th>
              <th className="px-4 py-2.5 font-medium">Último acesso</th>
              <th className="w-24" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {q.isLoading && <tr><td colSpan={4} className="py-10 text-center text-muted-foreground"><Loader2 className="mx-auto h-4 w-4 animate-spin" /></td></tr>}
            {lista.map((u) => (
              <tr key={u.id} className="cursor-pointer hover:bg-muted/30" onClick={() => setAberto(u)}>
                <td className="px-4 py-2.5">
                  <div className="font-medium">{u.nome}{u.id === user?.id && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(você)</span>}</div>
                  <div className="text-xs text-muted-foreground">{u.email}</div>
                </td>
                <td className="px-4 py-2.5"><Resumo u={u} /></td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">{u.ultimo_acesso ? formatDistanceToNow(new Date(u.ultimo_acesso), { locale: ptBR, addSuffix: true }) : "nunca"}</td>
                <td className="px-4 py-2.5 text-right"><Button size="sm" variant="outline">Editar</Button></td>
              </tr>
            ))}
            {!q.isLoading && !lista.length && <tr><td colSpan={4} className="py-10 text-center text-muted-foreground">Ninguém neste filtro.</td></tr>}
          </tbody>
        </table>
      </div>

      {aberto && (
        <Editor key={aberto.id} u={aberto} souEu={aberto.id === user?.id} todos={usuarios}
          onClose={() => setAberto(null)} onSaved={() => { setAberto(null); void q.refetch(); }} />
      )}
    </div>
  );
}

/** Empresas e quantidade de abas liberadas, em chips. */
function Resumo({ u }: { u: Usuario }) {
  if (u.admin) return <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 ring-1 ring-inset ring-blue-600/15"><Crown className="h-3 w-3" />Administrador · tudo</span>;
  const por = new Map<string, number>();
  for (const a of u.acessos) por.set(a.empresa, (por.get(a.empresa) ?? 0) + 1);
  if (!por.size) {
    return u.cliente
      ? <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 ring-1 ring-inset ring-amber-600/20">Cliente do portal</span>
      : <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600 ring-1 ring-inset ring-zinc-500/15">Sem acesso</span>;
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {[...por].map(([e, n]) => (
        <span key={e} className="inline-flex items-center gap-1.5 rounded-md border bg-background py-0.5 pl-0.5 pr-2 text-[11px]">
          {e === "grupo" ? <span className="grid h-5 w-5 place-items-center rounded bg-violet-100 text-violet-700"><Sparkles className="h-3 w-3" /></span> : <WorkspaceAvatar id={e as Escopo} small />}
          {e === "grupo" ? "IA" : getCompany(e)?.name ?? e}
          <span className="text-muted-foreground">{n}</span>
        </span>
      ))}
    </div>
  );
}

function Editor({ u, souEu, todos, onClose, onSaved }: {
  u: Usuario; souEu: boolean; todos: Usuario[]; onClose: () => void; onSaved: () => void;
}) {
  const qc = useQueryClient();
  const original = useMemo(() => mapaDe(u), [u]);
  const [mapa, setMapa] = useState<Mapa>(original);
  const [admin, setAdmin] = useState(u.admin);
  const [escopo, setEscopo] = useState<Escopo>(() => (u.acessos[0]?.empresa as Escopo) ?? "render");
  const [salvando, setSalvando] = useState(false);

  const nivel = (e: Escopo, r: string): Nivel => mapa[chave(e, r)] ?? 0;
  const setNivel = (e: Escopo, r: string, n: Nivel) => setMapa((m) => {
    const x = { ...m };
    if (n === 0) delete x[chave(e, r)]; else x[chave(e, r)] = n;
    return x;
  });
  const contagem = (e: Escopo) => recursosDe(e).filter((r) => nivel(e, r.key) > 0).length;
  const recursos = recursosDe(escopo);
  const modulos = [...new Set(recursos.map((r) => r.modulo))];
  const perfis = PERFIS.filter((p) => p.escopos.includes(escopo));

  function aplicarPerfil(niveis: Record<string, Nivel>) {
    setMapa((m) => {
      const x = { ...m };
      for (const r of recursos) delete x[chave(escopo, r.key)];
      for (const [r, n] of Object.entries(niveis)) if (n > 0 && recursos.some((y) => y.key === r)) x[chave(escopo, r)] = n;
      return x;
    });
  }
  function todaColuna(n: Nivel) {
    setMapa((m) => {
      const x = { ...m };
      for (const r of recursos) { if (n === 0) delete x[chave(escopo, r.key)]; else x[chave(escopo, r.key)] = n; }
      return x;
    });
  }
  function copiarDe(id: string) {
    const outro = todos.find((x) => x.id === id);
    if (!outro) return;
    setMapa(mapaDe(outro));
    toast.message(`Acessos de ${outro.nome} copiados. Revise e salve.`);
  }

  async function salvar() {
    if (souEu && !admin) { toast.error("Você não pode tirar o próprio acesso de administrador."); return; }
    setSalvando(true);
    try {
      if (admin !== u.admin) {
        const r = admin
          ? await supabase.from("user_roles").insert({ user_id: u.id, role: "controller", company_id: null })
          : await supabase.from("user_roles").delete().eq("user_id", u.id).eq("role", "controller");
        if (r.error) throw r.error;
      }
      const sair = Object.keys(original).filter((k) => !(k in mapa));
      const gravar = Object.entries(mapa).filter(([k, n]) => original[k] !== n);
      for (const k of sair) {
        const [empresa, recurso] = k.split("|");
        const r = await adb.from("os_acessos").delete().eq("user_id", u.id).eq("empresa", empresa).eq("recurso", recurso);
        if (r.error) throw r.error;
      }
      if (gravar.length) {
        const r = await adb.from("os_acessos").upsert(gravar.map(([k, nivel]) => {
          const [empresa, recurso] = k.split("|");
          return { user_id: u.id, empresa, recurso, nivel };
        }));
        if (r.error) throw r.error;
      }
      toast.success(`Acessos de ${u.nome} salvos.`);
      void qc.invalidateQueries({ queryKey: ["os_acessos"] });
      void qc.invalidateQueries({ queryKey: ["render_os_perfil"] });
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  const mudou = admin !== u.admin || JSON.stringify(Object.entries(mapa).sort()) !== JSON.stringify(Object.entries(original).sort());

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-3xl">
        <SheetHeader className="border-b px-6 py-4 text-left">
          <SheetTitle>{u.nome}</SheetTitle>
          <p className="text-sm text-muted-foreground">{u.email}{u.cliente && " · cliente do portal da Render Comex"}</p>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <label className="flex items-start justify-between gap-4 rounded-xl border p-4">
            <span>
              <span className="flex items-center gap-1.5 text-sm font-semibold"><Crown className="h-4 w-4 text-blue-600" />Administrador do render.os</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">Vê e edita tudo, em todas as empresas, e gerencia os acessos das pessoas.</span>
            </span>
            <Switch checked={admin} onCheckedChange={setAdmin} disabled={souEu && u.admin} />
          </label>

          {admin ? (
            <p className="mt-6 text-center text-sm text-muted-foreground">Administradores têm acesso total; as abas abaixo não se aplicam.</p>
          ) : (
            <>
              <div className="mt-5 flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold">Por empresa</h3>
                <Select onValueChange={copiarDe}>
                  <SelectTrigger className="h-8 w-56 text-xs"><Copy className="mr-1.5 h-3.5 w-3.5" /><SelectValue placeholder="Copiar acessos de…" /></SelectTrigger>
                  <SelectContent>
                    {todos.filter((x) => x.id !== u.id && !x.admin && x.acessos.length).map((x) => <SelectItem key={x.id} value={x.id}>{x.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {ESCOPOS.map((e) => {
                  const n = contagem(e.id);
                  return (
                    <button key={e.id} type="button" onClick={() => setEscopo(e.id)}
                      className={cn("flex items-center gap-2 rounded-lg border py-1 pl-1 pr-2.5 text-xs transition",
                        escopo === e.id ? "border-foreground bg-foreground text-background" : "bg-background hover:bg-muted/50")}>
                      {e.id === "grupo" ? <span className="grid h-7 w-7 place-items-center rounded-md bg-violet-100 text-violet-700"><Sparkles className="h-3.5 w-3.5" /></span> : <WorkspaceAvatar id={e.id} small />}
                      <span className="font-medium">{e.nome}</span>
                      {n > 0 && <span className={cn("rounded-full px-1.5 text-[10px] font-semibold", escopo === e.id ? "bg-background/20" : "bg-muted")}>{n}</span>}
                    </button>
                  );
                })}
              </div>

              {perfis.length > 0 && (
                <div className="mt-5">
                  <div className="mb-2 text-xs font-medium text-muted-foreground">Perfis prontos</div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {perfis.map((p) => (
                      <button key={p.id} type="button" onClick={() => aplicarPerfil(p.niveis)}
                        className="rounded-lg border bg-background p-2.5 text-left transition hover:border-foreground/30 hover:bg-muted/30">
                        <div className="text-[13px] font-medium">{p.nome}</div>
                        <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{p.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-5 overflow-hidden rounded-xl border">
                <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
                  <span>Aba</span>
                  <span className="flex items-center gap-3">
                    <button type="button" className="hover:text-foreground" onClick={() => todaColuna(1)}>Tudo ver</button>
                    <button type="button" className="hover:text-foreground" onClick={() => todaColuna(2)}>Tudo editar</button>
                    <button type="button" className="flex items-center gap-1 hover:text-foreground" onClick={() => todaColuna(0)}><Eraser className="h-3 w-3" />Limpar</button>
                  </span>
                </div>
                {modulos.map((mod) => (
                  <div key={mod}>
                    <div className="bg-muted/10 px-4 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{mod}</div>
                    <ul className="divide-y">
                      {recursos.filter((r) => r.modulo === mod).map((r) => (
                        <li key={r.key} className="flex items-center justify-between gap-4 px-4 py-2.5">
                          <div className="min-w-0">
                            <div className="text-sm font-medium">{r.label}</div>
                            {r.edita && <div className="text-[11px] text-muted-foreground">Editar: {r.edita}</div>}
                          </div>
                          <Nivelador value={nivel(escopo, r.key)} onChange={(n) => setNivel(escopo, r.key, n)} />
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[11px] text-muted-foreground">
                Na visão “Grupo Render Hub” do financeiro, a pessoa vê o consolidado só das empresas em que tem a aba.
                {escopo === "union" && " No Operacional da Union, setor e papel (quem vê quais atividades) continuam em Operacional › Equipe."}
              </p>
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t px-6 py-3">
          <span className="text-xs text-muted-foreground">
            {admin ? "Acesso total" : `${Object.keys(mapa).length} aba(s) em ${new Set(Object.keys(mapa).map((k) => k.split("|")[0])).size} empresa(s)`}
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button onClick={() => void salvar()} disabled={salvando || !mudou}>{salvando ? "Salvando…" : "Salvar acessos"}</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Sem acesso · Ver · Editar */
function Nivelador({ value, onChange }: { value: Nivel; onChange: (n: Nivel) => void }) {
  const tom: Record<Nivel, string> = { 0: "bg-background text-foreground shadow-sm", 1: "bg-sky-600 text-white shadow-sm", 2: "bg-emerald-600 text-white shadow-sm" };
  return (
    <div className="inline-flex shrink-0 rounded-lg bg-muted p-0.5" role="radiogroup">
      {([0, 1, 2] as Nivel[]).map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} onClick={() => onChange(n)}
          className={cn("rounded-md px-2.5 py-1 text-xs font-medium transition", value === n ? tom[n] : "text-muted-foreground hover:text-foreground")}>
          {NIVEL_LABEL[n]}
        </button>
      ))}
    </div>
  );
}

