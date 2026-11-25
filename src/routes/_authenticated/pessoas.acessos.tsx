import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, Lock, Search, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PageHeader } from "@/components/os/page";
import { Notice } from "@/components/comex/ui";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useCompanies, useUserRoles } from "@/lib/queries";
import { xdb } from "@/os/comex/data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/pessoas/acessos")({
  head: () => ({ meta: [{ title: "Acessos · Pessoas — render.os" }] }),
  component: Acessos,
});

type Role = "controller" | "financial_manager" | "ceo_viewer";
type Nivel = Role | "nenhum";
interface Usuario {
  id: string; nome: string; email: string; criado_em: string; ultimo_acesso: string | null;
  papeis: { id: string; role: Role; company_id: string | null }[]; empresas: string[];
}

const NIVEL: Record<Nivel, { label: string; desc: string }> = {
  nenhum: { label: "Sem acesso", desc: "Não vê o financeiro. Pode ter acesso a outros módulos (IA, Operacional) dados lá." },
  controller: { label: "Controller", desc: "Vê e edita o financeiro de todas as empresas e gerencia acessos." },
  financial_manager: { label: "Gestor financeiro", desc: "Vê e edita o financeiro das empresas marcadas." },
  ceo_viewer: { label: "CEO (leitura)", desc: "Só acompanha o financeiro das empresas marcadas." },
};
const ORDEM: Role[] = ["controller", "financial_manager", "ceo_viewer"];
const nivelDe = (u: Usuario): Nivel => ORDEM.find((r) => u.papeis.some((p) => p.role === r)) ?? "nenhum";

function Acessos() {
  const { data: roles, isLoading } = useUserRoles();
  if (isLoading) return <div className="grid min-h-[40vh] place-items-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  if (!roles?.some((r) => r.role === "controller")) {
    return <Notice icon={Lock} title="Somente controllers gerenciam acessos">Peça a um controller do grupo para ajustar o seu acesso.</Notice>;
  }
  return <Lista />;
}

