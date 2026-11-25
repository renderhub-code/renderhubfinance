import type { LucideIcon } from "lucide-react";
import {
  House, Wallet, ShoppingBag, Users, Settings,
  LayoutDashboard, ArrowLeftRight, FlaskConical, ListTree, Building2, PlugZap, LineChart,
  Workflow, ListChecks, UsersRound, Tags, FileSpreadsheet, Database, Sparkles, Rocket, GraduationCap, KeyRound, Ship, ShieldCheck,
} from "lucide-react";
import type { WorkspaceId } from "./companies";

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
  /** Só aparece para administradores do módulo (hoje: Contábil). */
  adminOnly?: boolean;
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
      { to: "/dashboard", label: "Dashboard", icon: LineChart },
      { to: "/lancamentos", label: "Lançamentos", icon: ArrowLeftRight, hideInGroup: true },
      { to: "/fluxo-de-caixa", label: "Fluxo de caixa", icon: Wallet },
      { to: "/simulacoes", label: "Simulações", icon: FlaskConical, hideInGroup: true },
      { to: "/plano-de-contas", label: "Plano de contas", icon: ListTree, hideInGroup: true },
      { to: "/centros-de-custo", label: "Centros de custo", icon: Building2, hideInGroup: true },
      { to: "/financeiro", label: "Integração Bling", icon: PlugZap, only: ["nortrip"] },
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
      { to: "/contabil", label: "Painel", icon: LayoutDashboard, only: UNION },
      { to: "/contabil/atividades", label: "Atividades", icon: ListChecks, only: UNION },
      { to: "/contabil/clientes", label: "Empresas clientes", icon: Building2, only: UNION },
      { to: "/contabil/equipe", label: "Equipe", icon: UsersRound, adminOnly: true, only: UNION },
      { to: "/contabil/cadastros", label: "Setores e tipos", icon: Tags, adminOnly: true, only: UNION },
      { to: "/contabil/bases", label: "Bases da Union", icon: Database, adminOnly: true, only: UNION },
      { to: "/contabil/importar", label: "Importar planilha", icon: FileSpreadsheet, adminOnly: true, only: UNION },
      { to: "/comex", label: "Follow-up", icon: Ship, only: COMEX },
      { to: "/comex/clientes", label: "Clientes", icon: Building2, only: COMEX },
      { to: "/comex/equipe", label: "Equipe", icon: UsersRound, adminOnly: true, only: COMEX },
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
      { to: "/ia", label: "Visão geral", icon: LayoutDashboard },
      { to: "/ia/entregas", label: "Entregas", icon: Rocket },
      { to: "/ia/empresas", label: "Por empresa", icon: Building2 },
      { to: "/ia/treinamento", label: "Treinamento", icon: GraduationCap },
      { to: "/ia/acesso", label: "Acesso", icon: KeyRound, adminOnly: true },
    ],
  },
  {
    id: "pessoas",
    label: "Pessoas",
    description: "Usuários e acessos ao render.os.",
    icon: Users,
    status: "live",
    home: "/pessoas/acessos",
    items: [{ to: "/pessoas/acessos", label: "Acessos", icon: ShieldCheck }],
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

export function visibleItems(mod: OsModule, workspace: WorkspaceId, isModuleAdmin = true): ModuleItem[] {
  return mod.items.filter((i) => {
    if (i.adminOnly && !isModuleAdmin) return false;
    if (i.only && !i.only.includes(workspace)) return false;
    if (workspace === "grupo" && i.hideInGroup) return false;
    return true;
  });
}
