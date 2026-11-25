import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { GROUP_COMPANIES } from "@/os/companies";
import { useOs } from "@/os/acessos";

/** Cliente sem tipagem gerada para as tabelas ia_* (ainda fora de types.ts). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const idb = supabase as unknown as SupabaseClient<any>;

export const STATUS = ["Produção", "Em desenvolvimento", "Ideia", "Pausada"] as const;
export type Status = (typeof STATUS)[number];
export const TIPOS = ["Plataforma", "Automação", "Painel", "Agente de IA"] as const;
export type Papel = "admin" | "colaborador" | "leitor";

export interface Solucao {
  id: string; titulo: string; tipo: string; status: string;
  ganho: number; custo: number; horas: number;
  link: string | null; responsavel: string | null; descricao: string | null;
  empresas: string[]; previsao: string | null; criado_em: string; atualizado_em: string;
}
export interface Atualizacao { id: string; solucao_id: string; texto: string; autor_id: string | null; autor_nome: string | null; criado_em: string }
export interface Pessoa { id: string; nome: string; cargo: string | null; ordem: number }
export interface Modulo { id: string; titulo: string; ordem: number }
export interface Progresso { pessoa_id: string; modulo_id: string; status: number }
export interface Acesso { user_id: string; nome: string; email: string | null; papel: Papel }

export const PAPEL_LABEL: Record<Papel, string> = { admin: "Administrador", colaborador: "Colaborador", leitor: "Leitor" };

export const STATUS_TONE: Record<string, string> = {
  "Produção": "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
  "Em desenvolvimento": "bg-blue-50 text-blue-700 ring-blue-600/15",
  Ideia: "bg-violet-50 text-violet-700 ring-violet-600/15",
  Pausada: "bg-zinc-100 text-zinc-600 ring-zinc-500/15",
};
export const STATUS_COLOR: Record<string, string> = {
  "Produção": "#10b981",
  "Em desenvolvimento": "#3b82f6",
  Ideia: "#8b5cf6",
  Pausada: "#a1a1aa",
};

/** Base de horas de uma pessoa em tempo integral por mês. */
export const HORAS_FTE = 160;

export function roi(s: Pick<Solucao, "ganho" | "custo">): number | null {
  return Number(s.custo) > 0 ? Number(s.ganho) / Number(s.custo) : null;
}

/** Ganho de cada entrega em produção é rateado igualmente entre as empresas atendidas. */
export function ganhoPorEmpresa(solucoes: Solucao[]): Record<string, number> {
  const valid = new Set(GROUP_COMPANIES.map((c) => c.id as string));
  const out: Record<string, number> = {};
  for (const s of solucoes) {
    if (s.status !== "Produção") continue;
    const ids = s.empresas.filter((id) => valid.has(id));
    for (const id of ids) out[id] = (out[id] ?? 0) + Number(s.ganho) / ids.length;
  }
  return out;
}

export const chave = (pessoa: string, modulo: string) => `${pessoa}:${modulo}`;

export function progressoMap(p: Progresso[]): Record<string, number> {
  const m: Record<string, number> = {};
  for (const r of p) m[chave(r.pessoa_id, r.modulo_id)] = r.status;
  return m;
}

export function pctPessoa(pessoaId: string, modulos: Modulo[], pm: Record<string, number>): number {
  if (!modulos.length) return 0;
  return (modulos.filter((md) => pm[chave(pessoaId, md.id)] === 2).length / modulos.length) * 100;
}

export function metricas(solucoes: Solucao[], pessoas: Pessoa[], modulos: Modulo[], progresso: Progresso[]) {
  const prod = solucoes.filter((s) => s.status === "Produção");
  const sum = (l: Solucao[], k: "ganho" | "custo" | "horas") => l.reduce((a, s) => a + (Number(s[k]) || 0), 0);
  const pm = progressoMap(progresso);
  let feitos = 0;
  for (const p of pessoas) for (const md of modulos) if (pm[chave(p.id, md.id)] === 2) feitos++;
  const ganho = sum(prod, "ganho");
  const custo = sum(prod, "custo");
  const horas = sum(prod, "horas");
  return {
    ganho, custo, horas,
    fte: horas / HORAS_FTE,
    retorno: custo > 0 ? ganho / custo : null,
    liquido: ganho - custo,
    dev: sum(solucoes.filter((s) => s.status === "Em desenvolvimento"), "ganho"),
    porEmpresa: ganhoPorEmpresa(solucoes),
    pct: pessoas.length && modulos.length ? (feitos / (pessoas.length * modulos.length)) * 100 : 0,
    completos: pessoas.filter((p) => pctPessoa(p.id, modulos, pm) === 100).length,
    pm,
  };
}

export const brl = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(Number(n) || 0);
export const nf = (n: number, d = 0) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: d }).format(Number(n) || 0);

// ---------- Hooks ----------

/** Meu acesso ao módulo de IA. Faz o bootstrap do primeiro administrador. */
/**
 * Acesso da pessoa logada ao módulo de IA, a partir de Pessoas › Acessos (escopo "grupo").
 * `recurso` define o que conta como "editar" na tela atual (ex.: "ia.entregas").
 */
export function useIaMe(_enabled = true, recurso?: string) {
  const { user } = useAuth();
  const os = useOs();
  const ver = IA_RECURSOS.some((r) => os.nivel("grupo", r) >= 1);
  const canEdit = recurso ? os.nivel("grupo", recurso) === 2 : IA_RECURSOS.some((r) => os.nivel("grupo", r) === 2);
  return {
    user,
    loading: os.loading,
    acesso: ver ? { papel: (canEdit ? "colaborador" : "leitor") as Papel } : null,
    erro: null as string | null,
    canEdit,
    isAdmin: os.admin,
  };
}
const IA_RECURSOS = ["ia.visao", "ia.entregas", "ia.empresas", "ia.treinamento"];

function lista<T>(key: string, table: string, order: [string, boolean][], map?: (r: T) => T) {
  return {
    queryKey: ["ia", key],
    queryFn: async () => {
      let q = idb.from(table).select("*");
      for (const [col, asc] of order) q = q.order(col, { ascending: asc });
      const { data, error } = await q;
      if (error) throw error;
      const rows = (data ?? []) as T[];
      return map ? rows.map(map) : rows;
    },
  };
}

export const useSolucoes = () =>
  useQuery(lista<Solucao>("solucoes", "ia_solucoes", [["criado_em", true]], (s) => ({
    ...s, ganho: Number(s.ganho), custo: Number(s.custo), horas: Number(s.horas), empresas: s.empresas ?? [],
  })));
export const useAtualizacoes = () => useQuery(lista<Atualizacao>("atualizacoes", "ia_atualizacoes", [["criado_em", false]]));
export const usePessoas = () => useQuery(lista<Pessoa>("pessoas", "ia_pessoas", [["ordem", true], ["nome", true]]));
export const useModulos = () => useQuery(lista<Modulo>("modulos", "ia_modulos", [["ordem", true], ["titulo", true]]));
export const useProgresso = () => useQuery(lista<Progresso>("progresso", "ia_progresso", []));

export function useInvalidateIa() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["ia"] });
}
