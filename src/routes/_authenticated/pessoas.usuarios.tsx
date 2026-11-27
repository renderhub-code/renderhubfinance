import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { KeyRound, LayoutGrid, Loader2, Lock, Search, ShieldAlert, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader } from "@/components/os/page";
import { Notice } from "@/components/comex/ui";
import { useAuth } from "@/hooks/use-auth";
import { useOs } from "@/os/acessos";
import { criarUsuario, definirSenhaProvisoria, listarUsuarios, salvarEmpresasEModulos } from "@/os/usuarios.functions";
import { MODULOS_ACESSO, SELECAO_VAZIA, SENHA_MINIMA, modulosSemTela, resumoDoAcesso, selecaoDosAcessos, situacaoDaConta, type SelecaoAcesso, type UsuarioConta } from "@/os/usuarios";
import { GROUP_OPERATIONS, companiesByOperation } from "@/os/companies";
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
  const [acessoDe, setAcessoDe] = useState<UsuarioConta | null>(null);
  const [novo, setNovo] = useState(false);
  const t = busca.trim().toLowerCase();
  const lista = (q.data ?? []).filter((u) => !t || `${u.nome} ${u.email}`.toLowerCase().includes(t));

  if (q.error) return <Notice icon={ShieldAlert} title="Não foi possível carregar os usuários">Recarregue a página e tente de novo.</Notice>;

  return (
    <div>
      <PageHeader
        eyebrow="Pessoas"
        title="Usuários"
        description="Quem tem conta no render.os e o que cada pessoa vê. Escolha as marcas e os módulos de cada um e defina uma senha provisória para liberar a entrada."
        actions={<Button size="sm" onClick={() => setNovo(true)}><UserPlus className="mr-1.5 h-4 w-4" />Novo usuário</Button>}
      />

      <div className="relative mb-4 max-w-sm">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome ou e-mail…" className="pl-8" aria-label="Buscar usuário" />
      </div>

      <div className="overflow-x-auto rounded-xl border bg-background">
        <table className="w-full min-w-[920px] text-sm">
          <thead className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">Pessoa</th>
              <th className="px-4 py-2.5 font-medium">Acesso</th>
              <th className="px-4 py-2.5 font-medium">Situação</th>
              <th className="px-4 py-2.5 font-medium">Último acesso</th>
              <th className="w-[23rem]" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {q.isLoading && <tr><td colSpan={5} className="py-10 text-center text-muted-foreground"><Loader2 className="mx-auto h-4 w-4 animate-spin" /></td></tr>}
            {lista.map((u) => {
              const s = SITUACAO[situacaoDaConta(u)];
              return (
                <tr key={u.id}>
                  <td className="px-4 py-2.5">
                    <div className="font-medium">{u.nome}{u.id === user?.id && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(você)</span>}</div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                  </td>
                  <td className="max-w-[18rem] px-4 py-2.5 text-xs text-muted-foreground">{resumoDoAcesso(u.admin, u.acessos)}</td>
                  <td className="px-4 py-2.5"><span className={cn("whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset", s.classe)}>{s.rotulo}</span></td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{u.ultimo_acesso ? formatDistanceToNow(new Date(u.ultimo_acesso), { locale: ptBR, addSuffix: true }) : "nunca"}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right">
                    <Button size="sm" variant="outline" className="mr-2" onClick={() => setAcessoDe(u)} aria-label={`Empresas e módulos de ${u.nome}`}><LayoutGrid className="mr-1.5 h-3.5 w-3.5" />Empresas e módulos</Button>
                    <Button size="sm" variant="outline" onClick={() => setSenhaDe(u)} aria-label={`Senha provisória de ${u.nome}`}><KeyRound className="mr-1.5 h-3.5 w-3.5" />Senha provisória</Button>
                  </td>
                </tr>
              );
            })}
            {!q.isLoading && !lista.length && <tr><td colSpan={5} className="py-10 text-center text-muted-foreground">Nenhum usuário encontrado.</td></tr>}
          </tbody>
        </table>
      </div>

      {senhaDe && <SenhaDialog key={senhaDe.id} u={senhaDe} onClose={() => setSenhaDe(null)} />}
      {acessoDe && <AcessoDialog key={acessoDe.id} u={acessoDe} onClose={() => setAcessoDe(null)} />}
      {novo && <NovoDialog onClose={() => setNovo(false)} />}
    </div>
  );
}

