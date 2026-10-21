import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Client = SupabaseClient<Database>;
type AccountType = "entrada" | "saida";

export interface GroupPayload {
  code: string;
  name: string;
  type: AccountType;
  dre_section: string;
  sort_order: number;
  originalCode?: string | null;
}

export interface SubgroupPayload {
  code: string;
  name: string;
  sort_order: number;
  originalCode?: string | null;
  group: GroupPayload;
}

export interface AccountPayload {
  code: string;
  name: string;
  type: AccountType;
  sort_order: number;
  active: boolean;
  originalCode?: string | null;
  subgroup: SubgroupPayload;
}

/** Empresas com plano de contas próprio (categorias do Bling), fora da replicação padrão. */
const OWN_PLAN_SLUGS = ["use-noronha"];

/**
 * Empresas que recebem a alteração: a própria empresa quando ela tem plano próprio;
 * caso contrário, todas as empresas ativas que compartilham o plano padrão.
 */
async function activeCompanyIds(supabase: Client, companyId?: string | null): Promise<string[]> {
  const { data, error } = await supabase.from("companies").select("id,slug").eq("active", true);
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const source = companyId ? rows.find((c) => c.id === companyId) : undefined;
  if (source && OWN_PLAN_SLUGS.includes(source.slug)) return [source.id];
  return rows.filter((c) => !OWN_PLAN_SLUGS.includes(c.slug)).map((c) => c.id);
}

function fail(message: string): never {
  if (message.includes("duplicate key") || message.includes("violates unique")) {
    throw new Error("Já existe um registro com esse código.");
  }
  throw new Error(message);
}

/** Garante o grupo (por código) na empresa, criando ou atualizando. Retorna o id. */
async function ensureGroup(supabase: Client, companyId: string, g: GroupPayload) {
  const codes = [g.code, ...(g.originalCode && g.originalCode !== g.code ? [g.originalCode] : [])];
  const { data: found, error: fErr } = await supabase
    .from("account_groups")
    .select("id,code")
    .eq("company_id", companyId)
    .in("code", codes);
  if (fErr) fail(fErr.message);

  const existing = found?.find((r) => r.code === g.code) ?? found?.[0];
  const values = {
    name: g.name,
    type: g.type,
    dre_section: g.dre_section as Database["public"]["Enums"]["dre_section"],
    sort_order: g.sort_order,
    code: g.code,
  };

  if (existing) {
    const { error } = await supabase.from("account_groups").update(values).eq("id", existing.id);
    if (error) fail(error.message);
    return existing.id;
  }

  const { data: ins, error } = await supabase
    .from("account_groups")
    .insert({ company_id: companyId, active: true, ...values })
    .select("id")
    .single();
  if (error || !ins) fail(error?.message ?? "Não foi possível criar o grupo.");
  return ins.id;
}

async function ensureSubgroup(supabase: Client, companyId: string, sg: SubgroupPayload) {
  const groupId = await ensureGroup(supabase, companyId, sg.group);
  const codes = [
    sg.code,
    ...(sg.originalCode && sg.originalCode !== sg.code ? [sg.originalCode] : []),
  ];
  const { data: found, error: fErr } = await supabase
    .from("account_subgroups")
    .select("id,code")
    .eq("company_id", companyId)
    .in("code", codes);
  if (fErr) fail(fErr.message);

  const existing = found?.find((r) => r.code === sg.code) ?? found?.[0];
  const values = { name: sg.name, sort_order: sg.sort_order, code: sg.code, group_id: groupId };

  if (existing) {
    const { error } = await supabase.from("account_subgroups").update(values).eq("id", existing.id);
    if (error) fail(error.message);
    return existing.id;
  }

  const { data: ins, error } = await supabase
    .from("account_subgroups")
    .insert({ company_id: companyId, active: true, ...values })
    .select("id")
    .single();
  if (error || !ins) fail(error?.message ?? "Não foi possível criar o subgrupo.");
  return ins.id;
}

