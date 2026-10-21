import { useMemo, useState } from "react";
import { Check, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useCompanyStore } from "@/lib/company-store";
import {
  useAccountGroups, useAccountMappings, useAccounts, useAccountSubgroups, useTransactions,
  type Transaction,
} from "@/lib/queries";
import { ImportarLancamentos } from "@/components/ImportarLancamentos";
import { EditarLancamento } from "@/components/EditarLancamento";
import { formatBRL, formatDate } from "@/lib/format";

const COLUMNS = [
  "Data do Documento", "Nº do Documento", "Data do Pagamento", "Valor Pago", "Histórico",
  "Descrição", "Categoria", "Conta Financeira", "Banco", "Conta",
];

export function LancamentosPadrao() {
  const companyId = useCompanyStore((s) => s.activeCompanyId);
  const { data: txs = [], isLoading } = useTransactions(companyId);
  const { data: accounts = [] } = useAccounts(companyId);
  const { data: subgroups = [] } = useAccountSubgroups(companyId);
  const { data: groups = [] } = useAccountGroups(companyId);
  const { data: mappings = [] } = useAccountMappings(companyId);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const accById = new Map(accounts.map((a) => [a.id, a]));
  const subById = new Map(subgroups.map((s) => [s.id, s]));
  const grpById = new Map(groups.map((g) => [g.id, g]));
  const signedValue = (t: Transaction) => {
    const v = Number(t.amount_realized || t.amount_expected || 0);
    return t.type === "saida" ? -v : v;
  };

  // In consolidated mode the same code exists per company: filter by code.
  const codeOf = (id: string) => accById.get(id)?.code ?? "";
  const accountOptions = useMemo(() => {
    const byCode = new Map<string, { code: string; name: string; group: string }>();
    for (const a of accounts) {
      if (byCode.has(a.code)) continue;
      const g = grpById.get(subById.get(a.subgroup_id)?.group_id ?? "");
      byCode.set(a.code, { code: a.code, name: a.name, group: g ? `${g.code} - ${g.name}` : "Outros" });
    }
    const list = [...byCode.values()].sort((x, y) => x.code.localeCompare(y.code, "pt-BR", { numeric: true }));
    const grouped = new Map<string, typeof list>();
    for (const o of list) grouped.set(o.group, [...(grouped.get(o.group) ?? []), o]);
    return grouped;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts, groups, subgroups]);

  const filtered = selected.size === 0 ? txs : txs.filter((t) => selected.has(codeOf(t.account_id)));
  const total = filtered.reduce((s, t) => s + signedValue(t), 0);

  function toggle(code: string) {
    setSelected((s) => { const n = new Set(s); n.has(code) ? n.delete(code) : n.add(code); return n; });
  }

  function cells(t: Transaction) {
    const a = accById.get(t.account_id);
    const g = a ? grpById.get(subById.get(a.subgroup_id)?.group_id ?? "") : undefined;
    return [
      formatDate(t.entry_date), t.document_number ?? "", formatDate(t.settled_date),
      formatBRL(signedValue(t)), t.notes ?? "", t.description ?? "",
      g ? `${g.code} - ${g.name}` : "", a ? `${a.code} - ${a.name}` : "",
      t.bank ?? "", t.bank_account ?? "",
    ];
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Lançamentos</h1>
          <p className="text-sm text-muted-foreground">
            Registro de documentos e pagamentos conforme princípio da competência e caixa.
          </p>
        </div>
        <ImportarLancamentos companyId={companyId} accounts={accounts} mappings={mappings} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap space-y-0">
          <CardTitle className="text-base">Documentos</CardTitle>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm text-muted-foreground">
              {filtered.length} lançamento(s) · Total {formatBRL(total)}
            </span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <Filter className="h-4 w-4 mr-2" />
                  {selected.size === 0 ? "Conta Financeira: todas" : `Conta Financeira: ${selected.size}`}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="end">
                <Command>
                  <CommandInput placeholder="Buscar conta..." />
                  <CommandList className="max-h-80">
                    <CommandEmpty>Nenhuma conta encontrada.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem onSelect={() => setSelected(new Set([...accountOptions.values()].flat().map((o) => o.code)))}>
                        Selecionar todas
                      </CommandItem>
                      <CommandItem onSelect={() => setSelected(new Set())}>Limpar</CommandItem>
                    </CommandGroup>
                    {[...accountOptions.entries()].map(([grp, opts]) => (
                      <CommandGroup key={grp} heading={grp}>
                        {opts.map((o) => (
                          <CommandItem key={o.code} value={`${o.code} ${o.name}`} onSelect={() => toggle(o.code)}>
                            <Check className={"h-4 w-4 mr-2 " + (selected.has(o.code) ? "opacity-100" : "opacity-0")} />
                            {o.code} - {o.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    ))}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto max-h-[calc(100vh-16rem)] rounded-md border">
          <table className="w-full caption-bottom text-sm">
            <TableHeader>
              <TableRow>
                {COLUMNS.map((c) => (
                  <TableHead key={c} className={"sticky top-0 z-10 bg-card shadow-[inset_0_-1px_0_var(--border)] whitespace-nowrap" + (c === "Valor Pago" ? " text-right" : "")}>{c}</TableHead>
                ))}
                <TableHead className="sticky top-0 z-10 bg-card shadow-[inset_0_-1px_0_var(--border)] w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={COLUMNS.length + 1} className="text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={COLUMNS.length + 1} className="text-muted-foreground">Nenhum lançamento.</TableCell></TableRow>
              ) : (
                filtered.map((t) => (
                  <TableRow key={t.id}>
                    {cells(t).map((v, i) => (
                      <TableCell key={i} className={(i === 3 ? "text-right " : "") + "whitespace-nowrap"}>{v || "—"}</TableCell>
                    ))}
                    <TableCell className="py-0">
                      <EditarLancamento tx={t} accounts={accounts.filter((a) => a.company_id === t.company_id)} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
