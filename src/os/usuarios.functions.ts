import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { criarUsuarioSchema, definirSenhaSchema, trocarSenhaSchema, type UsuarioConta } from "./usuarios";

const SEM_PERMISSAO = "Somente administradores do render.os gerenciam usuários.";

/** Lista todas as contas do render.os (só administradores). */
export const listarUsuarios = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<UsuarioConta[]> => {
    const { data: admin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "controller" });
    if (!admin) throw new Error(SEM_PERMISSAO);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const contas: UsuarioConta[] = [];
    for (let page = 1; ; page++) {
      const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw new Error("Não foi possível carregar os usuários.");
      for (const u of data.users) {
        const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
        const app = (u.app_metadata ?? {}) as Record<string, unknown>;
        const email = u.email ?? "";
        const nome = typeof meta["full_name"] === "string" && meta["full_name"] ? meta["full_name"] : typeof meta["name"] === "string" && meta["name"] ? meta["name"] : email.split("@")[0] ?? email;
        contas.push({
          id: u.id,
          nome,
          email,
          criado_em: u.created_at,
          ultimo_acesso: u.last_sign_in_at ?? null,
          ativo: Boolean(u.email_confirmed_at),
          senha_provisoria: app["senha_provisoria"] === true,
        });
      }
      if (data.users.length < 1000) break;
    }
    return contas.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  });

/** Administrador define uma senha provisória: libera a entrada e obriga a troca no primeiro acesso. */
export const definirSenhaProvisoria = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => definirSenhaSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: admin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "controller" });
    if (!admin) throw new Error(SEM_PERMISSAO);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { error } = await db.auth.admin.updateUserById(data.userId, {
      password: data.senha,
      email_confirm: true,
      app_metadata: { senha_provisoria: true },
    });
    if (error) {
      console.error("[usuarios] definir senha provisória falhou:", error.message);
      throw new Error("Não foi possível definir a senha. Tente uma senha diferente.");
    }
    return { ok: true };
  });

/** Administrador cria uma conta já com senha provisória. */
export const criarUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => criarUsuarioSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: admin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "controller" });
    if (!admin) throw new Error(SEM_PERMISSAO);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { error } = await db.auth.admin.createUser({
      email: data.email,
      password: data.senha,
      email_confirm: true,
      user_metadata: { full_name: data.nome },
      app_metadata: { senha_provisoria: true },
    });
    if (error) {
      console.error("[usuarios] criar usuário falhou:", error.message);
      throw new Error(/already|registered|exists/i.test(error.message) ? "Já existe um usuário com este e-mail." : "Não foi possível criar o usuário.");
    }
    return { ok: true };
  });

/** A própria pessoa troca a senha provisória pela definitiva. */
export const trocarSenhaProvisoria = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => trocarSenhaSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { error } = await db.auth.admin.updateUserById(context.userId, {
      password: data.senha,
      app_metadata: { senha_provisoria: false },
    });
    if (error) {
      console.error("[usuarios] trocar senha provisória falhou:", error.message);
      throw new Error("Não foi possível salvar a nova senha. Tente uma senha diferente.");
    }
    return { ok: true };
  });