export async function replicateGroup(
  supabase: Client,
  payload: GroupPayload,
  companyId?: string | null,
) {
  const ids = await activeCompanyIds(supabase, companyId);
  for (const companyId of ids) await ensureGroup(supabase, companyId, payload);
  return { companies: ids.length };
}

export async function replicateSubgroup(
  supabase: Client,
  payload: SubgroupPayload,
  companyId?: string | null,
) {
  const ids = await activeCompanyIds(supabase, companyId);
  for (const companyId of ids) await ensureSubgroup(supabase, companyId, payload);
  return { companies: ids.length };
}

export async function replicateAccount(
  supabase: Client,
  payload: AccountPayload,
  companyId?: string | null,
) {
  const ids = await activeCompanyIds(supabase, companyId);
  for (const companyId of ids) {
    const subgroupId = await ensureSubgroup(supabase, companyId, payload.subgroup);
    const codes = [
      payload.code,
      ...(payload.originalCode && payload.originalCode !== payload.code
        ? [payload.originalCode]
        : []),
    ];
    const { data: found, error: fErr } = await supabase
      .from("accounts")
      .select("id,code")
      .eq("company_id", companyId)
      .in("code", codes);
    if (fErr) fail(fErr.message);

    const existing = found?.find((r) => r.code === payload.code) ?? found?.[0];
    const values = {
      code: payload.code,
      name: payload.name,
      type: payload.type,
      sort_order: payload.sort_order,
      active: payload.active,
      subgroup_id: subgroupId,
    };

    if (existing) {
      const { error } = await supabase.from("accounts").update(values).eq("id", existing.id);
      if (error) fail(error.message);
    } else {
      const { error } = await supabase
        .from("accounts")
        .insert({ company_id: companyId, ...values });
      if (error) fail(error.message);
    }
  }
  return { companies: ids.length };
}

export async function replicateAccountActive(
  supabase: Client,
  code: string,
  active: boolean,
  companyId?: string | null,
) {
  const ids = await activeCompanyIds(supabase, companyId);
  const { error } = await supabase
    .from("accounts")
    .update({ active })
    .eq("code", code)
    .in("company_id", ids);
  if (error) fail(error.message);
  return { companies: ids.length };
}

export async function deleteAccountByCode(
  supabase: Client,
  code: string,
  companyId?: string | null,
) {
  const ids = await activeCompanyIds(supabase, companyId);
  const { data: rows, error: aErr } = await supabase
    .from("accounts")
    .select("id")
    .eq("code", code)
    .in("company_id", ids);
  if (aErr) fail(aErr.message);
  const accountIds = (rows ?? []).map((r) => r.id);
  if (accountIds.length === 0) return { deleted: 0, companies: 0, blocked: false as const };

  const { count: txCount, error: tErr } = await supabase
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .in("account_id", accountIds);
  if (tErr) fail(tErr.message);

  const { count: simCount, error: sErr } = await supabase
    .from("simulation_lines")
    .select("id", { count: "exact", head: true })
    .in("account_id", accountIds);
  if (sErr) fail(sErr.message);

  if ((txCount ?? 0) > 0 || (simCount ?? 0) > 0) {
    return {
      blocked: true as const,
      transactions: txCount ?? 0,
      simulationLines: simCount ?? 0,
      deleted: 0,
      companies: 0,
    };
  }

  const { error: mErr } = await supabase
    .from("account_mappings")
    .update({ account_id: null })
    .in("account_id", accountIds);
  if (mErr) fail(mErr.message);

  const { error: dErr } = await supabase.from("accounts").delete().in("id", accountIds);
  if (dErr) fail(dErr.message);

  return {
    blocked: false as const,
    deleted: accountIds.length,
    companies: accountIds.length,
    transactions: 0,
    simulationLines: 0,
  };
}
