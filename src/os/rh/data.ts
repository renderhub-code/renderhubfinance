import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useOs } from "@/os/acessos";
import { GROUP_COMPANIES, getCompany, type CompanyId, type WorkspaceId } from "@/os/companies";
import { useHubStore } from "@/lib/hub-store";

/** Cliente sem tipagem gerada para as tabelas rh_*. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const rdb = supabase as unknown as SupabaseClient<any>;

// ---------- Tipos ----------
export const VINCULOS = ["CLT", "Estágio", "Temporário", "Aprendiz", "Sócio", "Outro"] as const;
export type StatusColab = "ativo" | "afastado" | "desligado";
export interface Colaborador {
  id: string;
  empresa: CompanyId;
  nome: string;
  matricula: string | null;
  email: string | null;
  setor: string | null;
  cargo: string | null;
  vinculo: string;
  admissao: string | null;
  desligamento: string | null;
  motivo_desligamento: string | null;
  jornada: string | null;
  gestor: string | null;
  status: StatusColab;
  obs: string | null;
}
export type TipoRem = "salario" | "gratificacao" | "adicional" | "beneficio";
export const TIPO_REM: Record<TipoRem, string> = {
  salario: "Salário",
  gratificacao: "Gratificação",
  adicional: "Adicional / variável",
  beneficio: "Benefício",
};
export interface Remuneracao {
  id: string;
  colaborador_id: string;
  tipo: TipoRem;
  descricao: string | null;
  valor: number;
  competencia: string;
  fim: string | null;
  criado_em: string;
}
export interface Parametros {
  empresa: CompanyId;
  encargos_pct: number;
  provisoes_pct: number;
  meta_turnover: number;
}
export interface Orcamento {
  empresa: CompanyId;
  ano: number;
  valor: number;
}
export type CategoriaCusto =
  "folha" | "encargos" | "beneficios" | "gratificacoes" | "sst" | "treinamento" | "outros";
export const CATEGORIAS: Record<CategoriaCusto, string> = {
  folha: "Folha salarial",
  encargos: "Encargos e tributos",
  beneficios: "VR / VA e benefícios",
  gratificacoes: "Gratificações",
  sst: "Exames e SST",
  treinamento: "Treinamentos",
  outros: "Outros",
};
export interface Custo {
  id: string;
  empresa: CompanyId;
  competencia: string;
  categoria: CategoriaCusto;
  valor: number;
  descricao: string | null;
}
export interface Atividade {
  id: string;
  empresa: CompanyId;
  atividade: string;
  dia: number;
  responsavel: string | null;
  recorrencia: string;
  ativo: boolean;
}
export interface Avaliacao {
  id: string;
  colaborador_id: string;
  tipo: "9box" | "desempenho";
  ciclo: string;
  gestor: string | null;
  desempenho: number | null;
  potencial: number | null;
  notas: number[] | null;
  media: number | null;
  fortes: string | null;
  melhorias: string | null;
  resultados: string | null;
  plano: string | null;
  criado_em: string;
}
export type TipoAso = "admissional" | "periodico" | "retorno" | "mudanca" | "demissional";
export const TIPO_ASO: Record<TipoAso, string> = {
  admissional: "Admissional",
  periodico: "Periódico",
  retorno: "Retorno ao trabalho",
  mudanca: "Mudança de função",
  demissional: "Demissional",
};
export type ResultadoAso = "apto" | "apto_restricao" | "inapto";
export const RESULTADO_ASO: Record<ResultadoAso, string> = {
  apto: "Apto",
  apto_restricao: "Apto com restrição",
  inapto: "Inapto",
};
export interface Aso {
  id: string;
  colaborador_id: string;
  tipo: TipoAso;
  data: string;
  proxima: string | null;
  resultado: ResultadoAso;
  obs: string | null;
}
export interface ContratoPj {
  id: string;
  empresa: CompanyId;
  prestador: string;
  cnpj: string | null;
  servico: string | null;
  gestor: string | null;
  inicio: string | null;
  fim: string | null;
  valor_mensal: number;
  reajuste: string | null;
  aviso_dias: number | null;
  status: "ativo" | "renovar" | "encerrado";
  obs: string | null;
}
export interface Documento {
  id: string;
  empresa: CompanyId;
  colaborador_id: string | null;
  tipo: string;
  descricao: string | null;
  vencimento: string | null;
  responsavel: string | null;
  status: "pendente" | "em_dia" | "concluido";
  obs: string | null;
}
export const TIPOS_DOC = [
  "Contrato CLT / aditivo",
  "Contrato PJ / aditivo",
  "ASO / PCMSO / PGR",
  "Férias e período aquisitivo",
  "Fim de experiência",
  "Treinamento / certificado",
  "Política / termo de ciência",
  "Outro",
];
export interface Folha {
  id: string;
  colaborador_id: string;
  competencia: string;
  bruto: number;
  gratificacao: number;
  inss_pct: number;
  irrf: number;
  vt: number;
  va: number;
  outros_descontos: number;
  beneficios: number;
  encargos_pct: number;
}

/** Valores padrão quando a empresa ainda não tem parâmetros. */
export const PARAM_PADRAO = { encargos_pct: 27, provisoes_pct: 19.44, meta_turnover: 10 };

