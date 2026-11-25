import type { LucideIcon } from "lucide-react";
import {
  House, Wallet, ShoppingBag, Users, Settings,
  LayoutDashboard, ArrowLeftRight, FlaskConical, ListTree, Building2, PlugZap, LineChart,
  Workflow, ListChecks, UsersRound, Tags, FileSpreadsheet, Database, Sparkles, Rocket, GraduationCap, Ship, ShieldCheck,
} from "lucide-react";
import type { WorkspaceId } from "./companies";
import type { Escopo } from "./acessos";

/**
 * render.os — registro de módulos.
 * Cada módulo é um ícone no trilho escuro; seus `items` formam o menu do painel ao lado.
 * Módulos com `status: "soon"` aparecem no trilho, mas abrem a página "em construção".
 */

export interface ModuleItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Restringe o item a certos workspaces (ex.: integração Bling só na Nortrip). */
  only?: WorkspaceId[];
  /** Esconde o item no workspace consolidado do grupo. */
  hideInGroup?: boolean;
  /** Só aparece para administradores do render.os. */
  adminOnly?: boolean;
  /** Chave da aba em Pessoas › Acessos (ver src/os/acessos.ts). */
  perm?: string;
  /** Empresa fixa da permissão (ex.: Contábil = union). Sem isso, vale a empresa selecionada. */
  escopo?: Escopo;
}

export interface OsModule {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  status: "live" | "soon";
  /** Rota de entrada do módulo. */
  home: string;
  items: ModuleItem[];
}

/** Workspaces onde as telas da Union aparecem (a própria Union e a visão do grupo). */
const UNION: WorkspaceId[] = ["union", "grupo"];
/** Telas do follow-up de importação da Render Comex. */
const COMEX: WorkspaceId[] = ["render"];

export const MODULES: OsModule[] = [
  {
    id: "inicio",
    label: "Início",
    description: "Visão do grupo e das empresas.",
    icon: House,
    status: "live",
    home: "/inicio",
    items: [{ to: "/inicio", label: "Visão geral", icon: LayoutDashboard }],
  },
  {
    id: "financeiro",
    label: "Financeiro",
    description: "Lançamentos, fluxo de caixa, DRE e simulações.",
    icon: Wallet,
    status: "live",
    home: "/dashboard",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: LineChart, perm: "fin.dashboard" },
      { to: "/lancamentos", label: "Lançamentos", icon: ArrowLeftRight, hideInGroup: true, perm: "fin.lancamentos" },
      { to: "/fluxo-de-caixa", label: "Fluxo de caixa", icon: Wallet, perm: "fin.fluxo" },
      { to: "/simulacoes", label: "Simulações", icon: FlaskConical, hideInGroup: true, perm: "fin.simulacoes" },
      { to: "/plano-de-contas", label: "Plano de contas", icon: ListTree, hideInGroup: true, perm: "fin.plano" },
      { to: "/centros-de-custo", label: "Centros de custo", icon: Building2, hideInGroup: true, perm: "fin.centros" },
      { to: "/financeiro", label: "Integração Bling", icon: PlugZap, only: ["nortrip"], perm: "fin.bling" },
    ],
  },
  {
    id: "comercial",
    label: "Comercial",
    description: "Pedidos, clientes, faturamento e ritmo contra a meta.",
    icon: ShoppingBag,
    status: "soon",
    home: "/modulo/comercial",
    items: [],
  },
  {
    // Operacional = o dia a dia de cada empresa. O conteúdo muda com a empresa
    // selecionada: na Union são as tarefas contábeis; Render Comex (processos de
    // importação), Nortrip e as demais entram aqui conforme forem construídas.
    id: "operacional",
    label: "Operacional",
    description: "O dia a dia de cada empresa. Na Union: atividades e prazos contábeis. Na Render Comex: follow-up das importações.",
    icon: Workflow,
    status: "live",
    home: "/contabil",
    items: [
      { to: "/contabil", label: "Painel", icon: LayoutDashboard, only: UNION, perm: "con.painel", escopo: "union" },
      { to: "/contabil/atividades", label: "Atividades", icon: ListChecks, only: UNION, perm: "con.atividades", escopo: "union" },
      { to: "/contabil/clientes", label: "Empresas clientes", icon: Building2, only: UNION, perm: "con.clientes", escopo: "union" },
      { to: "/contabil/equipe", label: "Equipe", icon: UsersRound, only: UNION, perm: "con.equipe", escopo: "union" },
      { to: "/contabil/cadastros", label: "Setores e tipos", icon: Tags, only: UNION, perm: "con.cadastros", escopo: "union" },
      { to: "/contabil/bases", label: "Bases da Union", icon: Database, only: UNION, perm: "con.bases", escopo: "union" },
      { to: "/contabil/importar", label: "Importar planilha", icon: FileSpreadsheet, only: UNION, perm: "con.importar", escopo: "union" },
      { to: "/comex", label: "Follow-up", icon: Ship, only: COMEX, perm: "cx.followup", escopo: "render" },
      { to: "/comex/clientes", label: "Clientes", icon: Building2, only: COMEX, perm: "cx.clientes", escopo: "render" },
    ],
  },
  {
    id: "ia",
    label: "IA",
    description: "O que o departamento de IA entrega: plataformas, automações, ganho e capacitação.",
    icon: Sparkles,
    status: "live",
    home: "/ia",
    items: [
      { to: "/ia", label: "Visão geral", icon: LayoutDashboard, perm: "ia.visao", escopo: "grupo" },
      { to: "/ia/entregas", label: "Entregas", icon: Rocket, perm: "ia.entregas", escopo: "grupo" },
      { to: "/ia/empresas", label: "Por empresa", icon: Building2, perm: "ia.empresas", escopo: "grupo" },
      { to: "/ia/treinamento", label: "Treinamento", icon: GraduationCap, perm: "ia.treinamento", escopo: "grupo" },
    ],
  },
  {
    id: "pessoas",
    label: "Pessoas",
    description: "Quem acessa o quê: por empresa, aba e nível.",
    icon: Users,
    status: "live",
    home: "/pessoas/acessos",
    items: [{ to: "/pessoas/acessos", label: "Acessos", icon: ShieldCheck, adminOnly: true }],
  },
];

