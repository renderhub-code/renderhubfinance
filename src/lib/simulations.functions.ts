import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const applySimulation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { simulationId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: sim, error: sErr } = await supabase
      .from("simulations")
      .select("*")
      .eq("id", data.simulationId)
      .single();
    if (sErr || !sim) throw new Error(sErr?.message ?? "Simulação não encontrada");

    const { data: lines, error: lErr } = await supabase
      .from("simulation_lines")
      .select("*")
      .eq("simulation_id", sim.id);
    if (lErr) throw new Error(lErr.message);
    const active = (lines ?? []).filter((l) => Number(l.qty_expected ?? 0) > 0);
    if (active.length === 0) throw new Error("Nenhuma quantidade prevista informada");

    // conta de custo padrão da empresa
    const { data: costAccounts, error: cErr } = await supabase
      .from("accounts")
      .select("id")
      .eq("company_id", sim.company_id)
      .eq("type", "saida")
      .eq("active", true)
      .order("code")
      .limit(1);
    if (cErr) throw new Error(cErr.message);
    const costAccountId = costAccounts?.[0]?.id ?? null;

    // idempotente: remove aplicações anteriores desta simulação
    const { error: dErr } = await supabase
      .from("transactions")
      .delete()
      .eq("source_simulation_id", sim.id)
      .eq("status", "previsto");
    if (dErr) throw new Error(dErr.message);

    type TxInsert = {
      company_id: string;
      business_unit_id: string | null;
      account_id: string;
      entry_date: string;
      due_date: string;
      type: "entrada" | "saida";
      status: "previsto";
      amount_expected: number;
      amount_realized: number;
      description: string;
      source_simulation_id: string;
    };
    const rows: TxInsert[] = [];

    for (const l of active) {
      const qty = Number(l.qty_expected ?? 0);
      const unit = Number(l.unit_price ?? 0);
      const revenue = qty * unit;
      if (revenue === 0) continue;
      const margin = Number(l.margin_pct ?? 0);
      const cost = revenue * (1 - margin / 100);
      const entryDate = `${sim.year}-${String(l.month).padStart(2, "0")}-01`;
      const label = l.client_name ? `${l.client_name} — ${sim.name}` : `Simulação: ${sim.name}`;

      rows.push({
        company_id: sim.company_id,
        business_unit_id: l.business_unit_id,
        account_id: l.account_id,
        entry_date: entryDate,
        due_date: entryDate,
        type: "entrada" as const,
        status: "previsto" as const,
        amount_expected: revenue,
        amount_realized: 0,
        description: `Receita prevista — ${label}`,
        source_simulation_id: sim.id,
      });

      if (costAccountId && cost > 0) {
        rows.push({
          company_id: sim.company_id,
          business_unit_id: l.business_unit_id,
          account_id: costAccountId,
          entry_date: entryDate,
          due_date: entryDate,
          type: "saida" as const,
          status: "previsto" as const,
          amount_expected: cost,
          amount_realized: 0,
          description: `Custo previsto — ${label}`,
          source_simulation_id: sim.id,
        });
      }
    }

    if (rows.length > 0) {
      const { error: iErr } = await supabase.from("transactions").insert(rows);
      if (iErr) throw new Error(iErr.message);
    }

    const { error: uErr } = await supabase
      .from("simulations")
      .update({ status: "aplicada", applied_at: new Date().toISOString() })
      .eq("id", sim.id);
    if (uErr) throw new Error(uErr.message);

    return { ok: true, inserted: rows.length };
  });

export const revertSimulation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { simulationId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error: dErr } = await supabase
      .from("transactions")
      .delete()
      .eq("source_simulation_id", data.simulationId)
      .eq("status", "previsto");
    if (dErr) throw new Error(dErr.message);
    const { error: uErr } = await supabase
      .from("simulations")
      .update({ status: "rascunho", applied_at: null })
      .eq("id", data.simulationId);
    if (uErr) throw new Error(uErr.message);
    return { ok: true };
  });