// ---------- Formatação ----------
export const brl = (v: number) =>
  (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const brl0 = (v: number) =>
  (Number(v) || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
export const pct = (v: number, casas = 1) =>
  `${(Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;
export function fmtData(d: string | null): string {
  if (!d) return "—";
  const [y, m, dd] = d.slice(0, 10).split("-");
  return `${dd}/${m}/${y}`;
}
export function fmtComp(d: string): string {
  const [y, m] = d.split("-");
  return new Date(Number(y), Number(m) - 1, 1)
    .toLocaleDateString("pt-BR", { month: "short", year: "numeric" })
    .replace(".", "");
}
export const hojeISO = () => new Date().toISOString().slice(0, 10);
/** Primeiro dia do mês, AAAA-MM-01. */
export const mesISO = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
export function diasAte(data: string): number {
  const [y, m, d] = data.split("-").map(Number);
  const hoje = new Date();
  return Math.round(
    (Date.UTC(y!, m! - 1, d!) - Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())) /
      86_400_000,
  );
}
export const nomeEmpresa = (id: string) => getCompany(id)?.name ?? id;

// ---------- Contas ----------
/** Salário vigente numa data: a linha 'salario' mais recente com competência <= data. */
export function salarioEm(rem: Remuneracao[], colabId: string, data = hojeISO()): number {
  const linhas = rem
    .filter((r) => r.colaborador_id === colabId && r.tipo === "salario" && r.competencia <= data)
    .sort(
      (a, b) =>
        b.competencia.localeCompare(a.competencia) || b.criado_em.localeCompare(a.criado_em),
    );
  return Number(linhas[0]?.valor ?? 0);
}
/** Benefícios vigentes no mês (recorrentes, sem fim ou com fim depois do mês). */
export function beneficiosEm(rem: Remuneracao[], colabId: string, mes = mesISO()): number {
  return rem
    .filter(
      (r) =>
        r.colaborador_id === colabId &&
        r.tipo === "beneficio" &&
        r.competencia <= mes &&
        (!r.fim || r.fim >= mes),
    )
    .reduce((a, r) => a + Number(r.valor), 0);
}
/** Gratificações e adicionais lançados na competência. */
export function variaveisEm(rem: Remuneracao[], colabId: string, mes = mesISO()): number {
  return rem
    .filter(
      (r) =>
        r.colaborador_id === colabId &&
        (r.tipo === "gratificacao" || r.tipo === "adicional") &&
        r.competencia.slice(0, 7) === mes.slice(0, 7),
    )
    .reduce((a, r) => a + Number(r.valor), 0);
}
export interface CustoPessoa {
  salario: number;
  variaveis: number;
  encargos: number;
  provisoes: number;
  beneficios: number;
  total: number;
}
export function custoPessoa(
  rem: Remuneracao[],
  c: Colaborador,
  p: { encargos_pct: number; provisoes_pct: number },
  mes = mesISO(),
): CustoPessoa {
  const ref = mes.slice(0, 7) + "-28";
  const salario = salarioEm(rem, c.id, ref);
  const variaveis = variaveisEm(rem, c.id, mes);
  const base = salario + variaveis;
  const encargos = c.vinculo === "Sócio" ? 0 : base * (Number(p.encargos_pct) / 100);
  const provisoes = c.vinculo === "CLT" ? base * (Number(p.provisoes_pct) / 100) : 0;
  const beneficios = beneficiosEm(rem, c.id, mes);
  return {
    salario,
    variaveis,
    encargos,
    provisoes,
    beneficios,
    total: base + encargos + provisoes + beneficios,
  };
}
export const ativoNoMes = (c: Colaborador, mes = mesISO()) => {
  const fimMes = mes.slice(0, 7) + "-31";
  return (!c.admissao || c.admissao <= fimMes) && (!c.desligamento || c.desligamento >= mes);
};
/** Turnover 12 meses = desligamentos no período / quadro médio (início e hoje). */
export function turnover12(colabs: Colaborador[]): {
  taxa: number;
  desligamentos: number;
  admissoes: number;
  quadroMedio: number;
} {
  const hoje = hojeISO();
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  const inicio = d.toISOString().slice(0, 10);
  const vivoEm = (c: Colaborador, dia: string) =>
    (!c.admissao || c.admissao <= dia) && (!c.desligamento || c.desligamento > dia);
  const qi = colabs.filter((c) => vivoEm(c, inicio)).length;
  const qf = colabs.filter((c) => vivoEm(c, hoje)).length;
  const desligamentos = colabs.filter(
    (c) => c.desligamento && c.desligamento > inicio && c.desligamento <= hoje,
  ).length;
  const admissoes = colabs.filter(
    (c) => c.admissao && c.admissao > inicio && c.admissao <= hoje,
  ).length;
  const quadroMedio = (qi + qf) / 2;
  return {
    taxa: quadroMedio ? (desligamentos / quadroMedio) * 100 : 0,
    desligamentos,
    admissoes,
    quadroMedio,
  };
}
export function classificacao(media: number): string {
  return media >= 4.5
    ? "Destaque"
    : media >= 3.5
      ? "Acima do esperado"
      : media >= 2.5
        ? "Dentro do esperado"
        : "Atenção / desenvolvimento";
}
export const NIVEL_9BOX: Record<number, string> = { 1: "Baixo", 2: "Médio", 3: "Alto" };
export const DIMENSOES = [
  "Qualidade das entregas",
  "Produtividade e prazos",
  "Conhecimento técnico",
  "Comunicação e equipe",
  "Organização e autonomia",
  "Metas e resultados",
];

/** Último ASO de cada colaborador. */
export function ultimoAso(asos: Aso[]): Map<string, Aso> {
  const m = new Map<string, Aso>();
  for (const a of [...asos].sort((x, y) => y.data.localeCompare(x.data)))
    if (!m.has(a.colaborador_id)) m.set(a.colaborador_id, a);
  return m;
}

export function baixarCsv(
  arquivo: string,
  cab: string[],
  linhas: (string | number | null | undefined)[][],
) {
  const csv = [cab, ...linhas]
    .map((r) => r.map((v) => `"${String(v ?? "").replaceAll('"', '""')}"`).join(";"))
    .join("\n");
  const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = arquivo;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------- Contexto ----------
/** Empresa selecionada e as empresas que a tela do RH mostra (todas, no grupo). */
export function useRhCtx(recurso: string) {
  const ws = useHubStore((s) => s.activeHubId) as WorkspaceId;
  const os = useOs();
  const todas = GROUP_COMPANIES.map((c) => c.id);
  const empresas: CompanyId[] =
    ws === "grupo" ? todas.filter((c) => os.nivel(c, recurso) >= 1) : [ws as CompanyId];
  /** Empresas onde a pessoa pode criar registros nesta aba. */
  const editaveis: CompanyId[] = (ws === "grupo" ? todas : [ws as CompanyId]).filter(
    (c) => os.nivel(c, recurso) >= 2,
  );
  return {
    ws,
    grupo: ws === "grupo",
    empresas,
    editaveis,
    loading: os.loading,
    ver: empresas.length > 0 && os.nivelNo(ws, recurso) >= 1,
    edita: (empresa?: string) =>
      empresa ? os.nivel(empresa as CompanyId, recurso) >= 2 : editaveis.length > 0,
    nivel: (empresa: string, r = recurso) => os.nivel(empresa as CompanyId, r),
  };
}

const chave = (t: string, empresas: string[]) => ["rh", t, empresas.join(",")];

async function porEmpresa<T>(
  tabela: string,
  empresas: string[],
  ordem: string,
  asc = true,
): Promise<T[]> {
  if (!empresas.length) return [];
  const { data, error } = await rdb
    .from(tabela)
    .select("*")
    .in("empresa", empresas)
    .order(ordem, { ascending: asc });
  if (error) throw error;
  return (data ?? []) as T[];
}
async function porColaborador<T>(
  tabela: string,
  ids: string[],
  ordem: string,
  asc = true,
): Promise<T[]> {
  if (!ids.length) return [];
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += 150) {
    const { data, error } = await rdb
      .from(tabela)
      .select("*")
      .in("colaborador_id", ids.slice(i, i + 150))
      .order(ordem, { ascending: asc });
    if (error) throw error;
    out.push(...((data ?? []) as T[]));
  }
  return out;
}

export function useColaboradores(empresas: string[]) {
  return useQuery({
    queryKey: chave("colab", empresas),
    queryFn: () => porEmpresa<Colaborador>("rh_colaboradores", empresas, "nome"),
    retry: false,
  });
}
/** Leitura só com a aba que dá acesso (a política do banco filtra o resto). */
export function useRemuneracao(colabs: Colaborador[], enabled = true) {
  const ids = colabs.map((c) => c.id);
  return useQuery({
    queryKey: ["rh", "rem", ids.join(",")],
    enabled,
    queryFn: async () =>
      (await porColaborador<Remuneracao>("rh_remuneracao", ids, "competencia", false)).map((r) => ({
        ...r,
        valor: Number(r.valor),
      })),
  });
}
export function useParametros(empresas: string[], enabled = true) {
  return useQuery({
    queryKey: chave("param", empresas),
    enabled,
    queryFn: async () => {
      const rows = await porEmpresa<Parametros>("rh_parametros", empresas, "empresa");
      const m = new Map(
        rows.map((r) => [
          r.empresa,
          {
            ...r,
            encargos_pct: Number(r.encargos_pct),
            provisoes_pct: Number(r.provisoes_pct),
            meta_turnover: Number(r.meta_turnover),
          },
        ]),
      );
      return (e: string): Parametros =>
        m.get(e as CompanyId) ?? { empresa: e as CompanyId, ...PARAM_PADRAO };
    },
  });
}
export function useOrcamentos(empresas: string[], enabled = true) {
  return useQuery({
    queryKey: chave("orc", empresas),
    enabled,
    queryFn: () => porEmpresa<Orcamento>("rh_orcamentos", empresas, "ano"),
  });
}
export function useCustos(empresas: string[], enabled = true) {
  return useQuery({
    queryKey: chave("custos", empresas),
    enabled,
    queryFn: async () =>
      (await porEmpresa<Custo>("rh_custos", empresas, "competencia", false)).map((c) => ({
        ...c,
        valor: Number(c.valor),
      })),
  });
}
export function useCalendario(empresas: string[], enabled = true) {
  return useQuery({
    queryKey: chave("cal", empresas),
    enabled,
    queryFn: () => porEmpresa<Atividade>("rh_calendario", empresas, "dia"),
  });
}
export function useAvaliacoes(colabs: Colaborador[], enabled = true) {
  const ids = colabs.map((c) => c.id);
  return useQuery({
    queryKey: ["rh", "aval", ids.join(",")],
    enabled,
    queryFn: () => porColaborador<Avaliacao>("rh_avaliacoes", ids, "criado_em", false),
  });
}
export function useAsos(colabs: Colaborador[], enabled = true) {
  const ids = colabs.map((c) => c.id);
  return useQuery({
    queryKey: ["rh", "aso", ids.join(",")],
    enabled,
    queryFn: () => porColaborador<Aso>("rh_asos", ids, "data", false),
  });
}
export function useContratosPj(empresas: string[], enabled = true) {
  return useQuery({
    queryKey: chave("pj", empresas),
    enabled,
    queryFn: async () =>
      (await porEmpresa<ContratoPj>("rh_contratos_pj", empresas, "fim")).map((c) => ({
        ...c,
        valor_mensal: Number(c.valor_mensal),
      })),
  });
}
export function useDocumentos(empresas: string[], enabled = true) {
  return useQuery({
    queryKey: chave("docs", empresas),
    enabled,
    queryFn: () => porEmpresa<Documento>("rh_documentos", empresas, "vencimento"),
  });
}
export function useFolha(colabs: Colaborador[], competencia: string, enabled = true) {
  const ids = colabs.map((c) => c.id);
  return useQuery({
    queryKey: ["rh", "folha", competencia, ids.join(",")],
    enabled,
    queryFn: async () => {
      if (!ids.length) return [] as Folha[];
      const { data, error } = await rdb
        .from("rh_folha")
        .select("*")
        .in("colaborador_id", ids)
        .eq("competencia", competencia);
      if (error) throw error;
      return ((data ?? []) as Folha[]).map(
        (f) =>
          Object.fromEntries(
            Object.entries(f).map(([k, v]) => [
              k,
              typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v,
            ]),
          ) as unknown as Folha,
      );
    },
  });
}
export interface Alertas {
  aso_vencidos: number;
  aso_30: number;
  sem_aso: number;
  pj_ativos: number;
  pj_valor: number;
  pj_30: number;
  pj_60: number;
  docs_pendentes: number;
  docs_30: number;
}
export function useAlertas(empresas: string[], enabled = true) {
  return useQuery({
    queryKey: chave("alertas", empresas),
    enabled,
    queryFn: async () => {
      const { data, error } = await rdb.rpc("rh_alertas", { _empresas: empresas });
      if (error) throw error;
      return data as Alertas;
    },
  });
}

export function useInvalidateRh() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["rh"] });
}

