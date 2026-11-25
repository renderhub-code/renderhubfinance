import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { projectUnionActivity, sanitizeUnionRow, unionBool, unionChunkSchema, unionIdentitiesSchema, unionName, unionRecordId } from "./union-import";
import type { Json } from "@/integrations/supabase/types";

export const importUnionIdentities = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => unionIdentitiesSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: allowed, error: authError } = await context.supabase.rpc("contabil_is_admin", { _uid: context.userId });
    if (authError || !allowed) throw new Error("Somente administradores da contabilidade podem importar as bases.");
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const emails = data.map((p) => p.email.trim().toLowerCase());
    if (new Set(emails).size !== emails.length) throw new Error("Existem e-mails repetidos na base de pessoas.");
    const { data: sectors, error: sectorsError } = await db.from("contabil_bases_union").select("registro_id,destino_id").eq("base", "setores");
    if (sectorsError) throw sectorsError;
    const sectorMap = new Map((sectors ?? []).map((s) => [s.registro_id, s.destino_id]));
    const { data: identities, error: identityError } = await db.from("contabil_identidades_union").select("*");
    if (identityError) throw identityError;
    const known = new Map((identities ?? []).map((p) => [p.original_id, p]));
    const users = new Map<string, { id: string; confirmed: boolean }>();
    for (let page = 1; ; page++) {
      const { data: result, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw error;
      for (const u of result.users) if (u.email) users.set(u.email.trim().toLowerCase(), { id: u.id, confirmed: Boolean(u.email_confirmed_at) });
      if (result.users.length < 1000) break;
    }
    let awaitingVerification = 0;
    for (const person of data) {
      const email = person.email.trim().toLowerCase();
      const saved = known.get(person.original_id);
      if (saved && saved.email !== email) throw new Error("O e-mail de uma identidade já importada mudou; revise antes de vincular.");
      let target = users.get(email);
      if (saved && target?.id !== saved.auth_user_id) throw new Error("A identidade de origem não corresponde à conta salva.");
      if (!target) {
        // No password, auto-confirmation, invitation or bulk migration email.
        const { data: created, error } = await db.auth.admin.createUser({ email, email_confirm: false, user_metadata: { full_name: person.nome } });
        if (error || !created.user) throw error ?? new Error("Não foi possível preparar a conta da pessoa.");
        target = { id: created.user.id, confirmed: false };
        users.set(email, target);
      }
      if (!target.confirmed) awaitingVerification++;
      const setorId = person.setor_id ? sectorMap.get(person.setor_id) : null;
      if (person.setor_id && !setorId) throw new Error("Setor da pessoa não encontrado.");
      const { error: mapError } = await db.from("contabil_identidades_union").upsert({ original_id: person.original_id, auth_user_id: target.id, email }, { onConflict: "original_id", ignoreDuplicates: true });
      if (mapError) throw mapError;
      // Membership is server-controlled and separate from profile metadata.
      // Re-uploading never changes roles already edited in render.os.
      const { error: memberError } = await db.from("contabil_membros").upsert({ user_id: target.id, nome: person.nome, email, setor_id: setorId ?? null, papel: person.papel, atribuicao_global: person.atribuicao_global, ativo: true }, { onConflict: "user_id", ignoreDuplicates: true });
      if (memberError) throw memberError;
    }
    return { imported: data.length, awaitingVerification };
  });

