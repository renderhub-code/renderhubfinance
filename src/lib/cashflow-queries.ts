import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CashKind } from "./cashflow-rules";

export interface CashEntry { account_id: string | null; date: string; amount: number; type: "entrada" | "saida"; kind: CashKind; description?: string; category_name?: string; }

export function useCashSnapshot(companyId: string | null, year: number) {
  return useQuery({
    queryKey: ["cashflow_snapshot", companyId, year],
    queryFn: async () => {
      let q = supabase.from("cashflow_syncs").select("*").eq("year", year).eq("status", "complete").order("completed_at", { ascending: false });
      if (companyId) q = q.eq("company_id", companyId);
      const { data: syncs, error } = await q;
      if (error) throw error;
      const latest = [...new Map((syncs ?? []).slice().reverse().map(s => [s.company_id, s])).values()];
      const movements: CashEntry[] = [];
      for (const sync of latest) {
        for (let offset = 0; ; offset += 1000) {
          const { data, error } = await supabase.from("cashflow_movements").select("*").eq("sync_id", sync.id).order("id").range(offset, offset + 999);
          if (error) throw error;
          movements.push(...(data ?? []).map(m => ({ ...m, amount: Number(m.amount), date: m.movement_date, type: m.type as CashEntry["type"], kind: m.kind as CashKind, description: m.description ?? undefined, category_name: m.category_name ?? undefined })));
          if ((data?.length ?? 0) < 1000) break;
        }
      }
      let openingQuery = supabase.from("cashflow_opening_balances").select("*").eq("year", year);
      if (companyId) openingQuery = openingQuery.eq("company_id", companyId);
      const { data: openings, error: openingError } = await openingQuery;
      if (openingError) throw openingError;
      return { movements, forecasts: latest.flatMap(s => (s.forecasts ?? []) as unknown as CashEntry[]), syncedAt: latest[0]?.completed_at, hasSnapshot: latest.length > 0, opening: openings?.length ? openings.reduce((sum, o) => sum + Number(o.amount), 0) : null };
    },
  });
}