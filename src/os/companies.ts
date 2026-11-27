/**
 * render.os — registro único das operações e marcas do Grupo Render Hub.
 *
 * O grupo tem 4 operações; cada uma reúne uma ou mais das 6 marcas (GROUP_COMPANIES).
 * Toda tela que precisa saber "quais operações/marcas existem" lê daqui.
 * `slug` é a chave no banco (tabela public.companies). Use Noronha virou Nortrip,
 * mas o slug `use-noronha` foi mantido porque a integração Bling e o plano de contas
 * próprio dependem dele — trocar o slug exige migrar esses pontos juntos.
 */

export type CompanyId = "union" | "render" | "nortrip" | "dompablyto" | "erks" | "sxpaper";
export type OperationId = "union" | "render" | "erks" | "use-noronha";
export type WorkspaceId = "grupo" | CompanyId;

export interface GroupCompany {
  id: CompanyId;
  name: string;
  /** Operação do grupo a que a marca pertence. */
  operation: OperationId;
  /** Slug em public.companies */
  slug: string;
  sector: string;
  description: string;
  /** Cor de identificação (avatar/indicador), não substitui a marca da empresa. */
  color: string;
  initials: string;
  /** Financeiro integrado ao Bling (telas próprias). */
  bling?: boolean;
  /** Símbolo quadrado da marca (avatar no seletor de empresa). */
  mark?: string;
  /** Logo completo (cabeçalhos). */
  logo?: string;
}

export const GROUP_COMPANIES: GroupCompany[] = [
  {
    id: "render",
    operation: "render",
    name: "Render Comex",
    slug: "render-comex",
    sector: "Comércio exterior",
    description: "Importação por conta e ordem, compra por encomenda e distribuição.",
    color: "#1E3A8A",
    initials: "RC",
    mark: "/brand/render-mark.png",
    logo: "/brand/render-logo.png",
  },
  {
    id: "union",
    operation: "union",
    name: "Union Contadores",
    slug: "union-contadores",
    sector: "Contabilidade",
    description: "Consultoria, assessoria contábil e planejamento tributário.",
    color: "#7C2D5B",
    initials: "UC",
    mark: "/brand/union-mark.png",
    logo: "/brand/union-logo.png",
  },
  {
    id: "dompablyto",
    operation: "render",
    name: "Dom Pablyto",
    slug: "dom-pablyto",
    sector: "Alimentos",
    description: "Indústria e distribuição de alimentos — varejo e food service.",
    color: "#DC2626",
    initials: "DP",
    mark: "/brand/dompablyto-mark.png",
    logo: "/brand/dompablyto-logo.png",
  },
  {
    id: "nortrip",
    operation: "use-noronha",
    name: "Nortrip",
    slug: "use-noronha",
    sector: "Turismo",
    description: "Turismo e viagens corporativas.",
    color: "#1C2340",
    initials: "NT",
    bling: true,
    mark: "/brand/nortrip-mark.png",
    logo: "/brand/nortrip-logo.png",
  },
  {
    id: "erks",
    operation: "erks",
    name: "ERKS",
    slug: "erks",
    sector: "Produtos em geral",
    description: "Papéis especiais, bazar e utilidades, tecidos e confecções.",
    color: "#27272A",
    initials: "ER",
  },
  {
    id: "sxpaper",
    operation: "erks",
    name: "SX Paper",
    slug: "sx-paper",
    sector: "Papel",
    description: "Distribuidora de papel térmico — linha SX High Paper.",
    color: "#1D4ED8",
    initials: "SX",
  },
];

export interface GroupOperation {
  id: OperationId;
  name: string;
}

/** As 4 operações do grupo, na ordem em que aparecem nas telas. */
export const GROUP_OPERATIONS: GroupOperation[] = [
  { id: "union", name: "Union" },
  { id: "render", name: "Render" },
  { id: "erks", name: "ERKS Indústria e Distribuidora" },
  { id: "use-noronha", name: "Use Noronha" },
];

export function getOperation(id: OperationId | string | null | undefined): GroupOperation | undefined {
  return GROUP_OPERATIONS.find((o) => o.id === id);
}

/** Marcas de uma operação. */
export function companiesByOperation(id: OperationId): GroupCompany[] {
  return GROUP_COMPANIES.filter((c) => c.operation === id);
}

export const GROUP_WORKSPACE = {
  id: "grupo" as const,
  name: "Grupo Render Hub",
  sector: "Consolidado",
  initials: "RH",
};

export function getCompany(id: WorkspaceId | string | null | undefined): GroupCompany | undefined {
  return GROUP_COMPANIES.find((c) => c.id === id);
}

export function getCompanyBySlug(slug: string | null | undefined): GroupCompany | undefined {
  return GROUP_COMPANIES.find((c) => c.slug === slug);
}
