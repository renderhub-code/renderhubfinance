import { Fragment, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Plus, Minus, Trash2, Play, Undo2, Save, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAccounts, useTransactions } from "@/lib/queries";
import { useFinancialStore } from "@/lib/financial-store";
import { applySimulation, revertSimulation } from "@/lib/simulations.functions";
import { formatBRL } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TableSkeleton } from "@/components/skeletons";
import { cn } from "@/lib/utils";

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const MAX_ROWS_PER_ACCOUNT = 100;

interface RowState {
  groupKey: string;
  clientName: string;
  accountId: string;
  unitPrice: number;
  marginPct: number;
  qtyExpected: number[];
  qtyRealized: number[];
  ids: (string | null)[];
}

function emptyRow(accountId: string): RowState {
  return {
    groupKey: crypto.randomUUID(),
    clientName: "",
    accountId,
    unitPrice: 0,
    marginPct: 0,
    qtyExpected: Array(12).fill(0),
    qtyRealized: Array(12).fill(0),
    ids: Array(12).fill(null),
  };
}

export function SimulacaoComercial({ companyId }: { companyId: string }) {
  const qc = useQueryClient();
  const year = useFinancialStore((s) => s.year);
  const { data: accounts } = useAccounts(companyId);
  const { data: realizedTransactions, isLoading: realizedLoading } = useTransactions(companyId, {
    from: `${year}-01-01`,
    to: `${year}-12-31`,
    status: "realizado",
  });
  const revenueAccounts = useMemo(
    () => (accounts ?? []).filter((a) => a.type === "entrada" && a.active),
    [accounts],
  );

  const simName = `Simulação comercial ${year}`;

  const simQuery = useQuery({
    queryKey: ["sim_comercial", companyId, year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("simulations")
        .select("*")
        .eq("company_id", companyId)
        .eq("year", year)
        .eq("name", simName)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const sim = simQuery.data;

  const linesQuery = useQuery({
    queryKey: ["sim_comercial_lines", sim?.id],
    enabled: !!sim?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("simulation_lines")
        .select("*")
        .eq("simulation_id", sim!.id)
        .order("month");
      if (error) throw error;
      return data;
    },
  });

  const [rows, setRows] = useState<RowState[]>([]);
  const [view, setView] = useState<"previsto" | "realizado">("previsto");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const data = linesQuery.data;
    if (!data) return;
    const map = new Map<string, RowState>();
    for (const l of data) {
      const key = l.group_key as string;
      let r = map.get(key);
      if (!r) {
        r = {
          groupKey: key,
          clientName: l.client_name ?? "",
          accountId: l.account_id,
          unitPrice: Number(l.unit_price ?? 0),
          marginPct: Number(l.margin_pct ?? 0),
          qtyExpected: Array(12).fill(0),
          qtyRealized: Array(12).fill(0),
          ids: Array(12).fill(null),
        };
        map.set(key, r);
      }
      const idx = Number(l.month) - 1;
      if (idx >= 0 && idx < 12) {
        r.qtyExpected[idx] = Number(l.qty_expected ?? 0);
        r.qtyRealized[idx] = Number(l.qty_realized ?? 0);
        r.ids[idx] = l.id;
      }
    }
    setRows(Array.from(map.values()));
  }, [linesQuery.data]);

  useEffect(() => {
    setSelectedAccountIds((prev) => {
      if (prev.size > 0) return prev;
      const all = new Set(revenueAccounts.map((a) => a.id));
      return all;
    });
  }, [revenueAccounts]);

  const createSim = useMutation({
    mutationFn: async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("simulations")
        .insert({
          company_id: companyId,
          name: simName,
          kind: "receita",
          year,
          status: "rascunho",
          created_by: userRes.user?.id ?? null,
        })
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sim_comercial", companyId, year] });
      qc.invalidateQueries({ queryKey: ["simulations"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!sim) return;
      const payload = rows.flatMap((r) =>
        Array.from({ length: 12 }, (_, i) => ({
          ...(r.ids[i] ? { id: r.ids[i]! } : {}),
          simulation_id: sim.id,
          account_id: r.accountId,
          month: i + 1,
          group_key: r.groupKey,
          client_name: r.clientName || null,
          unit_price: r.unitPrice,
          margin_pct: r.marginPct,
          qty_expected: r.qtyExpected[i],
          qty_realized: r.qtyRealized[i],
          amount: r.qtyExpected[i] * r.unitPrice,
        })),
      );
      const withId = payload.filter((p) => "id" in p);
      const withoutId = payload.filter((p) => !("id" in p));
      if (withId.length > 0) {
        const { error } = await supabase.from("simulation_lines").upsert(withId);
        if (error) throw error;
      }
      if (withoutId.length > 0) {
        const { error } = await supabase.from("simulation_lines").insert(withoutId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Simulação salva");
      qc.invalidateQueries({ queryKey: ["sim_comercial_lines", sim?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeRow = useMutation({
    mutationFn: async (row: RowState) => {
      const ids = row.ids.filter(Boolean) as string[];
      if (ids.length > 0) {
        const { error } = await supabase.from("simulation_lines").delete().in("id", ids);
        if (error) throw error;
      }
    },
    onSuccess: (_d, row) => {
      setRows((prev) => prev.filter((r) => r.groupKey !== row.groupKey));
      qc.invalidateQueries({ queryKey: ["sim_comercial_lines", sim?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const applyFn = useServerFn(applySimulation);
  const revertFn = useServerFn(revertSimulation);

  const apply = useMutation({
    mutationFn: async () => {
      await save.mutateAsync();
      return applyFn({ data: { simulationId: sim!.id } });
    },
    onSuccess: (res) => {
      toast.success(`Aplicado ao previsto (${res.inserted} lançamentos)`);
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["sim_comercial", companyId, year] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revert = useMutation({
    mutationFn: async () => revertFn({ data: { simulationId: sim!.id } }),
    onSuccess: () => {
      toast.success("Aplicação revertida");
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["sim_comercial", companyId, year] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function toggleAccount(accountId: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(accountId)) next.delete(accountId);
      else next.add(accountId);
      return next;
    });
  }

  function addRow(accountId: string) {
    if (!accountId) {
      toast.error("Nenhuma conta de receita disponível");
      return;
    }
    const count = rows.filter((r) => r.accountId === accountId).length;
    if (count >= MAX_ROWS_PER_ACCOUNT) {
      toast.error(`Limite de ${MAX_ROWS_PER_ACCOUNT} clientes por conta atingido`);
      return;
    }
    setCollapsed((prev) => {
      if (!prev.has(accountId)) return prev;
      const next = new Set(prev);
      next.delete(accountId);
      return next;
    });
    setRows((p) => [...p, emptyRow(accountId)]);
  }

  function patch(groupKey: string, patchFn: (r: RowState) => RowState) {
    setRows((prev) => prev.map((r) => (r.groupKey === groupKey ? patchFn(r) : r)));
  }

  function rowRevenue(r: RowState) {
    return r.qtyExpected.reduce((a, q) => a + q * r.unitPrice, 0);
  }

  const groups = useMemo(() => {
    const byAccount = new Map<string, RowState[]>();
    for (const r of rows) {
      const list = byAccount.get(r.accountId) ?? [];
      list.push(r);
      byAccount.set(r.accountId, list);
    }
    const entries: { accountId: string; code: string; name: string; groupRows: RowState[] }[] = [];
    for (const a of revenueAccounts) {
      entries.push({
        accountId: a.id,
        code: a.code,
        name: a.name,
        groupRows: byAccount.get(a.id) ?? [],
      });
    }
    entries.sort((a, b) => a.code.localeCompare(b.code));
    const known = new Set(revenueAccounts.map((a) => a.id));
    for (const [accountId, groupRows] of byAccount.entries()) {
      if (!known.has(accountId)) {
        entries.push({ accountId, code: "—", name: "Conta não encontrada", groupRows });
      }
    }
    return entries.map(({ accountId, code, name, groupRows }) => {
      const revenue = Array(12).fill(0) as number[];
      const cost = Array(12).fill(0) as number[];
      for (const r of groupRows) {
        for (let i = 0; i < 12; i++) {
          const rev = r.qtyExpected[i] * r.unitPrice;
          revenue[i] += rev;
          cost[i] += rev * (1 - r.marginPct / 100);
        }
      }
      return {
        accountId,
        code,
        name,
        rows: [...groupRows].sort((a, b) => a.clientName.localeCompare(b.clientName)),
        revenue,
        cost,
        totalRevenue: revenue.reduce((a, b) => a + b, 0),
        totalCost: cost.reduce((a, b) => a + b, 0),
      };
    });
  }, [rows, revenueAccounts]);

  const visibleGroups = useMemo(
    () => groups.filter((g) => selectedAccountIds.has(g.accountId)),
    [groups, selectedAccountIds],
  );

  const monthTotals = useMemo(() => {
    const revenue = Array(12).fill(0) as number[];
    const cost = Array(12).fill(0) as number[];
    for (const g of visibleGroups) {
      for (let i = 0; i < 12; i++) {
        revenue[i] += g.revenue[i];
        cost[i] += g.cost[i];
      }
    }
    return { revenue, cost };
  }, [visibleGroups]);

  const totalRevenue = monthTotals.revenue.reduce((a, b) => a + b, 0);
  const totalCost = monthTotals.cost.reduce((a, b) => a + b, 0);

  const realizedByAccount = useMemo(() => {
    const map = new Map<string, number[]>();
    for (const tx of realizedTransactions ?? []) {
      if (tx.type !== "entrada") continue;
      const month = Number(tx.entry_date.slice(5, 7)) - 1;
      if (month < 0 || month > 11) continue;
      const values = map.get(tx.account_id) ?? Array(12).fill(0);
      values[month] += Number(tx.amount_realized ?? 0);
      map.set(tx.account_id, values);
    }
    return revenueAccounts
      .map((account) => ({ account, values: map.get(account.id) ?? Array(12).fill(0) }))
      .filter((row) => row.values.some((value) => value !== 0));
  }, [realizedTransactions, revenueAccounts]);

  const realizedBase = (
    <Card>
      <CardHeader><CardTitle className="text-base">Base realizada — {year}</CardTitle></CardHeader>
      <CardContent className="overflow-x-auto">
        {realizedLoading ? <TableSkeleton rows={4} cols={8} /> : <Table>
          <TableHeader><TableRow><TableHead className="min-w-52">Conta de receita</TableHead>{MONTHS.map((month) => <TableHead key={month} className="text-right">{month}</TableHead>)}<TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
          <TableBody>{realizedByAccount.length === 0 ? <TableRow><TableCell colSpan={14} className="py-8 text-center text-muted-foreground">Nenhuma receita realizada no período.</TableCell></TableRow> : realizedByAccount.map(({ account, values }) => <TableRow key={account.id}><TableCell className="font-medium whitespace-nowrap">{account.code} — {account.name}</TableCell>{values.map((value, index) => <TableCell key={index} className="text-right text-xs whitespace-nowrap">{formatBRL(value)}</TableCell>)}<TableCell className="text-right font-medium whitespace-nowrap">{formatBRL(values.reduce((a, b) => a + b, 0))}</TableCell></TableRow>)}</TableBody>
        </Table>}
      </CardContent>
    </Card>
  );

  if (simQuery.isLoading) return <TableSkeleton rows={4} cols={6} />;

  if (!sim) {
    return (
      <>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Simulação comercial {year}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Nenhuma simulação comercial criada para {year}. Os valores realizados abaixo servem como base para o planejamento.
            </p>
            <Button onClick={() => createSim.mutate()} disabled={createSim.isPending}>
              {createSim.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Criar simulação comercial {year}
            </Button>
          </CardContent>
        </Card>
        {realizedBase}
      </>
    );
  }

  return (
    <div className="space-y-4">
      {realizedBase}
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={sim.status === "aplicada" ? "default" : "secondary"}>
          {sim.status === "aplicada" ? "Aplicada ao previsto" : "Rascunho"}
        </Badge>
        <div className="flex-1" />
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 justify-start">
              <span className="mr-1">Contas:</span>
              <span className="font-medium">
                {selectedAccountIds.size === revenueAccounts.length
                  ? "Todas"
                  : `${selectedAccountIds.size}/${revenueAccounts.length}`}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-0" align="end">
            <Command>
              <CommandInput placeholder="Buscar conta..." />
              <CommandList>
                <CommandEmpty>Nenhuma conta encontrada.</CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    onSelect={() => {
                      setSelectedAccountIds(
                        selectedAccountIds.size === revenueAccounts.length
                          ? new Set()
                          : new Set(revenueAccounts.map((a) => a.id)),
                      );
                    }}
                  >
                    <div
                      className={cn(
                        "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                        selectedAccountIds.size === revenueAccounts.length
                          ? "bg-primary text-primary-foreground"
                          : "text-transparent",
                      )}
                    >
                      <Check className="h-3 w-3" />
                    </div>
                    <span>Selecionar todas</span>
                  </CommandItem>
                  {revenueAccounts.map((a) => {
                    const selected = selectedAccountIds.has(a.id);
                    return (
                      <CommandItem
                        key={a.id}
                        onSelect={() => {
                          setSelectedAccountIds((prev) => {
                            const next = new Set(prev);
                            if (selected) next.delete(a.id);
                            else next.add(a.id);
                            return next;
                          });
                        }}
                      >
                        <div
                          className={cn(
                            "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                            selected ? "bg-primary text-primary-foreground" : "text-transparent",
                          )}
                        >
                          <Check className="h-3 w-3" />
                        </div>
                        <span>
                          {a.code} — {a.name}
                        </span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <Tabs value={view} onValueChange={(v) => setView(v as "previsto" | "realizado")}>
          <TabsList>
            <TabsTrigger value="previsto">Qtde Prevista</TabsTrigger>
            <TabsTrigger value="realizado">Qtde Realizada</TabsTrigger>
          </TabsList>
        </Tabs>
        <Button
          variant="outline"
          size="sm"
          onClick={() => addRow(revenueAccounts[0]?.id ?? "")}
          disabled={revenueAccounts.length === 0}
        >
          <Plus className="h-4 w-4 mr-1" /> Nova linha
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => save.mutate()}
          disabled={save.isPending || rows.length === 0}
        >
          {save.isPending ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-1" />
          )}{" "}
          Salvar
        </Button>
        <Button
          size="sm"
          onClick={() => apply.mutate()}
          disabled={apply.isPending || rows.length === 0}
        >
          {apply.isPending ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <Play className="h-4 w-4 mr-1" />
          )}{" "}
          Aplicar ao previsto
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => revert.mutate()}
          disabled={revert.isPending || sim.status !== "aplicada"}
        >
          {revert.isPending ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <Undo2 className="h-4 w-4 mr-1" />
          )}{" "}
          Reverter
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Linhas — {view === "previsto" ? "quantidades previstas" : "quantidades realizadas"} (
            {year})
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {linesQuery.isLoading ? (
            <TableSkeleton rows={4} cols={8} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-40">Cliente</TableHead>
                  <TableHead className="text-right min-w-28">Valor Unitário</TableHead>
                  <TableHead className="text-right min-w-24">Margem %</TableHead>
                  {MONTHS.map((m) => (
                    <TableHead key={m} className="text-right min-w-16">
                      {m}
                    </TableHead>
                  ))}
                  <TableHead className="text-right min-w-32">Receita prevista</TableHead>
                  <TableHead className="text-right min-w-32">Custo previsto</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {revenueAccounts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={18} className="text-center text-muted-foreground">
                      Nenhuma conta de receita cadastrada nesta empresa.
                    </TableCell>
                  </TableRow>
                ) : visibleGroups.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={18} className="text-center text-muted-foreground">
                      Nenhuma conta selecionada. Escolha ao menos uma conta no filtro acima.
                    </TableCell>
                  </TableRow>
                ) : (
                  visibleGroups.map((g) => (
                    <Fragment key={g.accountId}>
                      <TableRow key={`h-${g.accountId}`} className="bg-muted/60">
                        <TableCell colSpan={18}>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              aria-label={
                                collapsed.has(g.accountId)
                                  ? `Expandir ${g.code}`
                                  : `Recolher ${g.code}`
                              }
                              onClick={() => toggleAccount(g.accountId)}
                            >
                              {collapsed.has(g.accountId) ? (
                                <Plus className="h-3.5 w-3.5" />
                              ) : (
                                <Minus className="h-3.5 w-3.5" />
                              )}
                            </Button>
                            <span className="font-semibold">
                              {g.code} — {g.name}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {g.rows.length}/{MAX_ROWS_PER_ACCOUNT} clientes
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={g.rows.length >= MAX_ROWS_PER_ACCOUNT}
                              onClick={() => addRow(g.accountId)}
                            >
                              <Plus className="h-3.5 w-3.5 mr-1" /> Nova linha
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      {!collapsed.has(g.accountId) &&
                        g.rows.map((r) => {
                          const rev = rowRevenue(r);
                          const cost = rev * (1 - r.marginPct / 100);
                          const qty = view === "previsto" ? r.qtyExpected : r.qtyRealized;
                          return (
                            <TableRow key={r.groupKey}>
                              <TableCell>
                                <Input
                                  value={r.clientName}
                                  placeholder="Cliente"
                                  onChange={(e) =>
                                    patch(r.groupKey, (x) => ({ ...x, clientName: e.target.value }))
                                  }
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  step="0.01"
                                  className="text-right"
                                  value={r.unitPrice}
                                  onChange={(e) =>
                                    patch(r.groupKey, (x) => ({
                                      ...x,
                                      unitPrice: Number(e.target.value) || 0,
                                    }))
                                  }
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  step="0.1"
                                  className="text-right"
                                  value={r.marginPct}
                                  onChange={(e) =>
                                    patch(r.groupKey, (x) => ({
                                      ...x,
                                      marginPct: Number(e.target.value) || 0,
                                    }))
                                  }
                                />
                              </TableCell>
                              {MONTHS.map((m, i) => (
                                <TableCell key={m}>
                                  <Input
                                    type="number"
                                    className="text-right px-1"
                                    value={qty[i]}
                                    onChange={(e) => {
                                      const val = Number(e.target.value) || 0;
                                      patch(r.groupKey, (x) => {
                                        const next =
                                          view === "previsto"
                                            ? [...x.qtyExpected]
                                            : [...x.qtyRealized];
                                        next[i] = val;
                                        return view === "previsto"
                                          ? { ...x, qtyExpected: next }
                                          : { ...x, qtyRealized: next };
                                      });
                                    }}
                                  />
                                </TableCell>
                              ))}
                              <TableCell className="text-right whitespace-nowrap">
                                {formatBRL(rev)}
                              </TableCell>
                              <TableCell className="text-right whitespace-nowrap">
                                {formatBRL(cost)}
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeRow.mutate(r)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      {!collapsed.has(g.accountId) && g.rows.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={18} className="text-sm text-muted-foreground">
                            Nenhum cliente nesta conta ainda.
                          </TableCell>
                        </TableRow>
                      )}
                      {g.rows.length > 0 && (
                        <>
                          <TableRow key={`sr-${g.accountId}`} className="bg-muted/20">
                            <TableCell colSpan={3} className="text-sm font-medium">
                              Subtotal {g.code} — receita
                            </TableCell>
                            {g.revenue.map((v, i) => (
                              <TableCell key={i} className="text-right text-xs whitespace-nowrap">
                                {formatBRL(v)}
                              </TableCell>
                            ))}
                            <TableCell className="text-right font-medium whitespace-nowrap">
                              {formatBRL(g.totalRevenue)}
                            </TableCell>
                            <TableCell colSpan={2} />
                          </TableRow>
                          <TableRow key={`sc-${g.accountId}`} className="bg-muted/20">
                            <TableCell colSpan={3} className="text-sm font-medium">
                              Subtotal {g.code} — custo
                            </TableCell>
                            {g.cost.map((v, i) => (
                              <TableCell key={i} className="text-right text-xs whitespace-nowrap">
                                {formatBRL(v)}
                              </TableCell>
                            ))}
                            <TableCell />
                            <TableCell className="text-right font-medium whitespace-nowrap">
                              {formatBRL(g.totalCost)}
                            </TableCell>
                            <TableCell />
                          </TableRow>
                        </>
                      )}
                    </Fragment>
                  ))
                )}
                {rows.length > 0 && (
                  <>
                    <TableRow className="bg-muted/40">
                      <TableCell colSpan={3} className="font-medium">
                        Receita prevista por mês (total)
                      </TableCell>
                      {monthTotals.revenue.map((v, i) => (
                        <TableCell key={i} className="text-right text-xs whitespace-nowrap">
                          {formatBRL(v)}
                        </TableCell>
                      ))}
                      <TableCell className="text-right font-medium whitespace-nowrap">
                        {formatBRL(totalRevenue)}
                      </TableCell>
                      <TableCell colSpan={2} />
                    </TableRow>
                    <TableRow className="bg-muted/40">
                      <TableCell colSpan={3} className="font-medium">
                        Custo previsto por mês (total)
                      </TableCell>
                      {monthTotals.cost.map((v, i) => (
                        <TableCell key={i} className="text-right text-xs whitespace-nowrap">
                          {formatBRL(v)}
                        </TableCell>
                      ))}
                      <TableCell />
                      <TableCell className="text-right font-medium whitespace-nowrap">
                        {formatBRL(totalCost)}
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
