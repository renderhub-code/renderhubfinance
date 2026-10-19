import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { RefreshCw, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DeParaContas } from "./DeParaContas";
import { useCompanyStore } from "@/lib/company-store";
import { useUserRoles } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { beginBlingCashSync, syncBlingCashPage } from "@/lib/bling.functions";

export function CashflowControls({ year, opening }: { year: number; opening: number | null }) {
  const companyId = useCompanyStore(s => s.activeCompanyId);
  const { data: roles } = useUserRoles();
  const canEdit = roles?.some(r => ["controller", "financial_manager"].includes(r.role));
  const queryClient = useQueryClient();
  const begin = useServerFn(beginBlingCashSync);
  const pageFn = useServerFn(syncBlingCashPage);
  const [progress, setProgress] = useState("");
  const [settings, setSettings] = useState(false);
  const [mapping, setMapping] = useState(false);
  const [value, setValue] = useState("");
  const sync = useMutation({
    mutationFn: async () => {
      const { data: running, error } = await supabase.from("cashflow_syncs").select("id,next_page,phase").eq("company_id", companyId ?? "").eq("year", year).eq("status", "running").order("started_at", { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      const id = running?.id ?? (await begin({ data: { year } })).id;
      let page = running?.next_page ?? 1;
      for (let i = 0; i < 3000; i++) {
        setProgress(`Sincronizando — lote ${i + 1}`);
        const result = await pageFn({ data: { syncId: id, page } });
        if (result.done) return;
        page = result.nextPage;
      }
      throw new Error("Sincronização incompleta. Retome para continuar.");
    },
    onSuccess: () => { toast.success("Caixa sincronizado com o Bling."); queryClient.invalidateQueries({ queryKey: ["cashflow_snapshot"] }); },
    onError: (e: Error) => toast.error(`${e.message} Os últimos dados completos foram preservados.`),
  });
  const save = useMutation({
    mutationFn: async () => {
      const amount = Number(value.replace(",", "."));
      if (!companyId || !value.trim() || !Number.isFinite(amount)) throw new Error("Informe um saldo válido.");
      const { error } = await supabase.from("cashflow_opening_balances").upsert({ company_id: companyId, year, amount, updated_at: new Date().toISOString() });
      if (error) throw error;
    },
    onSuccess: () => { setSettings(false); queryClient.invalidateQueries({ queryKey: ["cashflow_snapshot"] }); toast.success("Saldo inicial salvo."); },
    onError: (e: Error) => toast.error(e.message),
  });
  return <>
    {companyId && <Button variant="outline" size="sm" onClick={() => setMapping(true)}>De/Para Bling</Button>}
    {companyId && canEdit && <Button variant="outline" size="sm" onClick={() => { setValue(opening == null ? "" : String(opening)); setSettings(true); }}><Settings2 className="size-4 mr-2" />Saldo inicial</Button>}
    {companyId === "0c3d7a6e-24bc-4ea1-9009-2112a2f31f6a" && canEdit && <Button size="sm" disabled={sync.isPending} onClick={() => sync.mutate()}><RefreshCw className={sync.isPending ? "size-4 mr-2 animate-spin" : "size-4 mr-2"} />{sync.isPending ? progress : "Sincronizar caixa"}</Button>}
    <Dialog open={settings} onOpenChange={setSettings}><DialogContent><DialogHeader><DialogTitle>Saldo inicial — 01/01/{year}</DialogTitle></DialogHeader><label htmlFor="cash-opening">Saldo em reais</label><Input id="cash-opening" inputMode="decimal" value={value} onChange={e => setValue(e.target.value)} /><Button onClick={() => save.mutate()} disabled={save.isPending}>Salvar saldo</Button></DialogContent></Dialog>
    <Dialog open={mapping} onOpenChange={setMapping}><DialogContent className="max-h-[85vh] overflow-auto sm:max-w-5xl"><DialogHeader><DialogTitle>Categoria do Bling → Plano de contas</DialogTitle></DialogHeader><DeParaContas companyId={companyId} /></DialogContent></Dialog>
  </>;
}