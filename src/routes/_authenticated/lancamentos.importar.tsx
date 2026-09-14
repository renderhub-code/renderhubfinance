import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useCompanyStore } from "@/lib/company-store";
import { useAccounts, useBusinessUnits } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, Upload } from "lucide-react";
import { parseBRLInput } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/lancamentos/importar")({
  head: () => ({ meta: [{ title: "Importar Lançamentos — Union Financeiro" }] }),
  component: Importar,
});

const SAMPLE = `data;codigo_categoria;descricao;valor;status
2026-01-05;3.1.01.001;Venda balcão;1250,00;realizado
2026-01-10;5.2.01.002;Conta de luz;-380,50;previsto`;

function Importar() {
  const companyId = useCompanyStore((s) => s.activeCompanyId);
  const { data: accounts = [] } = useAccounts(companyId);
  const { data: units = [] } = useBusinessUnits(companyId);
  const [csv, setCsv] = useState("");
  const [buId, setBuId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<{ ok: number; errors: string[] } | null>(null);

  async function importCsv() {
    if (!companyId) return;
    setBusy(true); setReport(null);
    const lines = csv.trim().split(/\r?\n/);
    if (lines.length < 2) { toast.error("CSV vazio"); setBusy(false); return; }
    const header = lines[0].split(";").map((h) => h.trim().toLowerCase());
    const idx = (k: string) => header.indexOf(k);
    const iDate = idx("data"), iCode = idx("codigo_categoria") >= 0 ? idx("codigo_categoria") : idx("codigo_conta"), iDesc = idx("descricao"),
          iVal = idx("valor"), iStatus = idx("status");
    if (iDate < 0 || iCode < 0 || iVal < 0) { toast.error("Cabeçalho inválido: use data;codigo_categoria;descricao;valor;status"); setBusy(false); return; }

    const acctByCode = new Map(accounts.map((a) => [a.code, a]));
    const rows: any[] = [];
    const errors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(";");
      if (cols.length < 3) continue;
      const date = cols[iDate]?.trim();
      const code = cols[iCode]?.trim();
      const acc = acctByCode.get(code);
      if (!acc) { errors.push(`Linha ${i + 1}: categoria ${code} não encontrada`); continue; }
      const raw = parseBRLInput(cols[iVal] ?? "0");
      const value = Math.abs(raw);
      const status = (iStatus >= 0 ? cols[iStatus]?.trim() : "previsto") || "previsto";
      const isRealized = status === "realizado";
      rows.push({
        company_id: companyId,
        business_unit_id: buId || null,
        account_id: acc.id,
        entry_date: date,
        due_date: date,
        settled_date: isRealized ? date : null,
        type: acc.type,
        status,
        amount_expected: value,
        amount_realized: isRealized ? value : 0,
        description: iDesc >= 0 ? cols[iDesc]?.trim() : null,
      });
    }

    if (rows.length === 0) {
      setReport({ ok: 0, errors });
      setBusy(false);
      return;
    }

    const { error } = await supabase.from("transactions").insert(rows);
    if (error) errors.push(error.message);
    setReport({ ok: error ? 0 : rows.length, errors });
    setBusy(false);
    if (!error) toast.success(`${rows.length} lançamento(s) importado(s)`);
  }

  if (!companyId) return <div className="text-muted-foreground">Selecione uma empresa específica no cabeçalho para importar lançamentos.</div>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-2">
        <Link to="/lancamentos"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Button></Link>
      </div>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Importar Lançamentos</h1>
        <p className="text-sm text-muted-foreground">Cole o CSV separado por ponto-e-vírgula com o cabeçalho: <code>data;codigo_categoria;descricao;valor;status</code>.</p>
      </div>
      <Card>
        <CardHeader><CardTitle>Amostra</CardTitle></CardHeader>
        <CardContent>
          <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto">{SAMPLE}</pre>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => setCsv(SAMPLE)}>Usar amostra</Button>
        </CardContent>
      </Card>
      <div className="space-y-2">
        {units.length > 1 && (
          <div>
            <Label>Unidade de negócio (opcional)</Label>
            <select className="mt-1 w-full h-10 rounded-md border bg-background px-3 text-sm" value={buId} onChange={(e) => setBuId(e.target.value)}>
              <option value="">— nenhuma —</option>
              {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
        )}
        <Label>Conteúdo CSV</Label>
        <Textarea value={csv} onChange={(e) => setCsv(e.target.value)} rows={12} className="font-mono text-xs" placeholder="Cole aqui..." />
      </div>
      <Button onClick={importCsv} disabled={busy || !csv.trim()}>
        <Upload className="h-4 w-4 mr-2" /> {busy ? "Importando..." : "Importar"}
      </Button>
      {report && (
        <Card>
          <CardContent className="pt-6 space-y-2">
            <div className="text-sm">Importados com sucesso: <strong>{report.ok}</strong></div>
            {report.errors.length > 0 && (
              <>
                <div className="text-sm text-destructive font-medium">Erros ({report.errors.length}):</div>
                <ul className="text-xs list-disc pl-4 text-muted-foreground space-y-0.5">
                  {report.errors.slice(0, 20).map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
