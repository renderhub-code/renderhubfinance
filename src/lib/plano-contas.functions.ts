import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { AccountPayload, GroupPayload, SubgroupPayload } from "@/lib/plano-contas.server";

export const upsertGroupAllCompanies = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: GroupPayload) => input)
  .handler(async ({ data, context }) => {
    const { replicateGroup } = await import("@/lib/plano-contas.server");
    return replicateGroup(context.supabase, data);
  });

export const upsertSubgroupAllCompanies = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: SubgroupPayload) => input)
  .handler(async ({ data, context }) => {
    const { replicateSubgroup } = await import("@/lib/plano-contas.server");
    return replicateSubgroup(context.supabase, data);
  });

export const upsertAccountAllCompanies = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: AccountPayload) => input)
  .handler(async ({ data, context }) => {
    const { replicateAccount } = await import("@/lib/plano-contas.server");
    return replicateAccount(context.supabase, data);
  });

export const setAccountActiveAllCompanies = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string; active: boolean }) => input)
  .handler(async ({ data, context }) => {
    const { replicateAccountActive } = await import("@/lib/plano-contas.server");
    return replicateAccountActive(context.supabase, data.code, data.active);
  });
