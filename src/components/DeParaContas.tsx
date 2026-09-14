import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableSkeleton } from "@/components/skeletons";
import { ImportarPlanoContas } from "@/components/ImportarPlanoContas";
import {
  useAccountMappings,
  useAccounts,
  useUserRoles,
  type AccountMapping,
} from "@/lib/queries";

interface DeParaContasProps {
  companyId: string | null;
}

interface DraftRow {
  source_code: string;
  source_name: string;
  account_id: string;
  notes: string;
}

const NONE = "__none__";
const EMPTY_DRAFT: DraftRow = { source_code: "", source_name: "", account_id: NONE, notes: "" };

export function DeParaContas({ companyId }: DeParaContasProps) {
  const queryClient = useQueryClient();
  const { data: accounts, isLoading: loadingAccounts } = useAccounts(companyId);
  const { data: mappings, isLoading: loadingMappings } = useAccountMappings(companyId);
  const { data: roles } = useUserRoles();

  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftRow>(EMPTY_DRAFT);

  const canEdit = useMemo(() => {
    const list = roles?.map((r) => r.role) ?? [];
    return list.includes("controller") || list.includes("financial_manager");
  }, [roles]);

  const activeAccounts = useMemo(
    () => (accounts ?? []).filter((a) => a.active),
    [accounts],
  );

  const accountLabel = (id: string | null) => {
    if (!id) return null;
    const acc = activeAccounts.find((a) => a.id === id) ?? accounts?.find((a) => a.id === id);
    return acc ? `${acc.code} — ${acc.name}` : null;
  };

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["account_mappings", companyId ?? "__all__"] });
  };

  const resetForm = () => {
    setCreating(false);
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
  };

  const saveMutation = useMutation({
    mutationFn: async (payload: { id: string | null; row: DraftRow }) => {
      const values = {
        company_id: companyId!,
        source_code: payload.row.source_code.trim(),
        source_name: payload.row.source_name.trim() || null,
        account_id: payload.row.account_id === NONE ? null : payload.row.account_id,
        notes: payload.row.notes.trim() || null,
      };
      if (payload.id) {
        const { company_id: _omit, ...rest } = values;
        const { error } = await supabase
          .from("account_mappings")
          .update(rest)
          .eq("id", payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("account_mappings").insert(values);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Correspondência salva.");
      resetForm();
      invalidate();
    },
    onError: (err: { code?: string; message?: string }) => {
      if (err?.code?.startsWith("23") || err?.message?.includes("duplicate key")) {
        toast.error("Já existe uma correspondência com esse código de origem.");
        return;
      }
      toast.error(err?.message ?? "Não foi possível salvar a correspondência.");
    },
  });

  const mapMutation = useMutation({
    mutationFn: async ({ id, accountId }: { id: string; accountId: string | null }) => {
      const { error } = await supabase
        .from("account_mappings")
        .update({ account_id: accountId })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Categoria interna vinculada.");
      invalidate();
    },
    onError: (err: { message?: string }) =>
      toast.error(err?.message ?? "Não foi possível vincular a categoria."),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("account_mappings").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Correspondência removida.");
      invalidate();
    },
    onError: (err: { message?: string }) =>
      toast.error(err?.message ?? "Não foi possível remover a correspondência."),
  });

  const startEdit = (row: AccountMapping) => {
    setCreating(false);
    setEditingId(row.id);
    setDraft({
      source_code: row.source_code,
      source_name: row.source_name ?? "",
      account_id: row.account_id ?? NONE,
      notes: row.notes ?? "",
    });
  };

  const submit = () => {
    if (!draft.source_code.trim()) {
      toast.error("Informe o código de origem (ERP).");
      return;
    }
    saveMutation.mutate({ id: editingId, row: draft });
  };

  if (!companyId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">De-Para (ERP → Categoria interna)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Selecione uma empresa no seletor acima para gerenciar as correspondências de categorias.
          </p>
        </CardContent>
      </Card>
    );
  }

  const editor = (
    <TableRow>
      <TableCell>
        <Input
          className="h-8 font-mono text-xs"
          placeholder="Ex.: 3.1.01.0001"
          value={draft.source_code}
          onChange={(e) => setDraft((d) => ({ ...d, source_code: e.target.value }))}
        />
      </TableCell>
      <TableCell>
        <Input
          className="h-8"
          placeholder="Descrição no ERP"
          value={draft.source_name}
          onChange={(e) => setDraft((d) => ({ ...d, source_name: e.target.value }))}
        />
      </TableCell>
      <TableCell>
        <Select
          value={draft.account_id}
          onValueChange={(v) => setDraft((d) => ({ ...d, account_id: v }))}
        >
          <SelectTrigger className="h-8">
            <SelectValue placeholder="Selecione a categoria interna" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Aguardando mapeamento</SelectItem>
            {activeAccounts.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.code} — {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Input
          className="h-8"
          placeholder="Observação"
          value={draft.notes}
          onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
        />
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-2">
          <Button size="sm" onClick={submit} disabled={saveMutation.isPending}>
            Salvar
          </Button>
          <Button size="sm" variant="ghost" onClick={resetForm}>
            <X className="size-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle className="text-base">De-Para (ERP → Categoria interna)</CardTitle>
          <p className="text-sm text-muted-foreground">
            Correspondência entre o plano de contas da contabilidade/ERP e as categorias internas desta
            empresa.
          </p>
        </div>
        {canEdit && (
          <div className="flex shrink-0 gap-2">
            <ImportarPlanoContas companyId={companyId} mappings={mappings ?? []} />
            <Button
              size="sm"
              onClick={() => {
                setEditingId(null);
                setDraft(EMPTY_DRAFT);
                setCreating(true);
              }}
              disabled={creating}
            >
              <Plus className="mr-1 size-4" /> Nova correspondência
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {loadingAccounts || loadingMappings ? (
          <TableSkeleton />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-40">Código de origem (ERP)</TableHead>
                <TableHead>Descrição de origem</TableHead>
                <TableHead>Categoria interna</TableHead>
                <TableHead>Observação</TableHead>
                <TableHead className="w-32 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {creating && editor}
              {(mappings ?? []).map((row) =>
                editingId === row.id ? (
                  <>{editor}</>
                ) : (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono text-xs">{row.source_code}</TableCell>
                    <TableCell>{row.source_name ?? "—"}</TableCell>
                    <TableCell>
                      {accountLabel(row.account_id) ??
                        (canEdit ? (
                          <Select
                            value={NONE}
                            onValueChange={(v) =>
                              mapMutation.mutate({ id: row.id, accountId: v === NONE ? null : v })
                            }
                          >
                            <SelectTrigger className="h-8 w-full border-dashed text-amber-600">
                              <SelectValue placeholder="Aguardando mapeamento" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={NONE}>Aguardando mapeamento</SelectItem>
                              {activeAccounts.map((a) => (
                                <SelectItem key={a.id} value={a.id}>
                                  {a.code} — {a.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="text-xs text-amber-600">Aguardando mapeamento</span>
                        ))}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{row.notes ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      {canEdit ? (
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => startEdit(row)}>
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => deleteMutation.mutate(row.id)}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Somente leitura</span>
                      )}
                    </TableCell>
                  </TableRow>
                ),
              )}
              {!creating && (mappings?.length ?? 0) === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                    Nenhuma correspondência cadastrada ainda.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