/** Linha da folha a partir do cadastro (salário vigente, variáveis e benefícios do mês). */
export function folhaDoCadastro(
  c: Colaborador,
  rem: Remuneracao[],
  p: Parametros,
  mes: string,
): Omit<Folha, "id"> {
  const ref = mes.slice(0, 7) + "-28";
  return {
    colaborador_id: c.id,
    competencia: mes,
    bruto: salarioEm(rem, c.id, ref),
    gratificacao: variaveisEm(rem, c.id, mes),
    inss_pct: 0,
    irrf: 0,
    vt: 0,
    va: 0,
    outros_descontos: 0,
    beneficios: beneficiosEm(rem, c.id, mes),
    encargos_pct: c.vinculo === "Sócio" ? 0 : Number(p.encargos_pct),
  };
}
export function calcFolha(
  f: Pick<
    Folha,
    | "bruto"
    | "gratificacao"
    | "inss_pct"
    | "irrf"
    | "vt"
    | "va"
    | "outros_descontos"
    | "beneficios"
    | "encargos_pct"
  >,
) {
  const base = Number(f.bruto) + Number(f.gratificacao);
  const inss = base * (Number(f.inss_pct) / 100);
  const descontos =
    inss + Number(f.irrf) + Number(f.vt) + Number(f.va) + Number(f.outros_descontos);
  const encargos = base * (Number(f.encargos_pct) / 100);
  return {
    base,
    inss,
    descontos,
    liquido: base - descontos,
    encargos,
    custo: base + encargos + Number(f.beneficios),
  };
}
