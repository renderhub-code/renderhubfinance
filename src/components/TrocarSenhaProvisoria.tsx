import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound, Loader2, LogOut } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { trocarSenhaProvisoria } from "@/os/usuarios.functions";
import { SENHA_MINIMA } from "@/os/usuarios";

/** Primeiro acesso com senha provisória: a pessoa cria a senha definitiva antes de entrar. */
export function TrocarSenhaProvisoria() {
  const trocar = useServerFn(trocarSenhaProvisoria);
  const [senha, setSenha] = useState("");
  const [repete, setRepete] = useState("");
  const salvar = useMutation({
    mutationFn: async () => {
      await trocar({ data: { senha } });
      // Renova a sessão para ela já vir sem a marca de senha provisória.
      const { error } = await supabase.auth.refreshSession();
      if (error) await supabase.auth.signOut();
      return !error;
    },
    onSuccess: (continua) => {
      toast.success(continua ? "Senha criada." : "Senha criada. Entre de novo com ela.");
      window.location.href = continua ? "/inicio" : "/auth";
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível salvar a nova senha."),
  });
  const curta = senha.length > 0 && senha.length < SENHA_MINIMA;
  const diferente = repete.length > 0 && repete !== senha;
  const pronto = senha.length >= SENHA_MINIMA && repete === senha;

  async function sair() {
    await supabase.auth.signOut();
    window.location.href = "/auth";
  }

  return (
    <div className="grid min-h-screen place-items-center bg-sidebar p-6">
      <form
        className="w-full max-w-sm rounded-2xl border bg-background p-8"
        onSubmit={(e) => { e.preventDefault(); if (pronto) salvar.mutate(); }}
      >
        <span className="mb-4 grid h-11 w-11 place-items-center rounded-full border bg-muted/40"><KeyRound className="h-5 w-5" strokeWidth={1.75} /></span>
        <h1 className="text-base font-semibold">Crie a sua senha</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">Você entrou com uma senha provisória. Escolha uma senha só sua para continuar.</p>
        <div className="mt-5 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="nova-senha">Nova senha</Label>
            <Input id="nova-senha" type="password" autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} required minLength={SENHA_MINIMA} />
            {curta && <p className="text-xs text-destructive">Use pelo menos {SENHA_MINIMA} caracteres.</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="repete-senha">Repita a nova senha</Label>
            <Input id="repete-senha" type="password" autoComplete="new-password" value={repete} onChange={(e) => setRepete(e.target.value)} required />
            {diferente && <p className="text-xs text-destructive">As senhas não são iguais.</p>}
          </div>
        </div>
        <Button type="submit" className="mt-5 w-full" disabled={!pronto || salvar.isPending}>
          {salvar.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}Salvar e entrar
        </Button>
        <Button type="button" variant="ghost" size="sm" className="mt-2 w-full" onClick={() => void sair()}><LogOut className="mr-1.5 h-4 w-4" />Sair</Button>
      </form>
    </div>
  );
}
