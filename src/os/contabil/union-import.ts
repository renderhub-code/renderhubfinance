import { z } from "zod";

export const UNION_BASES = ["setores", "profiles", "user_roles", "admin_allowlist", "categorias_atividade", "empresas", "atividades", "atividade_ciencias", "contratos", "controle_lancamentos", "controle_snapshots", "nibo_obrigacoes", "ponto_colaboradores", "ponto_jornadas", "ponto_dias", "ponto_meses"] as const;
export type UnionBase = (typeof UNION_BASES)[number];
export type UnionRow = Record<string, string>;

export const UNION_LABELS: Record<UnionBase, string> = {
  setores: "Setores", profiles: "Pessoas", user_roles: "Papéis de origem", admin_allowlist: "Cadastro de acessos de origem",
  categorias_atividade: "Tipos de atividade", empresas: "Empresas", atividades: "Atividades", atividade_ciencias: "Ciências",
  contratos: "Contratos", controle_lancamentos: "Controle de lançamentos", controle_snapshots: "Histórico do controle",
  nibo_obrigacoes: "Obrigações Nibo", ponto_colaboradores: "Colaboradores do ponto", ponto_jornadas: "Jornadas",
  ponto_dias: "Ponto diário", ponto_meses: "Ponto mensal",
};

// Explicit fields, never credentials, drive both the projection and the private archive.
const FIELDS: Record<UnionBase, string[]> = {
  setores: ["id", "nome", "criado_em"],
  profiles: ["id", "nome", "email", "setor_id", "criado_em", "atribuicao_global"],
  user_roles: ["id", "user_id", "role"],
  admin_allowlist: ["email", "nome", "role", "setor_id", "created_at"],
  categorias_atividade: ["id", "setor_id", "nome", "ordem", "ativo", "criado_por", "criado_em"],
  empresas: ["id", "codigo_dominio", "razao_social", "nome_fantasia", "cnpj", "cnpj_digits", "apelido", "grupo_economico", "regime", "segmento", "uf", "cidade", "movimentos", "resp_fiscal", "resp_dp", "resp_contabil", "insc_estadual", "cnae", "union_empresa", "ativo", "criado_em", "updated_at"],
  atividades: ["id", "setor_id", "atividade", "responsavel_id", "prioridade", "status", "prazo", "follow_up", "criado_por", "ultima_atualizacao", "atualizado_por", "criado_em", "empresa_id", "categoria_id"],
  atividade_ciencias: ["id", "atividade_id", "user_id", "ciente_em", "created_at"],
  contratos: ["id", "codigo_cliente", "cliente", "tipo", "emissao", "inicio_contrato", "inicio_faturamento", "dia_vencimento", "mes_vencimento", "encerrado_em", "valor_original", "valor_atual", "criado_em"],
  controle_lancamentos: ["id", "setor_id", "grupo", "empresa", "codigo", "cnpj", "complexidade", "tempo_conclusao", "regime", "cidade", "doc", "ultimo_mes_ok", "extrato_de", "extrato_ate", "digitado_de", "digitado_ate", "analisado_de", "analisado_ate", "previsao_conclusao", "concluido", "input", "volume", "observacao", "responsavel_id", "responsavel_nome", "atualizado_por", "ultima_atualizacao", "criado_em"],
  controle_snapshots: ["id", "setor_id", "referencia", "empresa", "cnpj", "codigo", "responsavel_nome", "dados", "criado_em"],
  nibo_obrigacoes: ["id", "referencia", "obrigacao", "codigo", "cliente", "cnpj", "status", "meta", "vencimento", "protocolado", "visualizado", "responsavel", "autor", "tipo", "departamento", "criado_em"],
  ponto_colaboradores: ["colaborador_id", "codigo", "cpf", "cargo", "admissao", "criado_em", "updated_at"],
  ponto_jornadas: ["id", "colaborador_id", "dia_semana", "periodos", "previstas_min", "criado_em", "updated_at"],
  ponto_dias: ["id", "colaborador_id", "data", "referencia", "marcacoes", "situacao", "trabalhadas_min", "abono_min", "previstas_min", "saldo_min", "ajustado_manual", "observacao", "fechado", "atualizado_por", "ultima_atualizacao", "criado_em"],
  ponto_meses: ["id", "colaborador_id", "referencia", "trabalhadas_min", "abono_min", "previstas_min", "saldo_min", "saldo_anterior_min", "saldo_acumulado_min", "dias_faltosos", "faltas_min", "horas_noturnas_min", "fechado", "criado_em", "updated_at"],
};

export const unionChunkSchema = z.object({ base: z.enum(UNION_BASES), rows: z.array(z.record(z.string(), z.string().max(100_000))).min(1).max(100) });
export const unionIdentitiesSchema = z.array(z.object({
  original_id: z.uuid(), nome: z.string().min(1).max(200), email: z.email(), setor_id: z.uuid().nullable(),
  papel: z.enum(["admin", "coordenador", "analista"]), atribuicao_global: z.boolean(),
})).min(1).max(100);

const credentialField = /(?:password|senha|secret|token|credential|private.?key|api.?key|authorization|cookie)/i;
function cleanNested(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(cleanNested);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).filter(([k]) => !credentialField.test(k)).map(([k, value]) => [k, cleanNested(value)]));
  return v;
}

export function sanitizeUnionRow(base: UnionBase, row: UnionRow): UnionRow {
  const result: UnionRow = {};
  for (const key of FIELDS[base]) {
    const value = row[key];
    if (typeof value !== "string") continue;
    if (key === "dados") result[key] = JSON.stringify(cleanNested(JSON.parse(value || "{}")));
    else result[key] = value;
  }
  return result;
}

export function unionRecordId(base: UnionBase, r: UnionRow): string {
  const id = r["id"] || (base === "admin_allowlist" ? r["email"]?.trim().toLowerCase() : r["colaborador_id"]);
  if (!id) throw new Error(`Registro sem identificação em ${UNION_LABELS[base]}.`);
  return id;
}

export const unionBool = (s: string | undefined) => s === "t" || s === "true" || s === "1";
export const unionName = (s: string) => s.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export interface UnionMappings { sectors: Map<string, string>; categories: Map<string, string>; users: Map<string, string> }
function mapped(map: Map<string, string>, id: string | undefined, required: true): string;
function mapped(map: Map<string, string>, id: string | undefined, required?: false): string | null;
function mapped(map: Map<string, string>, id: string | undefined, required = false): string | null {
  if (!id && !required) return null;
  const result = id ? map.get(id) : null;
  if (!result) throw new Error("Vínculo de origem não encontrado. Importe os cadastros antes das atividades.");
  return result;
}

export function projectUnionActivity(r: UnionRow, maps: UnionMappings) {
  const status = z.enum(["nao_iniciado", "em_andamento", "concluido", "atrasado"]).parse(r["status"]);
  const prioridade = z.coerce.number().int().min(1).max(4).parse(r["prioridade"]);
  return {
    id: z.uuid().parse(r["id"]), setor_id: mapped(maps.sectors, r["setor_id"], true),
    categoria_id: mapped(maps.categories, r["categoria_id"]), cliente_id: r["empresa_id"] || null,
    atividade: r["atividade"] || "", responsavel_id: mapped(maps.users, r["responsavel_id"], true), prioridade, status,
    prazo: r["prazo"] || null, follow_up: r["follow_up"] || null,
    criado_por: mapped(maps.users, r["criado_por"]), atualizado_por: mapped(maps.users, r["atualizado_por"]),
    criado_em: z.string().min(1).parse(r["criado_em"]), ultima_atualizacao: r["ultima_atualizacao"] || null,
  };
}