import { Fragment, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Plus, Minus, Play, Undo2, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAccounts, useAccountGroups, useAccountSubgroups } from "@/lib/queries";
import { applyAccountSimulation, revertSimulation } from "@/lib/simulations.functions";
import { lineTotal } from "@/lib/account-simulation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TableSkeleton } from "@/components/skeletons";
import { cn } from "@/lib/utils";

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const YEAR = new Date().getFullYear();
const fmt = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const show = (v: number) => (v === 0 ? "–" : fmt.format(v));

type Cell = { qty: number; value: number };
type Grid = Record<string, Cell[]>; // accountId -> 12 meses
const emptyCells = (): Cell[] => Array.from({ length: 12 }, () => ({ qty: 0, value: 0 }));

export function SimulacaoContas({ companyId }: { companyId: string }) {
  const qc = useQueryClient();
  const { data: accounts } = useAccounts(companyId);
  const { data: groups } = useAccountGroups(companyId);
  const { data: subgroups } = useAccountSubgroups(companyId);
  const simName = `Simulação ${YEAR}`;

  const simQuery = useQuery({
    queryKey: ["sim_contas", companyId, YEAR],
    queryFn: async () => {
      const { data, error } = await supabase.from("simulations").select("*")
        .eq("company_id", companyId).eq("year", YEAR).eq("name", simName).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const sim = simQuery.data;

  const linesQuery = useQuery({
    queryKey: ["sim_contas_lines", sim?.id],
    enabled: !!sim?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("simulation_lines")
        .select("account_id,month,qty_expected,unit_price").eq("simulation_id", sim!.id);
      if (error) throw error;
      return data;
    },
  });

  const [grid, setGrid] = useState<Grid>({});
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!linesQuery.data) return;
    const g: Grid = {};
    for (const l of linesQuery.data) {
      const cells = (g[l.account_id] ??= emptyCells());
      const i = Number(l.month) - 1;
      if (i >= 0 && i < 12) cells[i] = { qty: Number(l.qty_expected ?? 0), value: Number(l.unit_price ?? 0) };
    }
    setGrid(g);
  }, [linesQuery.data]);

  const tree = useMemo(() => {
    const gById = new Map((groups ?? []).map((g) => [g.id, g]));
    const gBySub = new Map((subgroups ?? []).map((s) => [s.id, s.group_id]));
    const map = new Map<string, { id: string; code: string; name: string; accounts: { id: string; code: string; name: string }[] }>();
    const sorted = (accounts ?? []).filter((a) => a.active)
      .sort((a, b) => a.code.localeCompare(b.code, "pt-BR", { numeric: true }));
    for (const a of sorted) {
      const g = gById.get(gBySub.get(a.subgroup_id) ?? "");
      if (!g) continue;
      let row = map.get(g.id);
      if (!row) { row = { id: g.id, code: g.code, name: g.name, accounts: [] }; map.set(g.id, row); }
      row.accounts.push({ id: a.id, code: a.code, name: a.name });
    }
    return [...map.values()].sort((a, b) => a.code.localeCompare(b.code, "pt-BR", { numeric: true }));
  }, [accounts, groups, subgroups]);

  const totalOf = (accId: string, m: number) => {
    const c = grid[accId]?.[m];
    return c ? lineTotal(c.qty, c.value) : 0;
  };

  function setCell(accId: string, m: number, field: keyof Cell, v: number) {
    setGrid((prev) => {
      const cells = [...(prev[accId] ?? emptyCells())];
      cells[m] = { ...cells[m], [field]: v };
      return { ...prev, [accId]: cells };
    });
  }

  const createSim = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("simulations").insert({
        company_id: companyId, name: simName, kind: "despesa", year: YEAR, status: "rascunho",
        created_by: u.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sim_contas", companyId, YEAR] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!sim) return;
      const { error: dErr } = await supabase.from("simulation_lines").delete().eq("simulation_id", sim.id);
      if (dErr) throw dErr;
      const payload = Object.entries(grid).flatMap(([accId, cells]) =>
        cells.flatMap((c, i) => (c.qty === 0 && c.value === 0 ? [] : [{
          simulation_id: sim.id, account_id: accId, month: i + 1, group_key: accId,
          qty_expected: c.qty, unit_price: c.value, amount: lineTotal(c.qty, c.value),
        }])),
      );
      for (let i = 0; i < payload.length; i += 500) {
        const { error } = await supabase.from("simulation_lines").insert(payload.slice(i, i + 500));
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sim_contas_lines", sim?.id] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const applyFn = useServerFn(applyAccountSimulation);
  const revertFn = useServerFn(revertSimulation);
  const apply = useMutation({
    mutationFn: async () => { await save.mutateAsync(); return applyFn({ data: { simulationId: sim!.id } }); },
    onSuccess: (r) => {
      toast.success(`Aplicado ao Fluxo de Caixa (${r.inserted} lançamentos previstos)`);
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["sim_contas", companyId, YEAR] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const revert = useMutation({
    mutationFn: async () => revertFn({ data: { simulationId: sim!.id } }),
    onSuccess: () => {
      toast.success("Aplicação revertida");
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["sim_contas", companyId, YEAR] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (simQuery.isLoading || !accounts) return <TableSkeleton />;
  if (!sim) {
    return (
      <Card><CardContent className="py-10 text-center space-y-3">
        <p className="text-sm text-muted-foreground">Nenhuma simulação para {YEAR}.</p>
        <Button onClick={() => createSim.mutate()} disabled={createSim.isPending}>Criar simulação {YEAR}</Button>
      </CardContent></Card>
    );
  }

  const toggle = (id: string) => setCollapsed((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const busy = save.isPending || apply.isPending || revert.isPending;
  const inputCls = "h-7 w-16 rounded border border-input bg-background px-1 text-right text-xs focus:outline-none focus:ring-1 focus:ring-ring";
  const stickyL = "sticky left-0 z-10 min-w-[240px] max-w-[240px]";

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="text-base flex items-center gap-2">
          {simName}
          <Badge variant={sim.status === "aplicada" ? "default" : "secondary"}>{sim.status === "aplicada" ? "Aplicada" : "Rascunho"}</Badge>
        </CardTitle>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={busy} onClick={() => save.mutate(undefined, { onSuccess: () => toast.success("Simulação salva") })}>
            {save.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}Salvar
          </Button>
          <Button size="sm" disabled={busy} onClick={() => apply.mutate()}>
            {apply.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Play className="h-4 w-4 mr-1" />}Aplicar ao Fluxo de Caixa
          </Button>
          <Button size="sm" variant="ghost" disabled={busy || sim.status !== "aplicada"} onClick={() => revert.mutate()}>
            <Undo2 className="h-4 w-4 mr-1" />Reverter
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="max-h-[70vh] overflow-auto rounded border">
          <table className="w-max border-separate border-spacing-0 text-xs">
            <thead>
              <tr>
                <th rowSpan={2} className={cn(stickyL, "top-0 z-30 bg-card border-b p-2 text-left")}>Conta</th>
                {MONTHS.map((m) => (
                  <th key={m} colSpan={3} className="sticky top-0 z-20 bg-card border-b border-l p-1 text-center font-semibold">{m}</th>
                ))}
                <th rowSpan={2} className="sticky top-0 z-20 bg-card border-b border-l p-2 text-right">Total ano</th>
              </tr>
              <tr>
                {MONTHS.map((m) => (
                  <Fragment key={m}>
                    <th className="sticky top-[29px] z-20 bg-card border-b border-l p-1 font-normal text-muted-foreground">Qtd</th>
                    <th className="sticky top-[29px] z-20 bg-card border-b p-1 font-normal text-muted-foreground">Valor</th>
                    <th className="sticky top-[29px] z-20 bg-card border-b p-1 font-normal text-muted-foreground">Total</th>
                  </Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {tree.map((g) => {
                const gTot = MONTHS.map((_, m) => g.accounts.reduce((s, a) => s + totalOf(a.id, m), 0));
                const open = !collapsed.has(g.id);
                return (
                  <Fragment key={g.id}>
                    <tr className="bg-row-group font-semibold">
                      <td className={cn(stickyL, "bg-row-group border-b p-2")}>
                        <button className="flex items-center gap-1" onClick={() => toggle(g.id)}>
                          {open ? <Minus className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                          {g.code} — {g.name}
                        </button>
                      </td>
                      {gTot.map((t, m) => (
                        <td key={m} colSpan={3} className="border-b border-l p-1 text-right">{show(t)}</td>
                      ))}
                      <td className="border-b border-l p-2 text-right">{show(gTot.reduce((a, b) => a + b, 0))}</td>
                    </tr>
                    {open && g.accounts.map((a) => {
                      const cells = grid[a.id] ?? emptyCells();
                      const year = cells.reduce((s, c) => s + lineTotal(c.qty, c.value), 0);
                      return (
                        <tr key={a.id} className="hover:bg-muted/40">
                          <td className={cn(stickyL, "bg-card border-b p-2 pl-6 truncate")} title={a.code}>{a.code} {a.name}</td>
                          {cells.map((c, m) => (
                            <Fragment key={m}>
                              <td className="border-b border-l p-0.5">
                                <input type="number" className={inputCls} value={c.qty || ""} onChange={(e) => setCell(a.id, m, "qty", Number(e.target.value) || 0)} />
                              </td>
                              <td className="border-b p-0.5">
                                <input type="number" className={cn(inputCls, "w-20")} value={c.value || ""} onChange={(e) => setCell(a.id, m, "value", Number(e.target.value) || 0)} />
                              </td>
                              <td className="border-b p-1 text-right tabular-nums min-w-[64px]">{show(lineTotal(c.qty, c.value))}</td>
                            </Fragment>
                          ))}
                          <td className="border-b border-l p-2 text-right font-medium tabular-nums">{show(year)}</td>
                        </tr>
                      );
                    })}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
