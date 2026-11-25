import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useOs } from "@/os/acessos";

/** Cliente sem tipagem gerada para as tabelas cs_* (follow-up da Render Comex). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const xdb = supabase as unknown as SupabaseClient<any>;

export const ETAPAS = [
  { key: "pedido", label: "Pedido" },
  { key: "producao", label: "Produção" },
  { key: "embarque", label: "Embarque" },
  { key: "transito", label: "Em trânsito" },
  { key: "porto", label: "No porto" },
  { key: "desembaraco", label: "Desembaraço" },
  { key: "entregue", label: "Entregue" },
] as const;
export type Etapa = (typeof ETAPAS)[number]["key"];

export const etapaIndex = (e: Etapa) => ETAPAS.findIndex((s) => s.key === e);
export const etapaLabel = (e: Etapa) => ETAPAS[etapaIndex(e)]?.label ?? e;

/** Grupos do painel, como as seções da antiga planilha semanal. */
export type Grupo = "porto" | "transito" | "nao_embarcada" | "entregue";
export const GRUPOS: { key: Grupo; label: string }[] = [
  { key: "porto", label: "No porto" },
  { key: "transito", label: "Em trânsito" },
  { key: "nao_embarcada", label: "Não embarcada" },
  { key: "entregue", label: "Entregue" },
];
export function grupoDaEtapa(e: Etapa): Grupo {
  if (e === "pedido" || e === "producao") return "nao_embarcada";
  if (e === "embarque" || e === "transito") return "transito";
  if (e === "porto" || e === "desembaraco") return "porto";
  return "entregue";
}

/** Dias inteiros de hoje até `data` (negativo se já passou). Datas em AAAA-MM-DD. */
export function diasAte(data: string, hoje: Date = new Date()): number {
  const [y, m, d] = data.split("-").map(Number);
  const alvo = Date.UTC(y!, m! - 1, d!);
  const base = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  return Math.round((alvo - base) / 86_400_000);
}
export function fmtData(data: string | null): string {
  if (!data) return "—";
  const [y, m, d] = data.split("-");
  return `${d}/${m}/${y}`;
}

export type Papel = "admin" | "equipe";
export interface Membro { user_id: string; nome: string; email: string | null; papel: Papel }
export interface Cliente {
  id: string; nome: string; empresa: string; comercial_responsavel: string | null;
  cs_responsavel: string | null; emails: string[]; criado_em: string;
}
export interface Processo {
  id: string; cliente_id: string; po: string; invoice: string | null; mercadoria: string;
  container: string | null; data_embarque: string | null; chegada_prevista: string | null;
  etapa: Etapa; status_texto: string | null; pendencia: string | null;
  criado_em: string; atualizado_em: string;
}
export interface Atualizacao {
  id: string; processo_id: string; cliente_id: string; mensagem: string;
  autor: string | null; criado_em: string;
}

/** Acesso ao follow-up a partir de Pessoas › Acessos (empresa Render Comex). */
export function useComexMe(_enabled = true) {
  const { user } = useAuth();
  const os = useOs();
  const followup = os.nivel("render", "cx.followup");
  const clientes = os.nivel("render", "cx.clientes");
  return {
    user,
    loading: os.loading,
    membro: followup || clientes ? ({ user_id: user?.id ?? "" } as Pick<Membro, "user_id">) : null,
    erro: null as string | null,
    isAdmin: os.admin,
    editaPOs: followup === 2,
    editaClientes: clientes === 2,
  };
}

export function useClientes() {
  return useQuery({
    queryKey: ["comex", "clientes"],
    queryFn: async () => {
      const { data, error } = await xdb.from("cs_clientes").select("*").order("nome");
      if (error) throw error;
      return (data ?? []) as Cliente[];
    },
  });
}

export function useProcessos(clienteId?: string | null) {
  return useQuery({
    queryKey: ["comex", "processos", clienteId ?? "todos"],
    queryFn: async () => {
      let q = xdb.from("cs_processos").select("*");
      if (clienteId) q = q.eq("cliente_id", clienteId);
      const { data, error } = await q.order("chegada_prevista", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as Processo[];
    },
  });
}

export function useAtualizacoes(clienteId?: string | null, limite = 30) {
  return useQuery({
    queryKey: ["comex", "atualizacoes", clienteId ?? "todos", limite],
    queryFn: async () => {
      let q = xdb.from("cs_atualizacoes").select("*");
      if (clienteId) q = q.eq("cliente_id", clienteId);
      const { data, error } = await q.order("criado_em", { ascending: false }).limit(limite);
      if (error) throw error;
      return (data ?? []) as Atualizacao[];
    },
  });
}

export function useInvalidateComex() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["comex"] });
}

/** Recarrega processos e feed quando alguém da equipe muda algo (tempo real). */
export function useComexAoVivo() {
  const qc = useQueryClient();
  useEffect(() => {
    const ch = supabase
      .channel(`comex-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "cs_processos" }, () => {
        void qc.invalidateQueries({ queryKey: ["comex", "processos"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "cs_atualizacoes" }, () => {
        void qc.invalidateQueries({ queryKey: ["comex", "atualizacoes"] });
      })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [qc]);
}