export const SETTINGS_MODULE: OsModule = {
  id: "configuracoes",
  label: "Configurações",
  description: "Empresas, integrações e preferências do render.os.",
  icon: Settings,
  status: "soon",
  home: "/modulo/configuracoes",
  items: [],
};

const ALL = [...MODULES, SETTINGS_MODULE];

export function getModule(id: string): OsModule | undefined {
  return ALL.find((m) => m.id === id);
}

/** Descobre o módulo dono da rota atual. */
export function moduleForPath(pathname: string): OsModule {
  if (pathname.startsWith("/modulo/")) {
    return getModule(pathname.split("/")[2] ?? "") ?? MODULES[0];
  }
  return (
    ALL.find((m) => m.items.some((i) => pathname === i.to || pathname.startsWith(i.to + "/"))) ??
    MODULES[0]
  );
}

/** Resposta de permissão: nível da pessoa numa aba (0 sem acesso, 1 ver, 2 editar). */
export type NivelFn = (workspace: WorkspaceId, recurso: string) => number;

export function visibleItems(mod: OsModule, workspace: WorkspaceId, nivelNo: NivelFn, isAdmin: boolean): ModuleItem[] {
  return mod.items.filter((i) => {
    if (i.adminOnly && !isAdmin) return false;
    if (i.only && !i.only.includes(workspace)) return false;
    if (workspace === "grupo" && i.hideInGroup) return false;
    if (i.perm && nivelNo(i.escopo ?? workspace, i.perm) < 1) return false;
    return true;
  });
}

/** O módulo tem alguma aba liberada em algum lugar? (para esconder ícones do trilho) */
export function moduleHasAccess(mod: OsModule, nivelNo: NivelFn, isAdmin: boolean): boolean {
  if (mod.status !== "live" || mod.id === "inicio") return true;
  return mod.items.some((i) => {
    if (i.adminOnly) return isAdmin;
    if (!i.perm) return true;
    const lugares: WorkspaceId[] = i.escopo ? [i.escopo] : (i.only ?? ["render", "union", "dompablyto", "nortrip", "erks", "sxpaper"]);
    return lugares.some((w) => nivelNo(w, i.perm!) >= 1);
  });
}
