import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { KeyRound, Loader2, Lock, Search, ShieldAlert, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader } from "@/components/os/page";
import { Notice } from "@/components/comex/ui";
import { useAuth } from "@/hooks/use-auth";
import { useOs } from "@/os/acessos";
import { criarUsuario, definirSenhaProvisoria, listarUsuarios } from "@/os/usuarios.functions";
import { SENHA_MINIMA, situacaoDaConta, type UsuarioConta } from "@/os/usuarios";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/pessoas/usuarios")({
  head: () => ({ meta: [{ title: "Usuários · Pessoas — render.os" }] }),
  component: Usuarios,
});

const SITUACAO: Record<ReturnType<typeof situacaoDaConta>, { rotulo: string; classe: string }> = {
  pendente: { rotulo: "Sem senha · não consegue entrar", classe: "bg-zinc-100 text-zinc-600 ring-zinc-500/15" },
  provisoria: { rotulo: "Senha provisória", classe: "bg-amber-50 text-amber-800 ring-amber-600/20" },
  "nunca-entrou": { rotulo: "Ainda não entrou", classe: "bg-zinc-100 text-zinc-600 ring-zinc-500/15" },
  ativa: { rotulo: "Ativa", classe: "bg-emerald-50 text-emerald-700 ring-emerald-600/15" },
};

function Usuarios() {
  const os = useOs();
  if (os.loading) return <div className="grid min-h-[40vh] place-items-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  if (!os.admin) return <Notice icon={Lock} title="Somente administradores do render.os gerenciam usuários">Peça a um administrador para ajustar a sua conta.</Notice>;
  return <Lista />;
}

function Lista() {
  const { user } = useAuth();
  const listar = useServerFn(listarUsuarios);
  const q = useQuery({ queryKey: ["pessoas", "usuarios"], queryFn: () => listar() });
  const [busca, setBusca] = useState("");
  const [senhaDe, setSenhaDe] = useState<UsuarioConta | null>(null);
  const [novo, setNovo] = useState(false);
  const t = busca.trim().toLowerCase();
  const lista = (q.data ?? []).filter((u) => !t || `${u.nome} ${u.email}`.toLowerCase().includes(t));

  if (q.error) return <Notice icon={ShieldAlert} title="Não foi possível carregar os usuários">Recarregue a página e tente de novo.</Notice>;

  return (
    <div>
      <PageHeader
        eyebrow="Pessoas"
        title="Usuários"
        description="Quem tem conta no render.os. Defina uma senha provisória para liberar a entrada; a pessoa cria a própria senha no primeiro acesso."
        actions={<Button size="sm" onClick={() => setNovo(true)}><UserPlus className="mr-1.5 h-4 w-4" />Novo usuário</Button>}
      />

      <div className="relative mb-4 max-w-sm">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome ou e-mail…" className="pl-8" aria-label="Buscar usuário" />
      </div>

      <div className="overflow-x-auto rounded-xl border bg-background">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">Pessoa</th>
              <th className="px-4 py-2.5 font-medium">Situação</th>
              <th className="px-4 py-2.5 font-medium">Último acesso</th>
              <th className="w-48" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {q.isLoading && <tr><td colSpan={4} className="py-10 text-center text-muted-foreground"><Loader2 className="mx-auto h-4 w-4 animate-spin" /></td></tr>}
            {lista.map((u) => {
              const s = SITUACAO[situacaoDaConta(u)];
              return (
                <tr key={u.id}>
                  <td className="px-4 py-2.5">
                    <div className="font-medium">{u.nome}{u.id === user?.id && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(você)</span>}</div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                  </td>
                  <td className="px-4 py-2.5"><span className={cn("rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset", s.classe)}>{s.rotulo}</span></td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{u.ultimo_acesso ? formatDistanceToNow(new Date(u.ultimo_acesso), { locale: ptBR, addSuffix: true }) : "nunca"}</td>
                  <td className="px-4 py-2.5 text-right">
                    <Button size="sm" variant="outline" onClick={() => setSenhaDe(u)} aria-label={`Senha provisória de ${u.nome}`}><KeyRound className="mr-1.5 h-3.5 w-3.5" />Senha provisória</Button>
                  </td>
                </tr>
              );
            })}
            {!q.isLoading && !lista.length && <tr><td colSpan={4} className="py-10 text-center text-muted-foreground">Nenhum usuário encontrado.</td></tr>}
          </tbody>
        </table>
      </div>

      {senhaDe && <SenhaDialog key={senhaDe.id} u={senhaDe} onClose={() => setSenhaDe(null)} />}
      {novo && <NovoDialog onClose={() => setNovo(false)} />}
    </div>
  );
}

function SenhaDialog({ u, onClose }: { u: UsuarioConta; onClose: () => void }) {
  const qc = useQueryClient();
  const definir = useServerFn(definirSenhaProvisoria);
  const [senha, setSenha] = useState("");
  const salvar = useMutation({
    mutationFn: () => definir({ data: { userId: u.id, senha } }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["pessoas", "usuarios"] });
      toast.success(`Senha provisória definida para ${u.nome}.`);
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível definir a senha."),
  });
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <form onSubmit={(e) => { e.preventDefault(); salvar.mutate(); }}>
          <DialogHeader>
            <DialogTitle>Senha provisória</DialogTitle>
            <DialogDescription>{u.nome} ({u.email}) entra com esta senha e cria a própria no primeiro acesso. A senha atual deixa de valer.</DialogDescription>
          </DialogHeader>
          <div className="my-4 space-y-1.5">
            <Label htmlFor="senha-prov">Senha provisória</Label>
            <Input id="senha-prov" type="text" autoComplete="off" value={senha} onChange={(e) => setSenha(e.target.value)} required minLength={SENHA_MINIMA} placeholder={`Pelo menos ${SENHA_MINIMA} caracteres`} />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={senha.length < SENHA_MINIMA || salvar.isPending}>{salvar.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}Definir senha</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function NovoDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const criar = useServerFn(criarUsuario);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const salvar = useMutation({
    mutationFn: () => criar({ data: { nome, email, senha } }),
    onSuccess: async () => {
      await Promise.all([qc.invalidateQueries({ queryKey: ["pessoas", "usuarios"] }), qc.invalidateQueries({ queryKey: ["pessoas", "acessos"] })]);
      toast.success("Usuário criado.");
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível criar o usuário."),
  });
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <form onSubmit={(e) => { e.preventDefault(); salvar.mutate(); }}>
          <DialogHeader>
            <DialogTitle>Novo usuário</DialogTitle>
            <DialogDescription>A pessoa entra com a senha provisória e cria a própria no primeiro acesso.</DialogDescription>
          </DialogHeader>
          <div className="my-4 space-y-3">
            <div className="space-y-1.5"><Label htmlFor="novo-nome">Nome</Label><Input id="novo-nome" value={nome} onChange={(e) => setNome(e.target.value)} required maxLength={120} /></div>
            <div className="space-y-1.5"><Label htmlFor="novo-email">E-mail</Label><Input id="novo-email" type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={255} /></div>
            <div className="space-y-1.5"><Label htmlFor="novo-senha">Senha provisória</Label><Input id="novo-senha" type="text" autoComplete="off" value={senha} onChange={(e) => setSenha(e.target.value)} required minLength={SENHA_MINIMA} placeholder={`Pelo menos ${SENHA_MINIMA} caracteres`} /></div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={nome.trim().length < 2 || !email || senha.length < SENHA_MINIMA || salvar.isPending}>{salvar.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}Criar usuário</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
