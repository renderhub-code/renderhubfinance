import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { parseBRLInput } from "@/lib/format";
import type { Account, Transaction } from "@/lib/queries";

export function EditarLancamento({ tx, accounts }: { tx: Transaction; accounts: Account[] }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const signed = () => {
    const v = Number(tx.amount_realized || tx.amount_expected || 0);
    return String(tx.type === "saida" ? -v : v).replace(".", ",");
  };
  const [f, setF] = useState(() => init());
  function init() {
    return {
      entry_date: tx.entry_date ?? "", document_number: tx.document_number ?? "",
      settled_date: tx.settled_date ?? "", valor: signed(), notes: tx.notes ?? "",
      description: tx.description ?? "", account_id: tx.account_id, bank: tx.bank ?? "",
      bank_account: tx.bank_account ?? "",
    };
  }
  const set = (k: keyof ReturnType<typeof init>) => (e: { target: { value: string } }) =>
    setF((s) => ({ ...s, [k]: e.target.value }));

  async function save() {
    const acc = accounts.find((a) => a.id === f.account_id);
    if (!acc) {
      toast.error("Selecione a Conta Financeira.");
      return;
    }
    if (!f.settled_date) {
      toast.error("Informe a Data do Pagamento.");
      return;
    }
    const v = parseBRLInput(f.valor);
    // Stored amount is relative to account nature: preserves deductions' sign.
    const amount = acc.type === "saida" ? -v : v;
    setSaving(true);
    const { error } = await supabase.from("transactions").update({
      entry_date: f.entry_date || f.settled_date, document_number: f.document_number || null,
      settled_date: f.settled_date, amount_realized: amount, amount_expected: amount,
      notes: f.notes || null, description: f.description || null, account_id: acc.id,
      type: acc.type, status: "realizado", bank: f.bank || null, bank_account: f.bank_account || null,
    } as never).eq("id", tx.id);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
      return;
    }
    toast.success("Lançamento atualizado.");
    qc.invalidateQueries({ queryKey: ["transactions"] });
    setOpen(false);
  }

  const field = (label: string, k: keyof ReturnType<typeof init>, type = "text") => (
    <div className="space-y-1"><Label>{label}</Label><Input type={type} value={f[k]} onChange={set(k)} /></div>
  );

  return (
    <>
      <Button variant="ghost" size="icon" aria-label="Editar lançamento" onClick={() => { setF(init()); setOpen(true); }}>
        <Pencil className="h-4 w-4" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Editar lançamento</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            {field("Data do Documento", "entry_date", "date")}
            {field("Nº do Documento", "document_number")}
            {field("Data do Pagamento", "settled_date", "date")}
            {field("Valor Pago", "valor")}
            {field("Histórico", "notes")}
            {field("Descrição", "description")}
            <div className="space-y-1 col-span-2">
              <Label>Conta Financeira</Label>
              <Select value={f.account_id} onValueChange={(v) => setF((s) => ({ ...s, account_id: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.code} - {a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {field("Banco", "bank")}
            {field("Conta", "bank_account")}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
