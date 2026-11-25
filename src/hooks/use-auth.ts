import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

/**
 * Sessão compartilhada entre todos os componentes. Depois da primeira leitura,
 * quem monta já recebe a sessão na hora — sem "carregando" a cada troca de página.
 */
let cached: Session | null | undefined;

export function useAuth() {
  const [session, setSession] = useState<Session | null>(cached ?? null);
  const [loading, setLoading] = useState(cached === undefined);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      cached = s;
      setSession(s);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data }) => {
      cached = data.session;
      setSession(data.session);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const user: User | null = session?.user ?? null;
  return { session, user, loading };
}
