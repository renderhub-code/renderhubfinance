import { useQuery } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { WorkspaceId } from "./companies";
import { TODAS, type AcessoRow, type Escopo, type Nivel } from "./recursos";
import { getHub, useHubStore } from "@/lib/hub-store";

export * from "./recursos";

/** Cliente sem tipagem gerada para os_acessos / RPCs novas. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const adb = supabase as unknown as SupabaseClient<any>;


/** Perfis prontos: aplicam um conjunto de níveis numa empresa de uma vez. */
export interface Perfil { id: string; nome: string; desc: string; escopos: Escopo[]; niveis: Record<string, Nivel> }
const fin = (n: Nivel, extra: Record<string, Nivel> = {}) => ({
  "fin.dashboard": n, "fin.lancamentos": n, "fin.fluxo": n, "fin.simulacoes": n, "fin.plano": n, "fin.centros": n, "fin.bling": n, ...extra,
});
export const PERFIS: Perfil[] = [
  { id: "fin-gestor", nome: "Financeiro", desc: "Vê e edita todo o financeiro da empresa.", escopos: TODAS, niveis: fin(2) },
  { id: "fin-ceo", nome: "Diretoria (leitura)", desc: "Acompanha o financeiro sem editar.", escopos: TODAS, niveis: fin(1) },
  { id: "fin-lanca", nome: "Lançador", desc: "Lança movimentos; o resto só vê.", escopos: TODAS, niveis: fin(1, { "fin.lancamentos": 2, "fin.plano": 1 }) },
  { id: "con-analista", nome: "Analista contábil", desc: "Painel e atividades; vê as empresas clientes.", escopos: ["union"], niveis: { "con.painel": 2, "con.atividades": 2, "con.agenda": 1, "con.clientes": 1 } },
  { id: "con-admin", nome: "Administrador do Contábil", desc: "Todas as abas da Union, incluindo equipe e importações.", escopos: ["union"], niveis: { "con.painel": 2, "con.atividades": 2, "con.agenda": 2, "con.clientes": 2, "con.equipe": 2, "con.cadastros": 2, "con.bases": 2, "con.importar": 2 } },
  { id: "cx-equipe", nome: "Equipe Comex", desc: "Atualiza POs e cadastra clientes do portal.", escopos: ["render"], niveis: { "cx.followup": 2, "cx.clientes": 2 } },
  { id: "cx-leitura", nome: "Comex (leitura)", desc: "Acompanha o follow-up sem editar.", escopos: ["render"], niveis: { "cx.followup": 1, "cx.clientes": 1 } },
  { id: "rh-gestor", nome: "RH", desc: "Vê e edita todo o RH da empresa, incluindo salários e ASO.", escopos: TODAS, niveis: { "rh.painel": 2, "rh.colaboradores": 2, "rh.remuneracao": 2, "rh.calendario": 2, "rh.avaliacoes": 2, "rh.aso": 2, "rh.pj": 2, "rh.documentos": 2 } },
  { id: "rh-diretoria", nome: "Diretoria (RH, leitura)", desc: "Painel, custos, avaliações e contratos, sem editar e sem dados de saúde.", escopos: TODAS, niveis: { "rh.painel": 1, "rh.colaboradores": 1, "rh.remuneracao": 1, "rh.calendario": 1, "rh.avaliacoes": 1, "rh.pj": 1, "rh.documentos": 1 } },
  { id: "rh-gestor-area", nome: "Gestor de área", desc: "Vê a equipe e registra avaliações; sem salários nem saúde.", escopos: TODAS, niveis: { "rh.colaboradores": 1, "rh.avaliacoes": 2, "rh.calendario": 1 } },
  { id: "ia-time", nome: "Time de IA", desc: "Edita entregas, diário e treinamento.", escopos: ["grupo"], niveis: { "ia.visao": 2, "ia.entregas": 2, "ia.empresas": 2, "ia.treinamento": 2 } },
  { id: "ia-leitor", nome: "Acompanha a IA", desc: "Só acompanha o departamento de IA.", escopos: ["grupo"], niveis: { "ia.visao": 1, "ia.entregas": 1, "ia.empresas": 1, "ia.treinamento": 1 } },
];


/**
 * Permissões da pessoa logada. Administrador do render.os (controller) pode tudo.
 * Enquanto carrega, `loading` é true e `pode` responde true para não esconder telas à toa.
 */
export function useOs() {
  const { user, loading: authLoading } = useAuth();
  const q = useQuery({
    queryKey: ["os_acessos", user?.id],
    enabled: !!user?.id,
    staleTime: 60_000,
    queryFn: async () => {
      const [roles, acessos] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user!.id),
        adb.from("os_acessos").select("empresa,recurso,nivel").eq("user_id", user!.id),
      ]);
      const admin = (roles.data ?? []).some((r) => r.role === "controller");
      // Se a tabela ainda não existe (SQL não rodou), mantém o comportamento antigo: tudo liberado.
      const semTabela = !!acessos.error;
      return { admin: admin || semTabela, rows: (acessos.data ?? []) as AcessoRow[] };
    },
  });
  const loading = authLoading || q.isLoading;
  const admin = q.data?.admin ?? false;
  const mapa = new Map((q.data?.rows ?? []).map((r) => [`${r.empresa}|${r.recurso}`, r.nivel]));

  function nivel(empresa: Escopo, recurso: string): Nivel {
    if (loading || admin) return 2;
    return (mapa.get(`${empresa}|${recurso}`) ?? 0) as Nivel;
  }
  /** Workspace "grupo" no financeiro e no RH = vale se alguma empresa tiver a aba. */
  function nivelNo(workspace: WorkspaceId, recurso: string): Nivel {
    if (workspace !== "grupo" || !(recurso.startsWith("fin.") || recurso.startsWith("rh."))) return nivel(workspace as Escopo, recurso);
    return Math.max(0, ...TODAS.map((c) => nivel(c, recurso))) as Nivel;
  }
  return {
    loading,
    admin,
    nivel,
    nivelNo,
    pode: (empresa: WorkspaceId, recurso: string, min: Nivel = 1) => nivelNo(empresa, recurso) >= min,
    /** Tem qualquer aba nesta empresa/escopo. */
    temAlgo: (empresa: Escopo) => loading || admin || [...mapa.keys()].some((k) => k.startsWith(`${empresa}|`)),
  };
}

/** Pode editar esta aba do financeiro na empresa selecionada? */
export function useFinEdit(recurso: string): boolean {
  const os = useOs();
  const hub = useHubStore((st) => st.activeHubId);
  const ws = getHub(hub).id as WorkspaceId;
  return os.pode(ws, recurso, 2);
}
