import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { PageHeader } from "@/components/os/page";
import { ContabilGate, FieldLabel } from "@/components/contabil/ui";
import { useContabilMe, useMembros, useSetores, useInvalidateContabil } from "@/os/contabil/hooks";
import { cdb, PAPEL_LABEL, type Membro, type Papel } from "@/os/contabil/db";
import { cn } from "@/lib/utils";
import { contabilHead } from "@/os/contabil/head";

export const Route = createFileRoute("/_authenticated/contabil/equipe")({
  head: () => contabilHead("Equipe", "Equipe, setores e acessos da contabilidade da Union no render.os."),
  component: () => <ContabilGate adminOnly><Equipe /></ContabilGate>,
});

const PAPEIS: Papel[] = ["admin", "coordenador", "analista"];

function Equipe() {
  const { membro: me } = useContabilMe();
  const { data: membros = [] } = useMembros();
  const { data: setores = [] } = useSetores();
  const invalidate = useInvalidateContabil();
  const [adding, setAdding] = useState(false);

  async function atualizar(m: Membro, patch: Partial<Membro>) {
    if (m.user_id === me?.user_id && (patch.papel && patch.papel !== "admin" || patch.ativo === false)) {
      toast.error("Você não pode tirar o próprio acesso de administrador.");
      return;
    }
    const { error } = await cdb.from("contabil_membros").update(patch).eq("user_id", m.user_id);
    if (error) { toast.error(error.message); return; }
    invalidate();
  }

  const ordenados = [...membros].sort((a, b) => Number(b.ativo) - Number(a.ativo) || a.nome.localeCompare(b.nome));

  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader
        eyebrow="Contábil"
        title="Equipe"
        description="Quem usa o módulo, em qual setor e com qual papel."
        actions={<Button onClick={() => setAdding(true)}><UserPlus className="mr-1.5 h-4 w-4" /> Adicionar pessoa</Button>}
      />

      <div className="mb-5 grid gap-3 text-xs text-muted-foreground sm:grid-cols-3">
        <p><b className="text-foreground">Administrador</b> vê e edita tudo, cadastra empresas, tipos e equipe.</p>
        <p><b className="text-foreground">Coordenador</b> vê e acompanha todas as atividades do próprio setor.</p>
        <p><b className="text-foreground">Analista</b> vê o que criou e o que está com ele. <b className="text-foreground">Atribuição geral</b> permite criar para qualquer setor.</p>
      </div>

      <div className="overflow-hidden rounded-xl border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">Pessoa</th>
              <th className="px-3 py-2.5 font-medium">Setor</th>
              <th className="px-3 py-2.5 font-medium">Papel</th>
              <th className="px-3 py-2.5 text-center font-medium">Atribuição geral</th>
              <th className="px-3 py-2.5 text-center font-medium">Ativo</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {ordenados.map((m) => (
              <tr key={m.user_id} className={cn(!m.ativo && "opacity-50")}>
                <td className="px-4 py-2.5">
                  <div className="font-medium">{m.nome}{m.user_id === me?.user_id && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(você)</span>}</div>
                  <div className="text-xs text-muted-foreground">{m.email}</div>
                </td>
                <td className="px-3 py-2">
                  <Select value={m.setor_id ?? "__none"} onValueChange={(v) => atualizar(m, { setor_id: v === "__none" ? null : v })}>
                    <SelectTrigger className="h-8 w-40 text-[13px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">Sem setor</SelectItem>
                      {setores.map((s) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-3 py-2">
                  <Select value={m.papel} onValueChange={(v) => atualizar(m, { papel: v as Papel })}>
                    <SelectTrigger className="h-8 w-36 text-[13px]"><SelectValue /></SelectTrigger>
                    <SelectContent>{PAPEIS.map((p) => <SelectItem key={p} value={p}>{PAPEL_LABEL[p]}</SelectItem>)}</SelectContent>
                  </Select>
                </td>
                <td className="px-3 py-2 text-center"><Switch checked={m.atribuicao_global} onCheckedChange={(v) => atualizar(m, { atribuicao_global: v })} /></td>
                <td className="px-3 py-2 text-center"><Switch checked={m.ativo} onCheckedChange={(v) => atualizar(m, { ativo: v })} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {adding && <AdicionarPessoa jaMembros={new Set(membros.map((m) => m.user_id))} onClose={() => setAdding(false)} />}
    </div>
  );
}

function AdicionarPessoa({ jaMembros, onClose }: { jaMembros: Set<string>; onClose: () => void }) {
  const { data: setores = [] } = useSetores();
  const invalidate = useInvalidateContabil();
  const { data: usuarios = [], isLoading } = useQuery({
    queryKey: ["contabil", "usuarios-disponiveis"],
    queryFn: async () => {
      const { data, error } = await cdb.rpc("contabil_usuarios_disponiveis");
      if (error) throw error;
      return (data ?? []) as { id: string; nome: string; email: string }[];
    },
  });
  const livres = useMemo(() => usuarios.filter((u) => !jaMembros.has(u.id)), [usuarios, jaMembros]);
  const [sel, setSel] = useState<{ id: string; nome: string; email: string } | null>(null);
  const [setor, setSetor] = useState("");
  const [papel, setPapel] = useState<Papel>("analista");
  const [saving, setSaving] = useState(false);

  async function salvar() {
    if (!sel) return;
    setSaving(true);
    const { error } = await cdb.from("contabil_membros").insert({
      user_id: sel.id, nome: sel.nome, email: sel.email, setor_id: setor || null, papel,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${sel.nome} entrou na equipe.`);
    invalidate();
    onClose();
  }

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">Adicionar pessoa ao Contábil</DialogTitle>
          <DialogDescription className="text-xs">A pessoa precisa já ter conta no render.os (entrar uma vez pela tela de login).</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <FieldLabel>Usuário</FieldLabel>
            <Command className="rounded-lg border">
              <CommandInput placeholder="Buscar por nome ou e-mail…" />
              <CommandList className="max-h-48">
                <CommandEmpty>{isLoading ? "Carregando…" : "Ninguém disponível."}</CommandEmpty>
                {livres.map((u) => (
                  <CommandItem key={u.id} value={`${u.nome} ${u.email}`} onSelect={() => setSel(u)} className={cn(sel?.id === u.id && "bg-primary/10")}>
                    <div><div className="text-sm">{u.nome}</div><div className="text-xs text-muted-foreground">{u.email}</div></div>
                  </CommandItem>
                ))}
              </CommandList>
            </Command>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Setor</FieldLabel>
              <Select value={setor} onValueChange={setSetor}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{setores.map((s) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <FieldLabel>Papel</FieldLabel>
              <Select value={papel} onValueChange={(v) => setPapel(v as Papel)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>{PAPEIS.map((p) => <SelectItem key={p} value={p}>{PAPEL_LABEL[p]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={salvar} disabled={!sel || saving}>{saving ? "Salvando…" : sel ? `Adicionar ${sel.nome.split(" ")[0]}` : "Adicionar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
