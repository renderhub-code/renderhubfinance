import { GROUP_COMPANIES, type CompanyId } from "./companies";

/**
 * Catálogo de abas com permissão do render.os. Módulo puro (sem banco nem React),
 * para ser lido pela tela, pelo servidor e pelos testes.
 */

/** 0 = sem acesso · 1 = só vê · 2 = vê e edita */
export type Nivel = 0 | 1 | 2;
export const NIVEL_LABEL: Record<Nivel, string> = { 0: "Sem acesso", 1: "Ver", 2: "Editar" };

/** Onde a permissão vale: uma empresa ou as áreas do grupo (IA). */
export type Escopo = CompanyId | "grupo";

export interface Recurso {
  key: string;
  label: string;
  modulo: string;
  /** Empresas em que a aba existe. */
  empresas: Escopo[];
  /** O que "Editar" libera, para a tela de acessos. */
  edita?: string;
}

export const TODAS: CompanyId[] = GROUP_COMPANIES.map((c) => c.id);

/** Catálogo de abas com permissão. A chave casa com `perm` em modules.ts e com o banco. */
export const RECURSOS: Recurso[] = [
  { key: "fin.dashboard", label: "Dashboard", modulo: "Financeiro", empresas: TODAS },
  { key: "fin.lancamentos", label: "Lançamentos", modulo: "Financeiro", empresas: TODAS, edita: "lançar, editar e importar" },
  { key: "fin.fluxo", label: "Fluxo de caixa", modulo: "Financeiro", empresas: TODAS, edita: "sincronizar e ajustar saldos" },
  { key: "fin.simulacoes", label: "Simulações", modulo: "Financeiro", empresas: TODAS, edita: "criar e editar cenários" },
  { key: "fin.plano", label: "Plano de contas", modulo: "Financeiro", empresas: TODAS, edita: "contas e de-para" },
  { key: "fin.centros", label: "Centros de custo", modulo: "Financeiro", empresas: TODAS, edita: "criar e editar" },
  { key: "fin.bling", label: "Integração Bling", modulo: "Financeiro", empresas: ["nortrip"], edita: "conectar e sincronizar" },

  { key: "con.painel", label: "Painel", modulo: "Operacional", empresas: ["union"] },
  { key: "con.atividades", label: "Atividades", modulo: "Operacional", empresas: ["union"], edita: "abrir e atualizar atividades" },
  { key: "con.agenda", label: "Agenda de reuniões", modulo: "Operacional", empresas: ["union"] },
  { key: "con.clientes", label: "Empresas clientes", modulo: "Operacional", empresas: ["union"], edita: "cadastrar e editar" },
  { key: "con.equipe", label: "Equipe", modulo: "Operacional", empresas: ["union"], edita: "setores e papéis · torna administrador do Contábil" },
  { key: "con.cadastros", label: "Setores e tipos", modulo: "Operacional", empresas: ["union"], edita: "criar e editar · torna administrador do Contábil" },
  { key: "con.bases", label: "Bases da Union", modulo: "Operacional", empresas: ["union"], edita: "importar bases · torna administrador do Contábil" },
  { key: "con.importar", label: "Importar planilha", modulo: "Operacional", empresas: ["union"], edita: "importar · torna administrador do Contábil" },

  { key: "cx.followup", label: "Follow-up", modulo: "Operacional", empresas: ["render"], edita: "criar e atualizar POs" },
  { key: "cx.clientes", label: "Clientes do portal", modulo: "Operacional", empresas: ["render"], edita: "clientes e e-mails do portal" },

  { key: "rh.painel", label: "Painel e indicadores", modulo: "RH", empresas: TODAS },
  { key: "rh.colaboradores", label: "Colaboradores", modulo: "RH", empresas: TODAS, edita: "cadastrar, editar e desligar" },
  { key: "rh.remuneracao", label: "Salários, folha e custos", modulo: "RH", empresas: TODAS, edita: "salários, benefícios, folha, custos e orçamento" },
  { key: "rh.calendario", label: "Calendário RH", modulo: "RH", empresas: TODAS, edita: "atividades recorrentes" },
  { key: "rh.avaliacoes", label: "Avaliações (9 Box e desempenho)", modulo: "RH", empresas: TODAS, edita: "registrar avaliações" },
  { key: "rh.aso", label: "Saúde ocupacional / ASO", modulo: "RH", empresas: TODAS, edita: "registrar ASOs · dado sensível" },
  { key: "rh.pj", label: "Contratos PJ", modulo: "RH", empresas: TODAS, edita: "cadastrar e renovar contratos" },
  { key: "rh.documentos", label: "Documentos e prazos", modulo: "RH", empresas: TODAS, edita: "controles e vencimentos" },

  { key: "ia.visao", label: "Visão geral", modulo: "IA", empresas: ["grupo"] },
  { key: "ia.entregas", label: "Entregas", modulo: "IA", empresas: ["grupo"], edita: "entregas e diário" },
  { key: "ia.empresas", label: "Por marca", modulo: "IA", empresas: ["grupo"] },
  { key: "ia.treinamento", label: "Treinamento", modulo: "IA", empresas: ["grupo"], edita: "trilha e progresso" },
];

export const recursosDe = (escopo: Escopo) => RECURSOS.filter((r) => r.empresas.includes(escopo));

export interface AcessoRow { empresa: string; recurso: string; nivel: Nivel }
