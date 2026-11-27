import { z } from "zod";
import { GROUP_COMPANIES, type CompanyId } from "./companies";
import { RECURSOS, type AcessoRow, type Escopo } from "./recursos";

/** Regras de conta de usuário do render.os, compartilhadas entre tela e servidor. */
export const SENHA_MINIMA = 8;

export const senhaSchema = z.string().min(SENHA_MINIMA, `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`).max(72, "A senha pode ter no máximo 72 caracteres.");

export const definirSenhaSchema = z.object({ userId: z.string().uuid(), senha: senhaSchema });

export const criarUsuarioSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome.").max(120),
  email: z.string().trim().toLowerCase().email("E-mail inválido.").max(255),
  senha: senhaSchema,
  /** Empresas e módulos liberados já na criação. */
  selecao: z.lazy(() => selecaoSchema).optional(),
});

export const trocarSenhaSchema = z.object({ senha: senhaSchema });

export interface UsuarioConta {
  id: string;
  nome: string;
  email: string;
  criado_em: string;
  ultimo_acesso: string | null;
  /** E-mail confirmado: a pessoa consegue entrar. */
  ativo: boolean;
  /** Senha definida por um administrador, ainda não trocada pela pessoa. */
  senha_provisoria: boolean;
  /** Administrador do render.os: vê e edita tudo. */
  admin: boolean;
  /** Telas liberadas (mesma base da aba Acessos). */
  acessos: AcessoRow[];
}

/** Situação mostrada na aba Usuários. */
export function situacaoDaConta(u: Pick<UsuarioConta, "ativo" | "senha_provisoria" | "ultimo_acesso">): "pendente" | "provisoria" | "ativa" | "nunca-entrou" {
  if (!u.ativo) return "pendente";
  if (u.senha_provisoria) return "provisoria";
  return u.ultimo_acesso ? "ativa" : "nunca-entrou";
}

/* ───────────── Empresas e módulos por usuário ───────────── */

/** Módulos que podem ser liberados na aba Usuários; `id` casa com `modulo` do catálogo de abas. */
export const MODULOS_ACESSO = [
  { id: "Financeiro", rotulo: "Financeiro" },
  { id: "Operacional", rotulo: "Operacional" },
  { id: "RH", rotulo: "Pessoas (RH)" },
  { id: "IA", rotulo: "IA" },
] as const;
export type ModuloAcesso = (typeof MODULOS_ACESSO)[number]["id"];

/** "parcial" = ajuste fino feito na aba Acessos; ao salvar, fica como está. */
export type EstadoModulo = "sim" | "nao" | "parcial";

export interface SelecaoAcesso {
  marcas: CompanyId[];
  modulos: Record<ModuloAcesso, EstadoModulo>;
}

export const SELECAO_VAZIA: SelecaoAcesso = { marcas: [], modulos: { Financeiro: "nao", Operacional: "nao", RH: "nao", IA: "nao" } };

const estadoSchema = z.enum(["sim", "nao", "parcial"]);
export const selecaoSchema = z.object({
  marcas: z.array(z.enum(["union", "render", "nortrip", "dompablyto", "erks", "sxpaper"])).max(6),
  modulos: z.object({ Financeiro: estadoSchema, Operacional: estadoSchema, RH: estadoSchema, IA: estadoSchema }),
});
export const salvarAcessosSchema = z.object({ userId: z.string().uuid(), selecao: selecaoSchema });

const MARCAS: CompanyId[] = GROUP_COMPANIES.map((c) => c.id);
const ehMarca = (empresa: string): empresa is CompanyId => (MARCAS as string[]).includes(empresa);
const ehModulo = (m: string | undefined): m is ModuloAcesso => MODULOS_ACESSO.some((x) => x.id === m);
function moduloDe(recurso: string): ModuloAcesso | undefined {
  const m = RECURSOS.find((r) => r.key === recurso)?.modulo;
  return ehModulo(m) ? m : undefined;
}

