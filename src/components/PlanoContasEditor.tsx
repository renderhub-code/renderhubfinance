import { Fragment, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  setAccountActiveAllCompanies,
  upsertAccountAllCompanies,
  upsertGroupAllCompanies,
  upsertSubgroupAllCompanies,
} from "@/lib/plano-contas.functions";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  useAccountGroups,
  useAccountSubgroups,
  useAccounts,
  useUserRoles,
} from "@/lib/queries";

const DRE_SECTIONS = [
  { value: "receita_bruta", label: "Receita Bruta" },
  { value: "deducoes", label: "Deduções" },
  { value: "custos", label: "Custos" },
  { value: "despesas_operacionais", label: "Despesas Operacionais" },
  { value: "despesas_administrativas", label: "Despesas Administrativas" },
  { value: "despesas_comerciais", label: "Despesas Comerciais" },
  { value: "receitas_financeiras", label: "Receitas Financeiras" },
  { value: "despesas_financeiras", label: "Despesas Financeiras" },
  { value: "investimentos", label: "Investimentos" },
  { value: "nao_operacional", label: "Não Operacional" },
] as const;

type AccountType = "entrada" | "saida";

interface GroupForm {
  id: string | null;
  code: string;
  name: string;
  type: AccountType;
  dre_section: string;
  sort_order: string;
}
interface SubgroupForm {
  id: string | null;
  group_id: string;
  code: string;
  name: string;
  sort_order: string;
}
interface AccountForm {
  id: string | null;
  subgroup_id: string;
  code: string;
  name: string;
  type: AccountType;
  sort_order: string;
  active: boolean;
}

const EMPTY_GROUP: GroupForm = {
  id: null,
  code: "",
  name: "",
  type: "saida",
  dre_section: "despesas_operacionais",
  sort_order: "0",
};
const EMPTY_SUBGROUP: SubgroupForm = { id: null, group_id: "", code: "", name: "", sort_order: "0" };
const EMPTY_ACCOUNT: AccountForm = {
  id: null,
  subgroup_id: "",
  code: "",
  name: "",
  type: "saida",
  sort_order: "0",
  active: true,
};