function Lista() {
  const { user } = useAuth();
  const { data: companies = [] } = useCompanies();
  const q = useQuery({
    queryKey: ["pessoas", "acessos"],
    queryFn: async () => {
      const { data, error } = await xdb.rpc("acessos_usuarios");
      if (error) throw error;
      return (data ?? []) as Usuario[];
    },
  });
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState<Usuario | null>(null);
  const nomeEmpresa = useMemo(() => new Map(companies.map((c) => [c.id, c.name])), [companies]);
  const usuarios = q.data ?? [];
  const pendentes = usuarios.filter((u) => nivelDe(u) === "nenhum");
  const t = busca.trim().toLowerCase();
  const lista = usuarios.filter((u) => !t || `${u.nome} ${u.email}`.toLowerCase().includes(t));

  if (q.error) {
    return <Notice icon={ShieldAlert} title="A tela de acessos ainda não está no banco">Rode o SQL <code className="rounded bg-muted px-1">acesso_e_followup_comex</code> no SQL Editor do Supabase e recarregue.<span className="mt-2 block text-xs opacity-70">Detalhe: {(q.error as Error).message}</span></Notice>;
  }

  return (
    <div className="mx-auto max-w-[1200px]">
      <PageHeader eyebrow="Pessoas" title="Acessos ao financeiro" description="Conta nova entra sem acesso. Aqui um controller libera o que cada pessoa vê." />

      {pendentes.length > 0 && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <b>{pendentes.length}</b> pessoa(s) sem acesso ao financeiro. Clientes do portal da Render Comex também aparecem aqui; deixe-os sem acesso.
        </div>
      )}

      <div className="relative mb-3 max-w-sm">
        <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome ou e-mail…" className="pl-8" />
      </div>

      <div className="overflow-hidden rounded-xl border bg-background">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">Pessoa</th>
              <th className="px-4 py-2.5 font-medium">Financeiro</th>
              <th className="px-4 py-2.5 font-medium">Empresas</th>
              <th className="px-4 py-2.5 font-medium">Último acesso</th>
              <th className="w-24" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {q.isLoading && <tr><td colSpan={5} className="py-10 text-center text-muted-foreground"><Loader2 className="mx-auto h-4 w-4 animate-spin" /></td></tr>}
            {lista.map((u) => {
              const n = nivelDe(u);
              return (
                <tr key={u.id}>
                  <td className="px-4 py-2.5">
                    <div className="font-medium">{u.nome}{u.id === user?.id && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(você)</span>}</div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={cn("inline-flex rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
                      n === "nenhum" ? "bg-zinc-100 text-zinc-600 ring-zinc-500/15" : n === "controller" ? "bg-blue-50 text-blue-700 ring-blue-600/15" : "bg-emerald-50 text-emerald-700 ring-emerald-600/15")}>
                      {NIVEL[n].label}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">
                    {n === "controller" ? "Todas" : u.empresas.length ? u.empresas.map((id) => nomeEmpresa.get(id) ?? "—").join(", ") : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{u.ultimo_acesso ? formatDistanceToNow(new Date(u.ultimo_acesso), { locale: ptBR, addSuffix: true }) : "nunca"}</td>
                  <td className="px-4 py-2.5 text-right"><Button size="sm" variant="outline" onClick={() => setAberto(u)}>Editar</Button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {aberto && <Editor u={aberto} souEu={aberto.id === user?.id} companies={companies} onClose={() => setAberto(null)} onSaved={() => { setAberto(null); void q.refetch(); }} />}
    </div>
  );
}

function Editor({ u, souEu, companies, onClose, onSaved }: {
  u: Usuario; souEu: boolean; companies: { id: string; name: string }[]; onClose: () => void; onSaved: () => void;
}) {
  const [nivel, setNivel] = useState<Nivel>(nivelDe(u));
  const [empresas, setEmpresas] = useState<Set<string>>(new Set(u.empresas));
  const [salvando, setSalvando] = useState(false);
  const precisaEmpresa = nivel === "financial_manager" || nivel === "ceo_viewer";

  async function salvar() {
    if (souEu && nivel !== "controller") { toast.error("Você não pode tirar o próprio acesso de controller."); return; }
    if (precisaEmpresa && empresas.size === 0) { toast.error("Marque ao menos uma empresa."); return; }
    setSalvando(true);
    try {
      // Papéis: troca tudo pelo nível escolhido (global; o escopo vem das empresas).
      const del = nivel === "nenhum"
        ? await supabase.from("user_roles").delete().eq("user_id", u.id)
        : await supabase.from("user_roles").delete().eq("user_id", u.id).neq("role", nivel);
      if (del.error) throw del.error;
      if (nivel !== "nenhum" && !u.papeis.some((p) => p.role === nivel && p.company_id === null)) {
        const ins = await supabase.from("user_roles").insert({ user_id: u.id, role: nivel, company_id: null });
        if (ins.error) throw ins.error;
      }
      // Empresas: só para gestor e CEO; controller vê todas.
      const alvo = precisaEmpresa ? empresas : new Set<string>();
      const sair = u.empresas.filter((id) => !alvo.has(id));
      const entrar = [...alvo].filter((id) => !u.empresas.includes(id));
      if (sair.length) {
        const r = await supabase.from("user_companies").delete().eq("user_id", u.id).in("company_id", sair);
        if (r.error) throw r.error;
      }
      if (entrar.length) {
        const r = await supabase.from("user_companies").insert(entrar.map((company_id) => ({ user_id: u.id, company_id })));
        if (r.error) throw r.error;
      }
      toast.success(`Acesso de ${u.nome} atualizado.`);
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader><SheetTitle>{u.nome}</SheetTitle><p className="text-sm text-muted-foreground">{u.email}</p></SheetHeader>
        <div className="mt-6 space-y-5 px-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Acesso ao financeiro</label>
            <Select value={nivel} onValueChange={(v) => setNivel(v as Nivel)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{(["nenhum", ...ORDEM] as Nivel[]).map((n) => <SelectItem key={n} value={n}>{NIVEL[n].label}</SelectItem>)}</SelectContent>
            </Select>
            <p className="mt-1.5 text-xs text-muted-foreground">{NIVEL[nivel].desc}</p>
          </div>
          {precisaEmpresa && (
            <div>
              <label className="mb-2 block text-xs font-medium text-muted-foreground">Empresas</label>
              <ul className="space-y-2">
                {companies.map((c) => (
                  <li key={c.id}>
                    <label className="flex items-center gap-2.5 text-sm">
                      <Checkbox checked={empresas.has(c.id)} onCheckedChange={(v) => {
                        const s = new Set(empresas); if (v) s.add(c.id); else s.delete(c.id); setEmpresas(s);
                      }} />
                      {c.name}
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
            IA, Operacional da Union e follow-up da Render Comex têm acesso próprio, liberado na tela de equipe/acesso de cada módulo.
          </p>
          <Button className="w-full" onClick={() => void salvar()} disabled={salvando}>{salvando ? "Salvando…" : "Salvar acesso"}</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
