import { z } from "zod";

/** Regras de conta de usuário do render.os, compartilhadas entre tela e servidor. */
export const SENHA_MINIMA = 8;

export const senhaSchema = z.string().min(SENHA_MINIMA, `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`).max(72, "A senha pode ter no máximo 72 caracteres.");

export const definirSenhaSchema = z.object({ userId: z.string().uuid(), senha: senhaSchema });

export const criarUsuarioSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome.").max(120),
  email: z.string().trim().toLowerCase().email("E-mail inválido.").max(255),
  senha: senhaSchema,
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
}

/** Situação mostrada na aba Usuários. */
export function situacaoDaConta(u: Pick<UsuarioConta, "ativo" | "senha_provisoria" | "ultimo_acesso">): "pendente" | "provisoria" | "ativa" | "nunca-entrou" {
  if (!u.ativo) return "pendente";
  if (u.senha_provisoria) return "provisoria";
  return u.ultimo_acesso ? "ativa" : "nunca-entrou";
}
