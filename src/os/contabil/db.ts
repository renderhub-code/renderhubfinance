import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/**
 * Cliente sem tipagem gerada para as tabelas contabil_* (ainda fora de types.ts).
 * Quando o Lovable/Supabase regenerar os tipos, dá para trocar por `supabase`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const cdb = supabase as unknown as SupabaseClient<any>;

export type Papel = "admin" | "coordenador" | "analista";
export type Status = "nao_iniciado" | "em_andamento" | "concluido" | "atrasado";

export interface Setor { id: string; nome: string; ordem: number }
export interface Membro {
  user_id: string; nome: string; email: string | null; setor_id: string | null;
  papel: Papel; atribuicao_global: boolean; ativo: boolean;
}
export interface Categoria { id: string; setor_id: string; nome: string; ordem: number; ativo: boolean }
export interface Cliente {
  id: string; razao_social: string; nome_fantasia: string | null; cnpj: string | null;
  codigo_dominio: string | null; apelido: string | null; grupo_economico: string | null;
  regime: string | null; segmento: string | null; uf: string | null; cidade: string | null; ativo: boolean;
}
export interface Atividade {
  id: string; setor_id: string; categoria_id: string | null; cliente_id: string | null;
  atividade: string; responsavel_id: string; prioridade: number; status: Status;
  prazo: string | null; follow_up: string | null; criado_por: string | null; criado_em: string;
  ultima_atualizacao: string | null; atualizado_por: string | null;
}

export const STATUS_LABEL: Record<Status, string> = {
  nao_iniciado: "Não iniciado",
  em_andamento: "Em andamento",
  concluido: "Concluído",
  atrasado: "Atrasado",
};

export const PAPEL_LABEL: Record<Papel, string> = {
  admin: "Administrador",
  coordenador: "Coordenador",
  analista: "Analista",
};

export const PRIORIDADE_LABEL: Record<number, string> = {
  1: "Urgente",
  2: "Alta",
  3: "Média",
  4: "Baixa",
};

/** Hoje no fuso local, YYYY-MM-DD. */
export function hojeISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** "Atrasado" é calculado: prazo vencido e não concluído. */
export function statusEfetivo(status: Status, prazo: string | null): Status {
  if (status === "concluido") return "concluido";
  if (prazo && prazo.slice(0, 10) < hojeISO()) return "atrasado";
  return status;
}

/** dd/mm/aaaa sem conversão de fuso. */
export function dataBR(v: string | null | undefined): string | null {
  const m = v ? String(v).match(/^(\d{4})-(\d{2})-(\d{2})/) : null;
  return m ? `${m[3]}/${m[2]}/${m[1]}` : null;
}

export const STATUS_TONE: Record<Status, string> = {
  nao_iniciado: "bg-zinc-100 text-zinc-700 ring-zinc-500/15",
  em_andamento: "bg-blue-50 text-blue-700 ring-blue-600/15",
  concluido: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
  atrasado: "bg-red-50 text-red-700 ring-red-600/15",
};

export const STATUS_DOT: Record<Status, string> = {
  nao_iniciado: "#a1a1aa",
  em_andamento: "#3b82f6",
  concluido: "#10b981",
  atrasado: "#ef4444",
};

export const PRIORIDADE_TONE: Record<number, string> = {
  1: "bg-red-50 text-red-700 ring-red-600/15",
  2: "bg-orange-50 text-orange-700 ring-orange-600/15",
  3: "bg-amber-50 text-amber-700 ring-amber-600/15",
  4: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
};

export function clienteLabel(c: Pick<Cliente, "razao_social" | "cnpj"> | null | undefined): string {
  if (!c) return "";
  return c.cnpj ? `${c.razao_social} · ${c.cnpj}` : c.razao_social;
}

export function norm(s: unknown): string {
  return String(s ?? "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}
