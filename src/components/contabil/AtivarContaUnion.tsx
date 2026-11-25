import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { isUnionAccount } from "@/os/contabil/union.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AtivarContaUnion({ onDone, onCancel }: { onDone: () => Promise<void>; onCancel: () => void }) {
  const checkAccount = useServerFn(isUnionAccount);
  const [ready, setReady] = useState(false);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          const { data: identity } = await supabase.auth.getUser();
          if (identity.user?.email_confirmed_at && await checkAccount({ data: undefined })) {
            if (active) setReady(true);
          }
        }
      } catch { if (active) setError("Não foi possível confirmar a conta. Solicite um novo link."); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [checkAccount]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setLoading(true); setError("");
    const fd = new FormData(e.currentTarget);
    try {
      if (ready) {
        const password = String(fd.get("password"));
        if (password !== String(fd.get("confirmation"))) throw new Error("As senhas precisam ser iguais.");
        const { error: updateError } = await supabase.auth.updateUser({ password });
        if (updateError) throw updateError;
        await onDone();
      } else {
        const { error: sendError } = await supabase.auth.resetPasswordForEmail(String(fd.get("email")), { redirectTo: `${window.location.origin}/auth?ativar=union` });
        if (sendError) throw sendError;
        setSent(true);
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível ativar a conta."); }
    finally { setLoading(false); }
  }
  return <div className="space-y-4">
    <h2 className="text-lg font-semibold">{ready ? "Defina sua nova senha" : "Ativar conta Union"}</h2>
    {sent ? <p role="status" className="text-sm text-muted-foreground">Se seu e-mail está na base da Union, você receberá um link para confirmar o acesso e escolher a nova senha.</p> : <form className="space-y-4" onSubmit={(e) => void submit(e)}>
      {ready ? <><div className="space-y-2"><Label htmlFor="union-password">Nova senha</Label><Input id="union-password" name="password" type="password" autoComplete="new-password" minLength={8} required /></div><div className="space-y-2"><Label htmlFor="union-confirmation">Confirmar senha</Label><Input id="union-confirmation" name="confirmation" type="password" autoComplete="new-password" minLength={8} required /></div></> : <div className="space-y-2"><Label htmlFor="union-email">E-mail da Union</Label><Input id="union-email" name="email" type="email" autoComplete="email" required /></div>}
      <Button type="submit" className="w-full" disabled={loading}>{loading ? "Aguarde…" : ready ? "Salvar senha e entrar" : "Enviar link de ativação"}</Button>
    </form>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <Button type="button" variant="ghost" className="w-full" onClick={onCancel}>Voltar para entrar</Button>
  </div>;
}