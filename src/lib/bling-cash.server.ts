import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { blingFetch } from "./bling.server";
import { cashDate, cashKind } from "./cashflow-rules";

const COMPANY = "0c3d7a6e-24bc-4ea1-9009-2112a2f31f6a";
const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

export async function beginCashSync(year: number, userId: string) {
  const { data, error } = await supabaseAdmin.from("cashflow_syncs").insert({ company_id: COMPANY, year, created_by: userId }).select("id").single();
  if (error) throw error;
  return data;
}

export async function cashSyncPage(syncId: string, page: number) {
  const { data: sync, error } = await supabaseAdmin.from("cashflow_syncs").select("*").eq("id", syncId).eq("company_id", COMPANY).eq("status", "running").single();
  if (sync && sync.phase !== "cash") return forecastPage(syncId, page, sync);
  if (error || !sync || sync.next_page !== page) throw new Error("Sincronização inválida ou página fora de ordem.");
  const result = await blingFetch("/caixas", { pagina: String(page), limite: "100", dataInicial: `${sync.year}-01-01`, dataFinal: `${sync.year}-12-31` });
  const list: Array<{ id: string; descricao?: string }> = result?.data ?? [];
  const { data: mappings } = await supabaseAdmin.from("account_mappings").select("source_code,account_id,accounts(code,type)").eq("company_id", COMPANY);
  const { data: accounts } = await supabaseAdmin.from("accounts").select("id,code,type").eq("company_id", COMPANY).eq("active", true);
  const map = new Map((mappings ?? []).map(m => [normalize(m.source_code), m.account_id]));
  const byId = new Map((accounts ?? []).map(a => [a.id, a]));
  const rows = [];
  for (let offset = 0; offset < list.length; offset += 3) {
    await new Promise(r => setTimeout(r, 1100));
    const batch = await Promise.all(list.slice(offset, offset + 3).map(async (item) => {
    const { data: d } = await blingFetch(`/caixas/${item.id}`);
    if (!d || (!["C", "D"].includes(d.debCred) && d.saldo !== "S")) throw new Error(`Movimento ${item.id} sem sentido confirmado.`);
    if (d.situacao !== "R") return null;
    const category = d.categoria?.descricao ?? item.descricao ?? "Sem categoria";
    const type = d.debCred === "C" || d.saldo === "S" ? "entrada" : "saida";
    const accountId = map.get(normalize(category));
    const matched = accountId ? byId.get(accountId) : undefined;
    const account = matched?.type === type ? matched : (accounts ?? []).find(a => a.code === (type === "entrada" ? "1.1.999" : "5.2.999"));
    const kind = cashKind(d.saldo ?? "", d.transferencia ?? "", category, account?.code);
    const amount = Math.abs(Number(d.valor));
    const date = cashDate(d.data);
    if (!Number.isFinite(amount) || !date.startsWith(String(sync.year))) throw new Error(`Movimento ${item.id} inválido.`);
    return { company_id: COMPANY, external_id: String(item.id), account_id: account?.id ?? null, movement_date: date, amount, type, kind, category_id: d.categoria?.id == null ? null : String(d.categoria.id), category_name: category, description: d.observacoes || category, financial_account: d.contaFinanceira?.descricao ?? null, source_origin: d.origem?.tipo ?? null, sync_id: syncId };
    }));
    rows.push(...batch.filter((r): r is NonNullable<typeof r> => r !== null));
  }
  if (rows.length) {
    const { error: writeError } = await supabaseAdmin.from("cashflow_movements").upsert(rows, { onConflict: "sync_id,external_id" });
    if (writeError) throw writeError;
  }
  const cashDone = list.length < 100;
  const { error: progressError } = await supabaseAdmin.from("cashflow_syncs").update({ next_page: cashDone ? 1 : page + 1, phase: cashDone ? "receber" : "cash" }).eq("id", syncId).eq("next_page", page);
  if (progressError) throw progressError;
  return { count: list.length, saved: rows.length, done: false, nextPage: cashDone ? 1 : page + 1 };
}

async function forecastPage(syncId: string, page: number, sync: { year: number; phase: string; next_page: number; forecasts: unknown }) {
  if (sync.next_page !== page || !["receber", "pagar"].includes(sync.phase)) throw new Error("Página fora de ordem.");
  const { data: accounts, error: accError } = await supabaseAdmin.from("accounts").select("id,code,type").eq("company_id", COMPANY).eq("active", true);
  const { data: mappings, error: mapError } = await supabaseAdmin.from("account_mappings").select("source_code,account_id").eq("company_id", COMPANY);
  if (accError || mapError) throw accError ?? mapError;
  const map = new Map((mappings ?? []).map(m => [normalize(m.source_code), m.account_id]));
  const categoryNames = new Map<string, string>();
  for (let p = 1; p <= 100; p++) {
    const json = await blingFetch("/categorias/receitas-despesas", { pagina: String(p), limite: "100" });
    for (const c of json?.data ?? []) categoryNames.set(String(c.id), c.descricao);
    if ((json?.data?.length ?? 0) < 100) break;
  }
  const prefix = sync.phase;
  const json = await blingFetch(`/contas/${prefix}`, { pagina: String(page), limite: "100", dataVencimentoInicial: `${sync.year}-01-01`, dataVencimentoFinal: `${sync.year}-12-31` });
  const forecasts = Array.isArray(sync.forecasts) ? sync.forecasts : [];
  for (const item of json?.data ?? []) {
    if (![1, 3, 7].includes(Number(item.situacao))) continue;
    await new Promise(r => setTimeout(r, 360));
    const { data: d } = await blingFetch(`/contas/${prefix}/${item.id}`);
    if (!d || d.saldo == null || !Number.isFinite(Number(d.saldo))) throw new Error(`Saldo em aberto ausente: ${item.id}`);
    const type = prefix === "receber" ? "entrada" : "saida";
    const category = d.categoria?.descricao ?? categoryNames.get(String(d.categoria?.id)) ?? "Sem categoria";
    const id = map.get(normalize(category));
    const account = accounts?.find(a => a.id === id && a.type === type) ?? accounts?.find(a => a.code === (type === "entrada" ? "1.1.999" : "5.2.999"));
    if (Number(d.saldo) > 0) forecasts.push({ external_id: `${prefix}:${item.id}`, account_id: account?.id ?? null, date: cashDate(d.vencimento), amount: Number(d.saldo), type, kind: cashKind("N", "", category, account?.code) });
  }
  const phaseDone = (json?.data?.length ?? 0) < 100;
  const done = phaseDone && prefix === "pagar";
  const phase = phaseDone ? (done ? "complete" : "pagar") : prefix;
  const nextPage = phaseDone ? 1 : page + 1;
  const { count, error: countError } = await supabaseAdmin.from("cashflow_movements").select("id", { count: "exact", head: true }).eq("sync_id", syncId);
  if (countError) throw countError;
  const { error: updateError } = await supabaseAdmin.from("cashflow_syncs").update({ forecasts, next_page: nextPage, phase, ...(done ? { status: "complete", completed_at: new Date().toISOString(), movement_count: count ?? 0 } : {}) }).eq("id", syncId).eq("status", "running").eq("phase", prefix).eq("next_page", page);
  if (updateError) throw updateError;
  return { count: json?.data?.length ?? 0, saved: 0, done, nextPage };
}