export const importUnionChunk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => unionChunkSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: allowed, error: authError } = await context.supabase.rpc("contabil_is_admin", { _uid: context.userId });
    if (authError || !allowed) throw new Error("Somente administradores da contabilidade podem importar as bases.");
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const rows = data.rows.map((r) => sanitizeUnionRow(data.base, r));
    const archive: { base: string; registro_id: string; destino_id: string | null; dados: Json }[] = [];
    const [sectorResult, categoryResult, identityResult] = await Promise.all([
      db.from("contabil_bases_union").select("registro_id,destino_id").eq("base", "setores"),
      db.from("contabil_bases_union").select("registro_id,destino_id").eq("base", "categorias_atividade"),
      db.from("contabil_identidades_union").select("original_id,auth_user_id"),
    ]);
    if (sectorResult.error || categoryResult.error || identityResult.error) throw sectorResult.error ?? categoryResult.error ?? identityResult.error;
    const sectors = new Map((sectorResult.data ?? []).flatMap((s) => s.destino_id ? [[s.registro_id, s.destino_id] as const] : []));
    const categories = new Map((categoryResult.data ?? []).flatMap((s) => s.destino_id ? [[s.registro_id, s.destino_id] as const] : []));
    const users = new Map((identityResult.data ?? []).map((u) => [u.original_id, u.auth_user_id]));

    if (data.base === "setores") {
      const { data: existing, error } = await db.from("contabil_setores").select("id,nome");
      if (error) throw error;
      const byName = new Map((existing ?? []).map((s) => [unionName(s.nome), s.id]));
      for (const row of rows) {
        const name = row["nome"] ?? "";
        let id = byName.get(unionName(name));
        if (!id) {
          const result = await db.from("contabil_setores").insert({ id: unionRecordId(data.base, row), nome: name }).select("id").single();
          if (result.error || !result.data) throw result.error ?? new Error("Falha ao importar setor.");
          id = result.data.id;
          byName.set(unionName(name), id);
        }
        sectors.set(unionRecordId(data.base, row), id);
      }
    } else if (data.base === "categorias_atividade") {
      const { data: existing, error } = await db.from("contabil_categorias").select("id,nome,setor_id");
      if (error) throw error;
      const byName = new Map((existing ?? []).map((s) => [`${s.setor_id}:${unionName(s.nome)}`, s.id]));
      for (const row of rows) {
        const sector = sectors.get(row["setor_id"] ?? "");
        if (!sector) throw new Error("Setor do tipo de atividade não encontrado.");
        const name = row["nome"] ?? "";
        const key = `${sector}:${unionName(name)}`;
        let id = byName.get(key);
        if (!id) {
          const result = await db.from("contabil_categorias").insert({ id: unionRecordId(data.base, row), setor_id: sector, nome: name, ordem: Number(row["ordem"] || 100), ativo: unionBool(row["ativo"]), criado_por: row["criado_por"] ? users.get(row["criado_por"]) ?? null : null, ...(row["criado_em"] ? { criado_em: row["criado_em"] } : {}) }).select("id").single();
          if (result.error || !result.data) throw result.error ?? new Error("Falha ao importar tipo.");
          id = result.data.id;
          byName.set(key, id);
        }
        categories.set(unionRecordId(data.base, row), id);
      }
    } else if (data.base === "empresas") {
      const payload = rows.map((row) => ({
        id: unionRecordId(data.base, row), razao_social: row["razao_social"] || "", nome_fantasia: row["nome_fantasia"] || null,
        cnpj: row["cnpj"] || null, codigo_dominio: row["codigo_dominio"] || null, apelido: row["apelido"] || null,
        grupo_economico: row["grupo_economico"] || null, regime: row["regime"] || null, segmento: row["segmento"] || null,
        uf: row["uf"] || null, cidade: row["cidade"] || null, ativo: unionBool(row["ativo"]),
        ...(row["criado_em"] ? { criado_em: row["criado_em"] } : {}),
      }));
      const { error } = await db.from("contabil_clientes").upsert(payload, { onConflict: "id", ignoreDuplicates: true });
      if (error) throw error;
    } else if (data.base === "atividades") {
      const payload = rows.map((r) => projectUnionActivity(r, { sectors, categories, users }));
      const { error } = await db.from("contabil_atividades").upsert(payload, { onConflict: "id", ignoreDuplicates: true });
      if (error) throw error;
    } else if (data.base === "atividade_ciencias") {
      const payload = rows.map((row) => {
        const userId = users.get(row["user_id"] ?? "");
        if (!userId) throw new Error("Pessoa da ciência não encontrada.");
        return { atividade_id: row["atividade_id"] ?? "", user_id: userId, ...(row["ciente_em"] ? { ciente_em: row["ciente_em"] } : {}) };
      });
      const { error } = await db.from("contabil_ciencias").upsert(payload, { onConflict: "atividade_id,user_id", ignoreDuplicates: true });
      if (error) throw error;
    }

    for (const row of rows) {
      const id = unionRecordId(data.base, row);
      const destination = data.base === "setores" ? sectors.get(id) : data.base === "categorias_atividade" ? categories.get(id) : data.base === "profiles" ? users.get(id) : data.base === "empresas" || data.base === "atividades" ? id : null;
      archive.push({ base: data.base, registro_id: id, destino_id: destination ?? null, dados: row });
    }
    const { error } = await db.from("contabil_bases_union").upsert(archive, { onConflict: "base,registro_id", ignoreDuplicates: true });
    if (error) throw error;
    return { imported: rows.length };
  });

export const isUnionAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Auth middleware verifies the session; no supplied email or ID can claim a profile.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.from("contabil_identidades_union").select("original_id").eq("auth_user_id", context.userId).maybeSingle();
    if (error) throw error;
    return Boolean(data);
  });