export function PlanoContasEditor({ companyId }: { companyId: string | null }) {
  const queryClient = useQueryClient();
  const { data: groups, isLoading: lg } = useAccountGroups(companyId);
  const { data: subgroups, isLoading: ls } = useAccountSubgroups(companyId);
  const { data: accounts, isLoading: la } = useAccounts(companyId);
  const { data: roles } = useUserRoles();

  const [groupForm, setGroupForm] = useState<GroupForm | null>(null);
  const [subgroupForm, setSubgroupForm] = useState<SubgroupForm | null>(null);
  const [accountForm, setAccountForm] = useState<AccountForm | null>(null);

  const canEdit = useMemo(() => {
    const list = roles?.map((r) => r.role) ?? [];
    return list.includes("controller") || list.includes("financial_manager");
  }, [roles]);

  const rawGroups = groups ?? [];
  const rawSubgroups = subgroups ?? [];
  const rawAccounts = accounts ?? [];

  // Plano de contas é compartilhado: a árvore exibida é deduplicada por código,
  // então funciona tanto para uma empresa quanto no modo Consolidado.
  const { groupList, subgroupList, accountList } = useMemo(() => {
    const groupCodeById = new Map(rawGroups.map((g) => [g.id, g.code]));
    const subgroupCodeById = new Map(rawSubgroups.map((s) => [s.id, s.code]));

    const uniqBy = <T,>(arr: T[], key: (item: T) => string) => {
      const seen = new Set<string>();
      const out: T[] = [];
      for (const item of arr) {
        const k = key(item);
        if (seen.has(k)) continue;
        seen.add(k);
        out.push(item);
      }
      return out;
    };

    return {
      groupList: uniqBy(rawGroups, (g) => g.code),
      subgroupList: uniqBy(rawSubgroups, (s) => s.code).map((s) => ({
        ...s,
        groupCode: groupCodeById.get(s.group_id) ?? "",
      })),
      accountList: uniqBy(rawAccounts, (a) => a.code).map((a) => ({
        ...a,
        subgroupCode: subgroupCodeById.get(a.subgroup_id) ?? "",
      })),
    };
  }, [rawGroups, rawSubgroups, rawAccounts]);

  const upsertGroup = useServerFn(upsertGroupAllCompanies);
  const upsertSubgroup = useServerFn(upsertSubgroupAllCompanies);
  const upsertAccount = useServerFn(upsertAccountAllCompanies);
  const setAccountActive = useServerFn(setAccountActiveAllCompanies);

  const invalidate = () => {
    queryClient.invalidateQueries({
      predicate: (q) =>
        ["account_groups", "account_subgroups", "accounts"].includes(String(q.queryKey[0])),
    });
  };

  const onError = (err: { code?: string; message?: string }) => {
    if (err?.code?.startsWith("23") || err?.message?.includes("duplicate key")) {
      toast.error("Já existe um registro com esse código.");
      return;
    }
    toast.error(err?.message ?? "Não foi possível salvar.");
  };

  const groupPayloadFor = (groupId: string) => {
    const g = groupList.find((x) => x.id === groupId);
    if (!g) throw new Error("Grupo não encontrado.");
    return {
      code: g.code,
      name: g.name,
      type: g.type,
      dre_section: g.dre_section,
      sort_order: g.sort_order,
    };
  };

  const subgroupPayloadFor = (subgroupId: string) => {
    const sg = subgroupList.find((x) => x.id === subgroupId);
    if (!sg) throw new Error("Subgrupo não encontrado.");
    const g = groupList.find((x) => x.code === sg.groupCode);
    if (!g) throw new Error("Grupo do subgrupo não encontrado.");
    return {
      code: sg.code,
      name: sg.name,
      sort_order: sg.sort_order,
      group: groupPayloadFor(g.id),
    };
  };

  const saveGroup = useMutation({
    mutationFn: async (f: GroupForm) => {
      const original = f.id ? (groupList.find((g) => g.id === f.id)?.code ?? null) : null;
      return upsertGroup({
        data: {
          code: f.code.trim(),
          name: f.name.trim(),
          type: f.type,
          dre_section: f.dre_section,
          sort_order: Number(f.sort_order) || 0,
          originalCode: original,
        },
      });
    },
    onSuccess: (res) => {
      toast.success(`Grupo salvo e replicado em ${res.companies} empresas.`);
      setGroupForm(null);
      invalidate();
    },
    onError,
  });

  const saveSubgroup = useMutation({
    mutationFn: async (f: SubgroupForm) => {
      const original = f.id ? (subgroupList.find((s) => s.id === f.id)?.code ?? null) : null;
      return upsertSubgroup({
        data: {
          code: f.code.trim(),
          name: f.name.trim(),
          sort_order: Number(f.sort_order) || 0,
          originalCode: original,
          group: groupPayloadFor(f.group_id),
        },
      });
    },
    onSuccess: (res) => {
      toast.success(`Subgrupo salvo e replicado em ${res.companies} empresas.`);
      setSubgroupForm(null);
      invalidate();
    },
    onError,
  });

  const saveAccount = useMutation({
    mutationFn: async (f: AccountForm) => {
      const original = f.id ? (accountList.find((a) => a.id === f.id)?.code ?? null) : null;
      return upsertAccount({
        data: {
          code: f.code.trim(),
          name: f.name.trim(),
          type: f.type,
          sort_order: Number(f.sort_order) || 0,
          active: f.active,
          originalCode: original,
          subgroup: subgroupPayloadFor(f.subgroup_id),
        },
      });
    },
    onSuccess: (res) => {
      toast.success(`Conta salva e replicada em ${res.companies} empresas.`);
      setAccountForm(null);
      invalidate();
    },
    onError,
  });

  const toggleAccount = useMutation({
    mutationFn: async ({ code, active }: { code: string; active: boolean }) =>
      setAccountActive({ data: { code, active } }),
    onSuccess: (res) => {
      toast.success(`Situação atualizada em ${res.companies} empresas.`);
      invalidate();
    },
    onError,
  });

  const subgroupOptions = subgroupList.map((sg) => {
    const g = groupList.find((x) => x.code === sg.groupCode);
    return { id: sg.id, label: `${sg.code} — ${sg.name}${g ? ` (${g.code} ${g.name})` : ""}` };
  });


  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle className="text-base">Contas</CardTitle>
          <p className="text-sm text-muted-foreground">
            Plano de contas compartilhado — toda alteração de grupo, subgrupo ou conta é replicada
            em todas as empresas.
          </p>

        </div>
        {canEdit && (
          <div className="flex shrink-0 gap-2">
            <Button size="sm" variant="outline" onClick={() => setGroupForm(EMPTY_GROUP)}>
              <Plus className="mr-1 size-4" /> Grupo
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={groupList.length === 0}
              onClick={() =>
                setSubgroupForm({ ...EMPTY_SUBGROUP, group_id: groupList[0]?.id ?? "" })
              }
            >
              <Plus className="mr-1 size-4" /> Subgrupo
            </Button>
            <Button
              size="sm"
              disabled={subgroupList.length === 0}
              onClick={() =>
                setAccountForm({ ...EMPTY_ACCOUNT, subgroup_id: subgroupList[0]?.id ?? "" })
              }
            >
              <Plus className="mr-1 size-4" /> Nova conta
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {lg || ls || la ? (
          <TableSkeleton />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-32">Código</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="w-28">Nível</TableHead>
                <TableHead className="w-28">Natureza</TableHead>
                <TableHead className="w-24">Situação</TableHead>
                <TableHead className="w-24 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groupList.map((g) => (
                <Fragment key={g.id}>
                  <TableRow className="bg-muted/40 font-medium">
                    <TableCell className="font-mono text-xs">{g.code}</TableCell>
                    <TableCell>{g.name}</TableCell>
                    <TableCell className="text-muted-foreground">Grupo</TableCell>
                    <TableCell className="text-muted-foreground">
                      {g.type === "entrada" ? "Entrada" : "Saída"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {DRE_SECTIONS.find((s) => s.value === g.dre_section)?.label ?? g.dre_section}
                    </TableCell>
                    <TableCell className="text-right">
                      {canEdit && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() =>
                            setGroupForm({
                              id: g.id,
                              code: g.code,
                              name: g.name,
                              type: g.type,
                              dre_section: g.dre_section,
                              sort_order: String(g.sort_order),
                            })
                          }
                        >
                          <Pencil className="size-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>

                  {subgroupList
                    .filter((sg) => sg.groupCode === g.code)
                    .map((sg) => (
                      <Fragment key={sg.id}>
                        <TableRow>
                          <TableCell className="pl-6 font-mono text-xs">{sg.code}</TableCell>
                          <TableCell className="pl-6">{sg.name}</TableCell>
                          <TableCell className="text-muted-foreground">Subgrupo</TableCell>
                          <TableCell className="text-muted-foreground">—</TableCell>
                          <TableCell className="text-muted-foreground">—</TableCell>
                          <TableCell className="text-right">
                            {canEdit && (
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() =>
                                  setSubgroupForm({
                                    id: sg.id,
                                    group_id: g.id,
                                    code: sg.code,
                                    name: sg.name,
                                    sort_order: String(sg.sort_order),
                                  })
                                }
                              >
                                <Pencil className="size-4" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>

                        {accountList
                          .filter((a) => a.subgroupCode === sg.code)
                          .map((a) => (
                            <TableRow key={a.id} className={a.active ? "" : "opacity-60"}>
                              <TableCell className="pl-12 font-mono text-xs">{a.code}</TableCell>
                              <TableCell className="pl-12">{a.name}</TableCell>
                              <TableCell className="text-muted-foreground">Analítica</TableCell>
                              <TableCell className="text-muted-foreground">
                                {a.type === "entrada" ? "Entrada" : "Saída"}
                              </TableCell>
                              <TableCell>
                                <Badge variant={a.active ? "secondary" : "outline"}>
                                  {a.active ? "Ativa" : "Inativa"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                {canEdit ? (
                                  <div className="flex items-center justify-end gap-2">
                                    <Switch
                                      checked={a.active}
                                      disabled={toggleAccount.isPending}
                                      onCheckedChange={(v) =>
                                        toggleAccount.mutate({ code: a.code, active: v })
                                      }
                                    />
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() =>
                                        setAccountForm({
                                          id: a.id,
                                          subgroup_id: sg.id,
                                          code: a.code,
                                          name: a.name,
                                          type: a.type,
                                          sort_order: String(a.sort_order),
                                          active: a.active,
                                        })
                                      }
                                    >
                                      <Pencil className="size-4" />
                                    </Button>
                                  </div>
                                ) : (
                                  <span className="text-xs text-muted-foreground">
                                    Somente leitura
                                  </span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                      </Fragment>
                    ))}
                </Fragment>
              ))}
              {groupList.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                    Nenhum grupo cadastrado ainda.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Grupo */}
      <Dialog open={!!groupForm} onOpenChange={(o) => !o && setGroupForm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{groupForm?.id ? "Editar grupo" : "Novo grupo"}</DialogTitle>
          </DialogHeader>
          {groupForm && (
            <div className="grid gap-3">
              <div className="grid gap-1">
                <Label>Código</Label>
                <Input
                  value={groupForm.code}
                  onChange={(e) => setGroupForm({ ...groupForm, code: e.target.value })}
                />
              </div>
              <div className="grid gap-1">
                <Label>Descrição</Label>
                <Input
                  value={groupForm.name}
                  onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                />
              </div>
              <div className="grid gap-1">
                <Label>Natureza</Label>
                <Select
                  value={groupForm.type}
                  onValueChange={(v) => setGroupForm({ ...groupForm, type: v as AccountType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="entrada">Entrada</SelectItem>
                    <SelectItem value="saida">Saída</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1">
                <Label>Seção da DRE</Label>
                <Select
                  value={groupForm.dre_section}
                  onValueChange={(v) => setGroupForm({ ...groupForm, dre_section: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DRE_SECTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1">
                <Label>Ordem</Label>
                <Input
                  type="number"
                  value={groupForm.sort_order}
                  onChange={(e) => setGroupForm({ ...groupForm, sort_order: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setGroupForm(null)}>
              Cancelar
            </Button>
            <Button
              disabled={saveGroup.isPending}
              onClick={() => {
                if (!groupForm) return;
                if (!groupForm.code.trim() || !groupForm.name.trim()) {
                  toast.error("Informe código e descrição.");
                  return;
                }
                saveGroup.mutate(groupForm);
              }}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Subgrupo */}
      <Dialog open={!!subgroupForm} onOpenChange={(o) => !o && setSubgroupForm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{subgroupForm?.id ? "Editar subgrupo" : "Novo subgrupo"}</DialogTitle>
          </DialogHeader>
          {subgroupForm && (
            <div className="grid gap-3">
              <div className="grid gap-1">
                <Label>Grupo</Label>
                <Select
                  value={subgroupForm.group_id}
                  onValueChange={(v) => setSubgroupForm({ ...subgroupForm, group_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o grupo" />
                  </SelectTrigger>
                  <SelectContent>
                    {groupList.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.code} — {g.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1">
                <Label>Código</Label>
                <Input
                  value={subgroupForm.code}
                  onChange={(e) => setSubgroupForm({ ...subgroupForm, code: e.target.value })}
                />
              </div>
              <div className="grid gap-1">
                <Label>Descrição</Label>
                <Input
                  value={subgroupForm.name}
                  onChange={(e) => setSubgroupForm({ ...subgroupForm, name: e.target.value })}
                />
              </div>
              <div className="grid gap-1">
                <Label>Ordem</Label>
                <Input
                  type="number"
                  value={subgroupForm.sort_order}
                  onChange={(e) => setSubgroupForm({ ...subgroupForm, sort_order: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSubgroupForm(null)}>
              Cancelar
            </Button>
            <Button
              disabled={saveSubgroup.isPending}
              onClick={() => {
                if (!subgroupForm) return;
                if (!subgroupForm.group_id) {
                  toast.error("Selecione o grupo.");
                  return;
                }
                if (!subgroupForm.code.trim() || !subgroupForm.name.trim()) {
                  toast.error("Informe código e descrição.");
                  return;
                }
                saveSubgroup.mutate(subgroupForm);
              }}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Conta */}
      <Dialog open={!!accountForm} onOpenChange={(o) => !o && setAccountForm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{accountForm?.id ? "Editar conta" : "Nova conta"}</DialogTitle>
          </DialogHeader>
          {accountForm && (
            <div className="grid gap-3">
              <div className="grid gap-1">
                <Label>Subgrupo</Label>
                <Select
                  value={accountForm.subgroup_id}
                  onValueChange={(v) => setAccountForm({ ...accountForm, subgroup_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o subgrupo" />
                  </SelectTrigger>
                  <SelectContent>
                    {subgroupOptions.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1">
                <Label>Código</Label>
                <Input
                  value={accountForm.code}
                  onChange={(e) => setAccountForm({ ...accountForm, code: e.target.value })}
                />
              </div>
              <div className="grid gap-1">
                <Label>Descrição</Label>
                <Input
                  value={accountForm.name}
                  onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })}
                />
              </div>
              <div className="grid gap-1">
                <Label>Natureza</Label>
                <Select
                  value={accountForm.type}
                  onValueChange={(v) => setAccountForm({ ...accountForm, type: v as AccountType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="entrada">Entrada</SelectItem>
                    <SelectItem value="saida">Saída</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1">
                <Label>Ordem</Label>
                <Input
                  type="number"
                  value={accountForm.sort_order}
                  onChange={(e) => setAccountForm({ ...accountForm, sort_order: e.target.value })}
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={accountForm.active}
                  onCheckedChange={(v) => setAccountForm({ ...accountForm, active: v })}
                />
                Conta ativa
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAccountForm(null)}>
              Cancelar
            </Button>
            <Button
              disabled={saveAccount.isPending}
              onClick={() => {
                if (!accountForm) return;
                if (!accountForm.subgroup_id) {
                  toast.error("Selecione o subgrupo.");
                  return;
                }
                if (!accountForm.code.trim() || !accountForm.name.trim()) {
                  toast.error("Informe código e descrição.");
                  return;
                }
                saveAccount.mutate(accountForm);
              }}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
