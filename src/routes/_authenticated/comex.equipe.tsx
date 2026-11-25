import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { PageHeader } from "@/components/os/page";
import { Card, ComexGate } from "@/components/comex/ui";
import { useComexMe, xdb, type Membro, type Papel } from "@/os/comex/data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/comex/equipe")({
  head: () => ({ meta: [{ title: "Equipe · Render Comex — render.os" }] }),
  component: () => <ComexGate adminOnly><Equipe /></ComexGate>,
});

const LABEL: Record<Papel, string> = { admin: "Administrador", equipe: "Equipe" };

function Equipe() {
  const { user } = useComexMe();
  const lista = useQuery({
    queryKey: ["comex", "equipe"],
    queryFn: async () => {
      const { data, error } = await xdb.from("cs_equipe").select("*").order("nome");
      if (error) throw error;
      return (data ?? []) as Membro[];
    },
  });
  const usuarios = useQuery({
    queryKey: ["comex", "usuarios-disponiveis"],
    queryFn: async () => {
      const { data, error } = await xdb.rpc("cs_usuarios_disponiveis");
      if (error) throw error;
      return (data ?? []) as { id: string; nome: string; email: string }[];
    },
  });
  const ja = useMemo(() => new Set((lista.data ?? []).map((a) => a.user_id)), [lista.data]);
  const livres = (usuarios.data ?? []).filter((u) => !ja.has(u.id));
  const [sel, setSel] = useState<{ id: string; nome: string; email: string } | null>(null);
  const [papel, setPapel] = useState<Papel>("equipe");
  const refresh = () => { void lista.refetch(); };

  async function liberar() {
    if (!sel) return;
    const { error } = await xdb.from("cs_equipe").insert({ user_id: sel.id, nome: sel.nome, email: sel.email, papel });
    if (error) { toast.error(error.message); return; }
    toast.success(`${sel.nome} entrou na equipe do follow-up.`);
    setSel(null);
    refresh();
  }
  async function mudar(a: Membro, p: Papel) {
    if (a.user_id === user?.id && p !== "admin") { toast.error("Você não pode tirar o próprio acesso de administrador."); return; }
    const { error } = await xdb.from("cs_equipe").update({ papel: p }).eq("user_id", a.user_id);
    if (error) { toast.error(error.message); return; }
    refresh();
  }
  async function remover(a: Membro) {
    if (a.user_id === user?.id) { toast.error("Você não pode remover o próprio acesso."); return; }
    if (!confirm(`Tirar ${a.nome} da equipe do follow-up?`)) return;
    const { error } = await xdb.from("cs_equipe").delete().eq("user_id", a.user_id);
    if (error) { toast.error(error.message); return; }
    refresh();
  }

  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader eyebrow="Render Comex · Operacional" title="Equipe do follow-up" description="Quem atualiza as POs que os clientes acompanham." />
      <div className="mb-5 grid gap-3 text-xs text-muted-foreground sm:grid-cols-2">
        <p><b className="text-foreground">Administrador</b> gerencia a equipe e pode excluir clientes.</p>
        <p><b className="text-foreground">Equipe</b> cadastra clientes, cria e atualiza POs.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="overflow-hidden rounded-xl border bg-background">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
              <tr><th className="px-4 py-2.5 font-medium">Pessoa</th><th className="px-3 py-2.5 font-medium">Papel</th><th /></tr>
            </thead>
            <tbody className="divide-y">
              {(lista.data ?? []).map((a) => (
                <tr key={a.user_id}>
                  <td className="px-4 py-2.5">
                    <div className="font-medium">{a.nome}{a.user_id === user?.id && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(você)</span>}</div>
                    <div className="text-xs text-muted-foreground">{a.email}</div>
                  </td>
                  <td className="px-3 py-2">
                    <Select value={a.papel} onValueChange={(v) => void mudar(a, v as Papel)}>
                      <SelectTrigger className="h-8 w-40 text-[13px]"><SelectValue /></SelectTrigger>
                      <SelectContent>{(["admin", "equipe"] as Papel[]).map((p) => <SelectItem key={p} value={p}>{LABEL[p]}</SelectItem>)}</SelectContent>
                    </Select>
                  </td>
                  <td className="px-3 text-right">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => void remover(a)} aria-label="Remover"><Trash2 className="h-4 w-4" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Card title="Adicionar à equipe" sub="A pessoa precisa ter entrado no render.os uma vez.">
          <Command className="rounded-lg border">
            <CommandInput placeholder="Buscar por nome ou e-mail…" />
            <CommandList className="max-h-52">
              <CommandEmpty>{usuarios.isLoading ? "Carregando…" : "Ninguém disponível."}</CommandEmpty>
              {livres.map((u) => (
                <CommandItem key={u.id} value={`${u.nome} ${u.email}`} onSelect={() => setSel(u)} className={cn(sel?.id === u.id && "bg-primary/10")}>
                  <div><div className="text-sm">{u.nome}</div><div className="text-xs text-muted-foreground">{u.email}</div></div>
                </CommandItem>
              ))}
            </CommandList>
          </Command>
          <div className="mt-3">
            <Select value={papel} onValueChange={(v) => setPapel(v as Papel)}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>{(["equipe", "admin"] as Papel[]).map((p) => <SelectItem key={p} value={p}>{LABEL[p]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button className="mt-3 w-full" onClick={() => void liberar()} disabled={!sel}><UserPlus className="mr-1.5 h-4 w-4" /> {sel ? `Adicionar ${sel.nome.split(" ")[0]}` : "Adicionar"}</Button>
        </Card>
      </div>
    </div>
  );
}
