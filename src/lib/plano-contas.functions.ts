import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { AccountPayload, GroupPayload, SubgroupPayload } from "@/lib/plano-contas.server";

/** Empresa em edição: define para quais empresas a alteração é replicada. */
type Scope = { companyId?: string | null };

export const upsertGroupAllCompanies = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: GroupPayload & Scope) => input)
  .handler(async ({ data, context }) => {
    const { replicateGroup } = await import("@/lib/plano-contas.server");
    return replicateGroup(context.supabase, data, data.companyId);
  });

export const upsertSubgroupAllCompanies = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: SubgroupPayload & Scope) => input)
  .handler(async ({ data, context }) => {
    const { replicateSubgroup } = await import("@/lib/plano-contas.server");
    return replicateSubgroup(context.supabase, data, data.companyId);
  });

export const upsertAccountAllCompanies = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: AccountPayload & Scope) => input)
  .handler(async ({ data, context }) => {
    const { replicateAccount } = await import("@/lib/plano-contas.server");
    return replicateAccount(context.supabase, data, data.companyId);
  });

export const setAccountActiveAllCompanies = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string; active: boolean } & Scope) => input)
  .handler(async ({ data, context }) => {
    const { replicateAccountActive } = await import("@/lib/plano-contas.server");
    return replicateAccountActive(context.supabase, data.code, data.active, data.companyId);
  });

export const deleteAccountAllCompanies = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string } & Scope) => input)
  .handler(async ({ data, context }) => {
    const { deleteAccountByCode } = await import("@/lib/plano-contas.server");
    return deleteAccountByCode(context.supabase, data.code, data.companyId);
  });
