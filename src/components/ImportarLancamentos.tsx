import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { parseRows, type ParsedTransaction, type RejectedRow } from "@/lib/lancamentos-import";
import type { Account, AccountMapping } from "@/lib/queries";
import { formatBRL, formatDate } from "@/lib/format";

interface Props {
  companyId: string | null;
  accounts: Account[];
  mappings: AccountMapping[];
}

export function ImportarLancamentos({ companyId, accounts, mappings }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState("");
  const [ok, setOk] = useState<ParsedTransaction[]>([]);
  const [rejected, setRejected] = useState<RejectedRow[]>([]);
  const [busy, setBusy] = useState(false);
  const accById = new Map(accounts.map((a) => [a.id, a]));

  async function onFile(file: File) {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true, raw: false, codepage: 65001 });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: "" });
      const res = parseRows(rows, accounts.filter((a) => a.active), mappings);
      if (res.headerError) { toast.error(res.headerError); return; }
      setFileName(file.name); setOk(res.ok); setRejected(res.rejected); setOpen(true);
    } catch (e) {
      toast.error("Não foi possível ler o arquivo: " + (e as Error).message);
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function confirm() {
    if (!companyId || ok.length === 0) return;
    setBusy(true);
    const rows = ok.map((t) => ({
      company_id: companyId,
      account_id: t.account_id,
      type: t.type,
      status: "realizado" as const,
      entry_date: t.entry_date,
      due_date: t.settled_date,
      settled_date: t.settled_date,
      amount_expected: t.amount,
      amount_realized: t.amount,
      document_number: t.document_number,
      notes: t.notes,
      description: t.description,
      bank: t.bank,
      bank_account: t.bank_account,
    }));
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await supabase.from("transactions").insert(rows.slice(i, i + 500));
      if (error) { toast.error("Erro ao gravar: " + error.message); setBusy(false); return; }
    }
    toast.success(`${rows.length} lançamento(s) importado(s)`);
    qc.invalidateQueries({ queryKey: ["transactions"] });
    setBusy(false); setOpen(false);
  }

  return (
    <>
      <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
      <Button
        onClick={() => companyId ? inputRef.current?.click() : toast.error("Selecione uma empresa específica para importar.")}
      >
        <Upload className="h-4 w-4 mr-2" /> Importar Excel/CSV
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Prévia da importação</DialogTitle>
            <DialogDescription>
              {fileName}: {ok.length} lançamento(s) serão importados, {rejected.length} linha(s) recusada(s).
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[50vh] overflow-auto space-y-4 text-sm">
            {ok.length > 0 && (
              <table className="w-full text-xs">
                <thead><tr className="text-left text-muted-foreground">
                  <th className="p-1">Linha</th><th className="p-1">Pagamento</th><th className="p-1">Conta</th><th className="p-1 text-right">Valor</th><th className="p-1">Histórico</th>
                </tr></thead>
                <tbody>
                  {ok.slice(0, 50).map((t) => {
                    const a = accById.get(t.account_id);
                    return (
                      <tr key={t.line} className="border-t">
                        <td className="p-1">{t.line}</td><td className="p-1">{formatDate(t.settled_date)}</td>
                        <td className="p-1">{a ? `${a.code} - ${a.name}` : ""}</td>
                        <td className="p-1 text-right">{formatBRL(t.type === "saida" ? -t.amount : t.amount)}</td><td className="p-1">{t.notes ?? ""}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            {ok.length > 50 && <div className="text-muted-foreground text-xs">… e mais {ok.length - 50}.</div>}
            {rejected.length > 0 && (
              <div>
                <div className="font-medium text-destructive">Linhas recusadas</div>
                <ul className="list-disc pl-4 text-xs text-muted-foreground">
                  {rejected.slice(0, 100).map((r) => <li key={r.line}>Linha {r.line}: {r.reason}</li>)}
                </ul>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={confirm} disabled={busy || ok.length === 0}>
              {busy ? "Importando..." : "Confirmar importação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