/** Listas de marcar: marcas (por operação) e módulos. Usada em Empresas e módulos e em Novo usuário. */
function SelecaoCampos({ valor, onChange, prefixo }: { valor: SelecaoAcesso; onChange: (v: SelecaoAcesso) => void; prefixo: string }) {
  const semTela = modulosSemTela(valor);
  return (
    <div className="space-y-4">
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Marcas que pode ver</legend>
        <div className="space-y-2">
          {GROUP_OPERATIONS.map((op) => (
            <div key={op.id} className="grid grid-cols-[9.5rem_minmax(0,1fr)] items-start gap-2">
              <span className="pt-0.5 text-xs text-muted-foreground">{op.name}</span>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {companiesByOperation(op.id).map((c) => {
                  const id = `${prefixo}-marca-${c.id}`;
                  const marcada = valor.marcas.includes(c.id);
                  return (
                    <div key={c.id} className="flex items-center gap-2">
                      <Checkbox id={id} checked={marcada} onCheckedChange={(v) => onChange({ ...valor, marcas: v === true ? [...valor.marcas, c.id] : valor.marcas.filter((m) => m !== c.id) })} />
                      <Label htmlFor={id} className="font-normal">{c.name}</Label>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Módulos</legend>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {MODULOS_ACESSO.map((m) => {
            const id = `${prefixo}-modulo-${m.id}`;
            const estado = valor.modulos[m.id];
            return (
              <div key={m.id} className="flex items-center gap-2">
                <Checkbox id={id} checked={estado === "sim" ? true : estado === "parcial" ? "indeterminate" : false} className="data-[state=indeterminate]:bg-primary/25 data-[state=indeterminate]:text-primary" onCheckedChange={(v) => onChange({ ...valor, modulos: { ...valor.modulos, [m.id]: v === true ? "sim" : "nao" } })} />
                <Label htmlFor={id} className="font-normal">{m.rotulo}{estado === "parcial" && <span className="ml-1 text-xs text-muted-foreground">(parcial)</span>}</Label>
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Módulo marcado libera ver e editar todas as telas dele nas marcas marcadas. IA vale para o grupo inteiro.</p>
        {MODULOS_ACESSO.some((m) => valor.modulos[m.id] === "parcial") && <p className="mt-1 text-xs text-muted-foreground">Parcial: ajuste feito na aba Acessos. Fica como está, a menos que você marque ou desmarque o módulo.</p>}
        {semTela.includes("Operacional") && <p className="mt-1 text-xs text-amber-700">Operacional só existe na Union Contadores e na Render Comex; marque uma delas para liberar.</p>}
        {semTela.some((m) => m !== "Operacional") && <p className="mt-1 text-xs text-amber-700">Marque ao menos uma marca para liberar os módulos escolhidos.</p>}
      </fieldset>
    </div>
  );
}

function AcessoDialog({ u, onClose }: { u: UsuarioConta; onClose: () => void }) {
  const qc = useQueryClient();
  const salvarFn = useServerFn(salvarEmpresasEModulos);
  const [selecao, setSelecao] = useState<SelecaoAcesso>(() => selecaoDosAcessos(u.acessos));
  const salvar = useMutation({
    mutationFn: () => salvarFn({ data: { userId: u.id, selecao } }),
    onSuccess: async () => {
      await Promise.all([["pessoas", "usuarios"], ["pessoas", "acessos"], ["os_acessos"], ["render_os_perfil"]].map((queryKey) => qc.invalidateQueries({ queryKey })));
      toast.success(`Acessos de ${u.nome} salvos.`);
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível salvar os acessos."),
  });
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-xl">
        <form onSubmit={(e) => { e.preventDefault(); salvar.mutate(); }}>
          <DialogHeader>
            <DialogTitle>Empresas e módulos</DialogTitle>
            <DialogDescription>O que {u.nome} ({u.email}) vê e edita no render.os.</DialogDescription>
          </DialogHeader>
          <div className="my-4 space-y-4">
            {u.admin && <p className="rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-800 ring-1 ring-inset ring-blue-600/15">{u.nome} é administrador e vê tudo. O que você marcar aqui só passa a valer se deixar de ser administrador, na aba Acessos.</p>}
            <SelecaoCampos valor={selecao} onChange={setSelecao} prefixo="acesso" />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={salvar.isPending}>{salvar.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}Salvar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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
  const [selecao, setSelecao] = useState<SelecaoAcesso>(SELECAO_VAZIA);
  const atualizar = () => Promise.all([qc.invalidateQueries({ queryKey: ["pessoas", "usuarios"] }), qc.invalidateQueries({ queryKey: ["pessoas", "acessos"] })]);
  const salvar = useMutation({
    mutationFn: () => criar({ data: { nome, email, senha, selecao } }),
    onSuccess: async () => {
      await atualizar();
      toast.success("Usuário criado.");
      onClose();
    },
    onError: async (e) => {
      // A conta pode ter sido criada mesmo com falha ao gravar os acessos.
      await atualizar();
      toast.error(e instanceof Error ? e.message : "Não foi possível criar o usuário.");
    },
  });
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-xl">
        <form onSubmit={(e) => { e.preventDefault(); salvar.mutate(); }}>
          <DialogHeader>
            <DialogTitle>Novo usuário</DialogTitle>
            <DialogDescription>A pessoa entra com a senha provisória e cria a própria no primeiro acesso.</DialogDescription>
          </DialogHeader>
          <div className="my-4 space-y-3">
            <div className="space-y-1.5"><Label htmlFor="novo-nome">Nome</Label><Input id="novo-nome" value={nome} onChange={(e) => setNome(e.target.value)} required maxLength={120} /></div>
            <div className="space-y-1.5"><Label htmlFor="novo-email">E-mail</Label><Input id="novo-email" type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={255} /></div>
            <div className="space-y-1.5"><Label htmlFor="novo-senha">Senha provisória</Label><Input id="novo-senha" type="text" autoComplete="off" value={senha} onChange={(e) => setSenha(e.target.value)} required minLength={SENHA_MINIMA} placeholder={`Pelo menos ${SENHA_MINIMA} caracteres`} /></div>
            <SelecaoCampos valor={selecao} onChange={setSelecao} prefixo="novo" />
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