/** Telas de um módulo nas marcas dadas. IA é do grupo inteiro e não depende de marca. */
export function telasDoModulo(modulo: ModuloAcesso, marcas: CompanyId[]): { empresa: Escopo; recurso: string }[] {
  const lugares: Escopo[] = modulo === "IA" ? ["grupo"] : marcas;
  return RECURSOS.filter((r) => r.modulo === modulo).flatMap((r) =>
    lugares.filter((l) => r.empresas.includes(l)).map((l) => ({ empresa: l, recurso: r.key })),
  );
}

/** Lê os acessos gravados como "marcas + módulos" para a janela da aba Usuários. */
export function selecaoDosAcessos(atuais: AcessoRow[]): SelecaoAcesso {
  const marcas = MARCAS.filter((m) => atuais.some((a) => a.empresa === m));
  const nivel = new Map(atuais.map((a) => [`${a.empresa}|${a.recurso}`, a.nivel]));
  const modulos = { ...SELECAO_VAZIA.modulos };
  for (const { id } of MODULOS_ACESSO) {
    const gravadas = atuais.filter((a) => moduloDe(a.recurso) === id && (ehMarca(a.empresa) || a.empresa === "grupo"));
    if (!gravadas.length) continue;
    const telas = telasDoModulo(id, marcas);
    const completo = telas.length === gravadas.length && telas.every((t) => nivel.get(`${t.empresa}|${t.recurso}`) === 2);
    modulos[id] = completo ? "sim" : "parcial";
  }
  return { marcas, modulos };
}

/**
 * Transforma a seleção em mudanças nos acessos: módulo marcado libera ver e editar (nível 2)
 * todas as telas dele nas marcas marcadas; marca ou módulo desmarcado perde tudo.
 */
export function acessosDaSelecao(atuais: AcessoRow[], sel: SelecaoAcesso): { gravar: AcessoRow[]; remover: { empresa: string; recurso: string }[] } {
  const marcadas = new Set<string>(sel.marcas);
  const nivel = new Map(atuais.map((a) => [`${a.empresa}|${a.recurso}`, a.nivel]));
  const remover = atuais
    .filter((a) => {
      const m = moduloDe(a.recurso);
      const marcaDesmarcada = ehMarca(a.empresa) && !marcadas.has(a.empresa);
      return marcaDesmarcada || (m !== undefined && sel.modulos[m] === "nao");
    })
    .map((a) => ({ empresa: a.empresa, recurso: a.recurso }));
  const gravar: AcessoRow[] = [];
  for (const { id } of MODULOS_ACESSO) {
    if (sel.modulos[id] !== "sim") continue;
    for (const t of telasDoModulo(id, sel.marcas)) {
      if (nivel.get(`${t.empresa}|${t.recurso}`) !== 2) gravar.push({ empresa: t.empresa, recurso: t.recurso, nivel: 2 });
    }
  }
  return { gravar, remover };
}

/** Módulos marcados que não têm nenhuma tela nas marcas marcadas (ex.: Operacional fora da Union e da Render Comex). */
export function modulosSemTela(sel: SelecaoAcesso): ModuloAcesso[] {
  return MODULOS_ACESSO.map((m) => m.id).filter((id) => sel.modulos[id] === "sim" && telasDoModulo(id, sel.marcas).length === 0);
}

/** Resumo de uma linha para a lista de usuários. */
export function resumoDoAcesso(admin: boolean, atuais: AcessoRow[]): string {
  if (admin) return "Administrador";
  const sel = selecaoDosAcessos(atuais);
  const modulos = MODULOS_ACESSO.filter((m) => sel.modulos[m.id] !== "nao").map((m) => (sel.modulos[m.id] === "parcial" ? `${m.rotulo} (parcial)` : m.rotulo));
  if (!modulos.length) return "Sem acesso";
  const marcas = GROUP_COMPANIES.filter((c) => sel.marcas.includes(c.id)).map((c) => c.name);
  return [marcas.join(", "), modulos.join(", ")].filter(Boolean).join(" · ");
}
