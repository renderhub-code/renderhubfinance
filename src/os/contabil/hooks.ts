import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useOs } from "@/os/acessos";
import { useAuth } from "@/hooks/use-auth";
import { cdb, type Atividade, type Categoria, type Cliente, type Membro, type Setor } from "./db";

/** Quem sou eu no Contábil. Faz o bootstrap do primeiro administrador. */
/** Abas administrativas: quem edita qualquer uma delas é administrador do Contábil. */
const CON_ADMIN = ["con.equipe", "con.cadastros", "con.bases", "con.importar"];

export function useContabilMe(enabled = true) {
  const { user, loading } = useAuth();
  const os = useOs();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["contabil", "me", user?.id],
    enabled: enabled && !!user?.id,
    queryFn: async () => {
      // Se o Contábil ainda não tem admin, quem entra primeiro assume.
      try { await cdb.rpc("contabil_bootstrap_admin"); } catch { /* tabelas ainda não criadas */ }
      const { data, error } = await cdb.from("contabil_membros").select("*").eq("user_id", user!.id).maybeSingle();
      if (error) return { membro: null as Membro | null, erro: error.message };
      return { membro: (data as Membro | null), erro: null as string | null };
    },
    staleTime: 60_000,
  });
  useEffect(() => {
    if (q.data?.membro) qc.invalidateQueries({ queryKey: ["contabil", "membros"] });
  }, [q.data?.membro, qc]);
  const membro = q.data?.membro && q.data.membro.ativo ? q.data.membro : null;
  return {
    user,
    loading: loading || q.isLoading,
    membro,
    erro: q.data?.erro ?? null,
    // Administrador do Contábil: papel admin na equipe ou "Editar" em Equipe (Pessoas › Acessos).
    isAdmin: !!membro && (membro.papel === "admin" || CON_ADMIN.some((r) => os.nivel("union", r) === 2)),
    isCoordenador: membro?.papel === "coordenador",
  };
}

export function useSetores(enabled = true) {
  return useQuery({
    queryKey: ["contabil", "setores"],
    enabled,
    queryFn: async () => {
      const { data, error } = await cdb.from("contabil_setores").select("*").order("ordem").order("nome");
      if (error) throw error;
      return (data ?? []) as Setor[];
    },
  });
}

export function useCategorias(enabled = true) {
  return useQuery({
    queryKey: ["contabil", "categorias"],
    enabled,
    queryFn: async () => {
      const { data, error } = await cdb.from("contabil_categorias").select("*").eq("ativo", true).order("ordem").order("nome");
      if (error) throw error;
      return (data ?? []) as Categoria[];
    },
  });
}

export function useClientes(enabled = true) {
  return useQuery({
    queryKey: ["contabil", "clientes"],
    enabled,
    queryFn: async () => {
      const { data, error } = await cdb.from("contabil_clientes").select("*").order("razao_social");
      if (error) throw error;
      return (data ?? []) as Cliente[];
    },
    staleTime: 5 * 60_000,
  });
}

export function useMembros(enabled = true) {
  return useQuery({
    queryKey: ["contabil", "membros"],
    enabled,
    queryFn: async () => {
      const { data, error } = await cdb.from("contabil_membros").select("*").order("nome");
      if (error) throw error;
      return (data ?? []) as Membro[];
    },
  });
}

export function useAtividades(enabled = true) {
  return useQuery({
    queryKey: ["contabil", "atividades"],
    enabled,
    queryFn: async () => {
      const { data, error } = await cdb
        .from("contabil_atividades")
        .select("*")
        .order("prioridade", { ascending: true })
        .order("prazo", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as Atividade[];
    },
  });
}

export function useCiencias(enabled = true) {
  return useQuery({
    queryKey: ["contabil", "ciencias"],
    enabled,
    queryFn: async () => {
      const { data } = await cdb.from("contabil_ciencias").select("atividade_id, user_id, ciente_em");
      const map = new Map<string, string>();
      for (const c of (data ?? []) as { atividade_id: string; user_id: string; ciente_em: string }[]) {
        map.set(`${c.atividade_id}:${c.user_id}`, c.ciente_em);
      }
      return map;
    },
  });
}

/** Invalida tudo que depende das atividades. */
export function useInvalidateContabil() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["contabil"] });
}
