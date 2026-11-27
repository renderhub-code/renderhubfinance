import { createFileRoute, Navigate, Outlet, redirect } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, Loader2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { TrocarSenhaProvisoria } from "@/components/TrocarSenhaProvisoria";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  // getSession lê a sessão local (e renova o token se vencer), sem ir ao servidor
  // a cada troca de página. Os dados continuam protegidos pela RLS no banco.
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session?.user) throw redirect({ to: "/auth" });
    return { user: data.session.user };
  },
  component: Layout,
});

/** Quem é a pessoa logada: equipe interna (algum acesso) ou cliente do portal da Render Comex. */
function usePerfil(uid: string) {
  return useQuery({
    queryKey: ["render_os_perfil", uid],
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("render_os_perfil" as never);
      // Se o SQL ainda não rodou, não bloqueia ninguém.
      if (error || !data) return { interno: true, cliente: false };
      return data as unknown as { interno: boolean; cliente: boolean };
    },
  });
}

function Layout() {
  const qc = useQueryClient();
  const { user } = Route.useRouteContext();
  const perfil = usePerfil(user.id);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.rpc("bootstrap_first_controller");
        if (!cancelled && data === true) {
          qc.invalidateQueries({ queryKey: ["companies"] });
          qc.invalidateQueries({ queryKey: ["my_user_roles"] });
        }
      } catch {
        // idempotent; ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [qc]);

  // Senha definida por um administrador: a pessoa cria a própria antes de usar o sistema.
  if (user.app_metadata?.["senha_provisoria"] === true) return <TrocarSenhaProvisoria />;

  if (perfil.isLoading) {
    return <div className="grid h-screen place-items-center bg-sidebar text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }
  if (perfil.data && !perfil.data.interno) {
    if (perfil.data.cliente) return <Navigate to="/portal" search={{ c: undefined }} replace />;
    return <AcessoPendente />;
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

function AcessoPendente() {
  const qc = useQueryClient();
  async function sair() {
    await supabase.auth.signOut();
    qc.clear();
    window.location.href = "/auth";
  }
  return (
    <div className="grid h-screen place-items-center bg-sidebar p-6">
      <div className="max-w-md rounded-2xl border bg-background p-8 text-center">
        <span className="mx-auto mb-4 grid h-11 w-11 place-items-center rounded-full border bg-muted/40"><Clock className="h-5 w-5" strokeWidth={1.75} /></span>
        <h1 className="text-base font-semibold">Sua conta foi criada, falta liberar o acesso</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Peça a um controller do grupo para liberar você em <b>Pessoas › Acessos</b> (ou na equipe do módulo em que vai trabalhar).
          Se você é cliente da Render Comex, peça para a equipe cadastrar o seu e-mail no follow-up.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries({ queryKey: ["render_os_perfil"] })}>Verificar de novo</Button>
          <Button variant="ghost" size="sm" onClick={() => void sair()}><LogOut className="mr-1.5 h-4 w-4" />Sair</Button>
        </div>
      </div>
    </div>
  );
}
