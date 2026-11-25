import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";

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

function Layout() {
  const qc = useQueryClient();
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

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
