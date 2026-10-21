import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useHubStore } from "@/lib/hub-store";
import { LancamentosPadrao } from "@/components/padrao/LancamentosPadrao";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableSkeleton } from "@/components/skeletons";
import {
  useAccounts,
  useBusinessUnits,
  useTransactions,
  useUserRoles,
  type Transaction,
} from "@/lib/queries";
import { useCompanyStore } from "@/lib/company-store";
import { useFinancialStore } from "@/lib/financial-store";
import { formatBRL, formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/lancamentos")({
  head: () => ({ meta: [
    { title: "Lançamentos — Hub Financial Command" },
    { name: "description", content: "Lançamentos financeiros previstos e realizados por empresa." },
    { property: "og:title", content: "Lançamentos — Hub Financial Command" },
    { property: "og:description", content: "Documentos financeiros importados e lançados no hub." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }), component: LancamentosPage,
});

const NONE = "__none__";
const PAGE_SIZE = 50;

const STATUS_LABEL: Record<Transaction["status"], string> = {
  previsto: "Previsto",
  realizado: "Realizado",
  cancelado: "Cancelado",
  atrasado: "Atrasado",
};

const STATUS_BADGE: Record<Transaction["status"], "default" | "secondary" | "destructive" | "outline"> = {
  realizado: "default",
  previsto: "secondary",
  atrasado: "destructive",
  cancelado: "outline",
};

interface TxForm {
  id: string | null;
  company_id: string;
  account_id: string;
  business_unit_id: string;
  status: Transaction["status"];
  entry_date: string;
  due_date: string;
  settled_date: string;
  amount_expected: string;
  amount_realized: string;
  description: string;
  notes: string;
}

const todayISO = () => new Date().toISOString().slice(0, 10);

function emptyForm(companyId: string, businessUnitId: string | null): TxForm {
  return {
    id: null,
    company_id: companyId,
    account_id: "",
    business_unit_id: businessUnitId ?? NONE,
    status: "previsto",
    entry_date: todayISO(),
    due_date: "",
    settled_date: "",
    amount_expected: "0",
    amount_realized: "0",
    description: "",
    notes: "",
  };
}

function formFromTx(tx: Transaction): TxForm {
  return {
    id: tx.id,
    company_id: tx.company_id,
    account_id: tx.account_id,
    business_unit_id: tx.business_unit_id ?? NONE,
    status: tx.status,
    entry_date: tx.entry_date?.slice(0, 10) ?? "",
    due_date: tx.due_date?.slice(0, 10) ?? "",
    settled_date: tx.settled_date?.slice(0, 10) ?? "",
    amount_expected: String(tx.amount_expected ?? 0),
    amount_realized: String(tx.amount_realized ?? 0),
    description: tx.description ?? "",
    notes: tx.notes ?? "",
  };
}

/** Use Noronha usa a tela integrada ao Bling; as demais empresas usam a estrutura padrão do hub. */
function LancamentosPage() {
  const activeHubId = useHubStore((s) => s.activeHubId);
  return activeHubId === "noronha" ? <LancamentosNoronha /> : <LancamentosPadrao />;
}

function LancamentosNoronha() {
  const queryClient = useQueryClient();
  const companyId = useCompanyStore((s) => s.activeCompanyId);
  const businessUnitId = useCompanyStore((s) => s.activeBusinessUnitId);
  const year = useFinancialStore((s) => s.year);

  const [statusFilter, setStatusFilter] = useState<Transaction["status"] | "todos">("todos");
  const [typeFilter, setTypeFilter] = useState<"entrada" | "saida" | "todos">("todos");
  const [accountFilter, setAccountFilter] = useState<string>("todas");
  const [origemFilter, setOrigemFilter] = useState<"todas" | "bling" | "manual">("todas");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const [form, setForm] = useState<TxForm | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [realizingId, setRealizingId] = useState<string | null>(null);

  const { data: txs, isLoading } = useTransactions(companyId, {
    from: `${year}-01-01`,
    to: `${year}-12-31`,
    businessUnitId,
    status: statusFilter,
    type: typeFilter,
    accountId: accountFilter === "todas" ? undefined : accountFilter,
  });
  const { data: accounts } = useAccounts(companyId);
  const { data: units = [] } = useBusinessUnits(companyId);
  const { data: roles } = useUserRoles();

  const canEdit = useMemo(() => {
    const list = roles?.map((r) => r.role) ?? [];
    return list.includes("controller") || list.includes("financial_manager");
  }, [roles]);

  const accountMap = useMemo(
    () => new Map((accounts ?? []).map((a) => [a.id, `${a.code} · ${a.name}`])),
    [accounts],
  );
  const filterAccounts = useMemo(
    () => [...(accounts ?? [])].sort((a, b) => a.code.localeCompare(b.code)),
    [accounts],
  );

  const filtered = useMemo(() => {
    let list = txs ?? [];
    if (origemFilter !== "todas") {
      list = list.filter((t) =>
        origemFilter === "bling" ? t.external_source?.startsWith("bling:") : !t.external_source?.startsWith("bling:"),
      );
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (t) => (t.description ?? "").toLowerCase().includes(q) || (t.notes ?? "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [txs, origemFilter, search]);

  useEffect(() => {
    setPage(0);
  }, [statusFilter, typeFilter, accountFilter, origemFilter, search, companyId, businessUnitId, year]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["transactions"] });
    queryClient.invalidateQueries({ queryKey: ["accounts_with_dre"] });
  };

  const onError = (err: { message?: string }) =>
    toast.error(err?.message ?? "Não foi possível salvar o lançamento.");

  const saveMutation = useMutation({
    mutationFn: async (f: TxForm) => {
      const account = accounts?.find((a) => a.id === f.account_id);
      if (!account) throw new Error("Selecione uma categoria válida.");
      const payload = {
        company_id: f.company_id,
        account_id: f.account_id,
        business_unit_id: f.business_unit_id === NONE ? null : f.business_unit_id,
        type: account.type,
        status: f.status,
        entry_date: f.entry_date,
        due_date: f.due_date || null,
        settled_date: f.settled_date || null,
        amount_expected: Number(f.amount_expected) || 0,
        amount_realized: Number(f.amount_realized) || 0,
        description: f.description.trim() || null,
        notes: f.notes.trim() || null,
      };
      if (f.id) {
        const { error } = await supabase.from("transactions").update(payload).eq("id", f.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("transactions").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: (_r, f) => {
      toast.success(f.id ? "Lançamento atualizado." : "Lançamento criado.");
      setForm(null);
      invalidate();
    },
    onError,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("transactions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lançamento excluído.");
      setDeletingId(null);
      invalidate();
    },
    onError: (err: { message?: string }) => {
      toast.error(err?.message ?? "Não foi possível excluir o lançamento.");
      setDeletingId(null);
    },
  });

  const realizeMutation = useMutation({
    mutationFn: async (tx: Transaction) => {
      setRealizingId(tx.id);
      const { error } = await supabase
        .from("transactions")
        .update({
          status: "realizado",
          settled_date: tx.due_date ?? tx.entry_date ?? todayISO(),
          amount_realized: tx.amount_expected,
        })
        .eq("id", tx.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lançamento marcado como realizado.");
      invalidate();
    },
    onError,
    onSettled: () => setRealizingId(null),
  });

  const canCreate = canEdit && !!companyId;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Lançamentos</h1>
          <p className="text-sm text-muted-foreground">
            {filtered.length} de {txs?.length ?? 0} documentos financeiros em {year}.
          </p>
        </div>
        {canEdit && (
          <div className="flex flex-col items-end gap-1">
            <Button
              size="sm"
              disabled={!canCreate}
              onClick={() => companyId && setForm(emptyForm(companyId, businessUnitId))}
            >
              <Plus className="mr-1 size-4" /> Novo lançamento
            </Button>
            {!companyId && (
              <p className="text-xs text-muted-foreground">Selecione uma empresa específica para lançar.</p>
            )}
          </div>
        )}
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-6">
          <div className="grid gap-1">
            <Label className="text-xs">Status</Label>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
              <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {(Object.keys(STATUS_LABEL) as Transaction["status"][]).map((s) => (
                  <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1">
            <Label className="text-xs">Tipo</Label>
            <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}>
              <SelectTrigger className="h-9 w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="entrada">Entrada</SelectItem>
                <SelectItem value="saida">Saída</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1">
            <Label className="text-xs">Categoria</Label>
            <Select value={accountFilter} onValueChange={setAccountFilter}>
              <SelectTrigger className="h-9 w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                {filterAccounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.code} — {a.name}{!a.active ? " (inativa)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1">
            <Label className="text-xs">Origem</Label>
            <Select value={origemFilter} onValueChange={(v) => setOrigemFilter(v as typeof origemFilter)}>
              <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                <SelectItem value="bling">Bling</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid flex-1 min-w-48 gap-1">
            <Label className="text-xs">Buscar</Label>
            <Input
              className="h-9"
              placeholder="Histórico ou observação..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Documentos</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          {isLoading ? <TableSkeleton rows={8} cols={9} /> : <Table><TableHeader><TableRow><TableHead>Competência</TableHead><TableHead>Vencimento</TableHead><TableHead>Histórico</TableHead><TableHead>Categoria</TableHead><TableHead>Tipo</TableHead><TableHead>Status</TableHead><TableHead>Origem</TableHead><TableHead className="text-right">Previsto</TableHead><TableHead className="text-right">Realizado</TableHead>{canEdit && <TableHead className="text-right">Ações</TableHead>}</TableRow></TableHeader>
            <TableBody>{pageRows.length === 0 ? <TableRow><TableCell colSpan={canEdit ? 10 : 9} className="py-10 text-center text-muted-foreground">Nenhum lançamento encontrado.</TableCell></TableRow> : pageRows.map((tx) => <TableRow key={tx.id}><TableCell className="whitespace-nowrap">{formatDate(tx.entry_date)}</TableCell><TableCell className="whitespace-nowrap">{formatDate(tx.due_date)}</TableCell><TableCell className="max-w-[280px] truncate">{tx.description ?? "—"}</TableCell><TableCell className="max-w-[240px] truncate text-muted-foreground">{accountMap.get(tx.account_id) ?? "—"}</TableCell><TableCell>{tx.type === "entrada" ? "Entrada" : "Saída"}</TableCell><TableCell><Badge variant={STATUS_BADGE[tx.status]}>{STATUS_LABEL[tx.status]}</Badge></TableCell><TableCell>{tx.external_source?.startsWith("bling:") ? "Bling" : "Manual"}</TableCell><TableCell className="text-right whitespace-nowrap">{formatBRL(tx.amount_expected)}</TableCell><TableCell className="text-right whitespace-nowrap">{formatBRL(tx.amount_realized)}</TableCell>
              {canEdit && (
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {(tx.status === "previsto" || tx.status === "atrasado") && (
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Marcar como realizado"
                        disabled={realizingId === tx.id}
                        onClick={() => realizeMutation.mutate(tx)}
                      >
                        <CheckCircle2 className="size-4" />
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" title="Editar" onClick={() => setForm(formFromTx(tx))}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button size="icon" variant="ghost" title="Excluir" onClick={() => setDeletingId(tx.id)}>
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              )}
            </TableRow>)}</TableBody>
          </Table>}
        </CardContent>
        {filtered.length > 0 && (
          <CardFooter className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">Página {page + 1} de {pageCount}</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
              <Button size="sm" variant="outline" disabled={page >= pageCount - 1} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
            </div>
          </CardFooter>
        )}
      </Card>

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{form?.id ? "Editar lançamento" : "Novo lançamento"}</DialogTitle>
          </DialogHeader>
          {form && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1 sm:col-span-2">
                <Label>Categoria</Label>
                <Select
                  value={form.account_id}
                  onValueChange={(v) => setForm({ ...form, account_id: v })}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione a categoria" /></SelectTrigger>
                  <SelectContent>
                    {(accounts ?? [])
                      .filter((a) => a.active)
                      .sort((a, b) => a.code.localeCompare(b.code))
                      .map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.code} — {a.name} ({a.type === "entrada" ? "Entrada" : "Saída"})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              {units.length > 1 && (
                <div className="grid gap-1 sm:col-span-2">
                  <Label>Unidade de negócio</Label>
                  <Select
                    value={form.business_unit_id}
                    onValueChange={(v) => setForm({ ...form, business_unit_id: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>— nenhuma —</SelectItem>
                      {units.map((u) => (
                        <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="grid gap-1">
                <Label>Competência</Label>
                <Input
                  type="date"
                  value={form.entry_date}
                  onChange={(e) => setForm({ ...form, entry_date: e.target.value })}
                />
              </div>
              <div className="grid gap-1">
                <Label>Vencimento</Label>
                <Input
                  type="date"
                  value={form.due_date}
                  onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                />
              </div>
              <div className="grid gap-1">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Transaction["status"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(STATUS_LABEL) as Transaction["status"][]).map((s) => (
                      <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1">
                <Label>Data de liquidação</Label>
                <Input
                  type="date"
                  value={form.settled_date}
                  onChange={(e) => setForm({ ...form, settled_date: e.target.value })}
                />
              </div>
              <div className="grid gap-1">
                <Label>Valor previsto</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.amount_expected}
                  onChange={(e) => setForm({ ...form, amount_expected: e.target.value })}
                />
              </div>
              <div className="grid gap-1">
                <Label>Valor realizado</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.amount_realized}
                  onChange={(e) => setForm({ ...form, amount_realized: e.target.value })}
                />
              </div>
              <div className="grid gap-1 sm:col-span-2">
                <Label>Histórico</Label>
                <Input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
              <div className="grid gap-1 sm:col-span-2">
                <Label>Observações</Label>
                <Textarea
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setForm(null)}>Cancelar</Button>
            <Button
              disabled={saveMutation.isPending}
              onClick={() => {
                if (!form) return;
                if (!form.account_id) { toast.error("Selecione uma categoria."); return; }
                if (!form.entry_date) { toast.error("Informe a data de competência."); return; }
                saveMutation.mutate(form);
              }}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingId} onOpenChange={(o) => !o && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lançamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita. O lançamento será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMutation.isPending}
              onClick={() => deletingId && deleteMutation.mutate(deletingId)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
