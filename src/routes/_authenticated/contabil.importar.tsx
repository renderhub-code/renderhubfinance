import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/os/page";
import { ContabilGate, PrioridadePill } from "@/components/contabil/ui";
import { useCategorias, useClientes, useMembros, useSetores, useInvalidateContabil } from "@/os/contabil/hooks";
import { cdb, dataBR, norm, STATUS_LABEL, type Status } from "@/os/contabil/db";
import { cn } from "@/lib/utils";
import { ImportarBasesUnion } from "@/components/contabil/ImportarBasesUnion";
import { contabilHead } from "@/os/contabil/head";

export const Route = createFileRoute("/_authenticated/contabil/importar")({
  head: () => contabilHead("Importar planilha", "Importação de atividades e bases da Union Contadores para o render.os."),
  component: () => <ContabilGate adminOnly><Importar /></ContabilGate>,
});

const COLUNAS = ["Setor", "Tipo", "Empresa", "Atividade", "Responsável", "Prioridade", "Status", "Prazo", "Follow-up"];

const STATUS_MAP: Record<string, Status> = {
  "nao iniciado": "nao_iniciado",
  "em andamento": "em_andamento",
  concluido: "concluido",
  // "Atrasado" é calculado pelo prazo; na base fica "em andamento".
  atrasado: "em_andamento",
};

interface Linha {
  n: number;
  setor_id: string; setor: string;
  categoria_id: string | null; tipo: string;
  cliente_id: string | null; empresa: string;
  atividade: string;
  responsavel_id: string; responsavel: string;
  prioridade: number; status: Status; prazo: string | null; follow_up: string | null;
  erros: string[];
}

function celula(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) return `${String(v.getDate()).padStart(2, "0")}/${String(v.getMonth() + 1).padStart(2, "0")}/${v.getFullYear()}`;
  return String(v).trim();
}

function prazoISO(s: string): { iso: string | null; erro?: string } {
  if (!s) return { iso: null };
  const br = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  const iso = br
    ? `${br[3].length === 2 ? "20" + br[3] : br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`
    : /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
  if (!iso || Number.isNaN(new Date(iso).getTime())) return { iso: null, erro: `Prazo inválido: "${s}" (use dd/mm/aaaa)` };
  return { iso };
}

function pegar(row: Record<string, string>, chaves: string[]): string {
  for (const k of Object.keys(row)) if (chaves.includes(norm(k))) return row[k] ?? "";
  return "";
}

function Importar() {
  const navigate = useNavigate();
  const invalidate = useInvalidateContabil();
  const { data: setores = [] } = useSetores();
  const { data: categorias = [] } = useCategorias();
  const { data: clientes = [] } = useClientes();
  const { data: membros = [] } = useMembros();
  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  const [arquivo, setArquivo] = useState("");
  const [importando, setImportando] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const setorMap = useMemo(() => new Map(setores.map((s) => [norm(s.nome), s])), [setores]);
  const membroMap = useMemo(() => {
    const m = new Map<string, (typeof membros)[number]>();
    membros.filter((x) => x.ativo).forEach((x) => { m.set(norm(x.nome), x); if (x.email) m.set(norm(x.email), x); });
    return m;
  }, [membros]);
  const clienteMap = useMemo(() => {
    const m = new Map<string, (typeof clientes)[number]>();
    for (const c of clientes) {
      for (const k of [c.razao_social, c.nome_fantasia, c.apelido, c.codigo_dominio]) if (k) m.set(norm(k), c);
      if (c.cnpj) m.set(c.cnpj.replace(/\D/g, ""), c);
    }
    return m;
  }, [clientes]);

  function ler(file: File) {
    setArquivo(file.name);
    const reader = new FileReader();
    reader.onerror = () => toast.error("Não foi possível ler o arquivo.");
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(new Uint8Array(ev.target?.result as ArrayBuffer), { type: "array", cellDates: true });
        const sheet = wb.Sheets[wb.SheetNames[0] ?? ""];
        if (!sheet) { toast.error("Planilha vazia."); return; }
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: true });
        const out: Linha[] = [];
        json.forEach((r, i) => {
          const raw: Record<string, string> = {};
          for (const k of Object.keys(r)) raw[k.trim()] = celula(r[k]);
          if (!Object.values(raw).some(Boolean)) return;
          const erros: string[] = [];
          const setorTxt = pegar(raw, ["setor", "depto", "departamento"]);
          const tipoTxt = pegar(raw, ["tipo", "categoria", "tipo da atividade"]);
          const empresaTxt = pegar(raw, ["empresa", "cliente", "razao social", "cnpj"]);
          const atividade = pegar(raw, ["atividade", "descricao"]);
          const respTxt = pegar(raw, ["responsavel", "e-mail do responsavel", "email"]);
          const prioTxt = pegar(raw, ["prioridade"]);
          const statusTxt = pegar(raw, ["status"]);
          const prazoTxt = pegar(raw, ["prazo", "vencimento", "data"]);
          const follow = pegar(raw, ["follow-up", "follow up", "followup", "acompanhamento"]);

          const setor = setorTxt ? setorMap.get(norm(setorTxt)) : undefined;
          if (!setorTxt) erros.push("Setor em branco");
          else if (!setor) erros.push(`Setor não encontrado: "${setorTxt}"`);

          const tiposSetor = categorias.filter((c) => c.setor_id === setor?.id);
          const tipo = tipoTxt
            ? tiposSetor.find((c) => norm(c.nome) === norm(tipoTxt))
            : tiposSetor.find((c) => norm(c.nome) === "outros");
          if (setor && tipoTxt && !tipo) erros.push(`Tipo não encontrado em ${setor.nome}: "${tipoTxt}"`);

          const cliente = empresaTxt ? clienteMap.get(norm(empresaTxt)) ?? clienteMap.get(empresaTxt.replace(/\D/g, "")) : undefined;
          if (empresaTxt && !cliente) erros.push(`Empresa não encontrada: "${empresaTxt}"`);

          if (!atividade) erros.push("Atividade em branco");

          const resp = respTxt ? membroMap.get(norm(respTxt)) : undefined;
          if (!respTxt) erros.push("Responsável em branco");
          else if (!resp) erros.push(`Responsável não está na equipe: "${respTxt}"`);

          let prioridade = 3;
          if (prioTxt) {
            const p = Number(String(prioTxt).replace(/^p/i, ""));
            if (Number.isInteger(p) && p >= 1 && p <= 4) prioridade = p;
            else erros.push(`Prioridade inválida: "${prioTxt}" (use 1 a 4)`);
          }
          const status = STATUS_MAP[norm(statusTxt)] ?? "nao_iniciado";
          const prazo = prazoISO(prazoTxt);
          if (prazo.erro) erros.push(prazo.erro);

          out.push({
            n: i + 2,
            setor_id: setor?.id ?? "", setor: setor?.nome ?? setorTxt,
            categoria_id: tipo?.id ?? null, tipo: tipo?.nome ?? tipoTxt,
            cliente_id: cliente?.id ?? null, empresa: cliente?.razao_social ?? empresaTxt,
            atividade,
            responsavel_id: resp?.user_id ?? "", responsavel: resp?.nome ?? respTxt,
            prioridade, status, prazo: prazo.iso, follow_up: follow || null,
            erros,
          });
        });
        setLinhas(out);
      } catch (e) {
        toast.error(`Falha ao ler a planilha: ${(e as Error).message}`);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  const ok = linhas?.filter((l) => !l.erros.length) ?? [];
  const comErro = linhas?.filter((l) => l.erros.length) ?? [];

  async function importar() {
    if (!ok.length) return;
    setImportando(true);
    const lote = new Date(Date.now() - 2000).toISOString();
    for (let i = 0; i < ok.length; i += 200) {
      const chunk = ok.slice(i, i + 200).map((l) => ({
        setor_id: l.setor_id, categoria_id: l.categoria_id, cliente_id: l.cliente_id, atividade: l.atividade,
        responsavel_id: l.responsavel_id, prioridade: l.prioridade, status: l.status, prazo: l.prazo, follow_up: l.follow_up,
      }));
      const { error } = await cdb.from("contabil_atividades").insert(chunk);
      if (error) {
        setImportando(false);
        toast.error(`Parou na linha ${ok[i].n}: ${error.message}${i ? ` (${i} já importadas)` : ""}`);
        invalidate();
        return;
      }
    }
    setImportando(false);
    toast.success(`${ok.length} atividade(s) importada(s).`);
    invalidate();
    navigate({ to: "/contabil/atividades", search: { lote } });
  }

  function baixarModelo() {
    const ws = XLSX.utils.aoa_to_sheet([
      COLUNAS,
      [setores[1]?.nome ?? "Fiscal", "Outros", clientes[0]?.razao_social ?? "Empresa Exemplo LTDA", "Apuração de ICMS", membros[0]?.nome ?? "Nome da pessoa", 2, "Não iniciado", "20/12/2026", ""],
    ]);
    ws["!cols"] = COLUNAS.map((c) => ({ wch: c === "Atividade" || c === "Empresa" ? 36 : 16 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Atividades");
    XLSX.writeFile(wb, "modelo-atividades-render-os.xlsx");
  }

  return (
    <div className="mx-auto max-w-[1300px]">
      <PageHeader
        eyebrow="Contábil"
        title="Importar planilha"
        description="Suba um .xlsx com as atividades. Confira a prévia antes de importar."
        actions={<Button variant="outline" onClick={baixarModelo}><Download className="mr-1.5 h-4 w-4" /> Baixar modelo</Button>}
      />

      <ImportarBasesUnion />

      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) ler(f); }}
        className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed bg-muted/20 px-6 py-10 text-center transition-colors hover:border-primary/40 hover:bg-primary/5"
      >
        <FileSpreadsheet className="h-7 w-7 text-muted-foreground" strokeWidth={1.5} />
        <div className="text-sm font-medium">{arquivo || "Clique ou arraste a planilha aqui"}</div>
        <div className="text-xs text-muted-foreground">Colunas: {COLUNAS.join(" · ")}. Tipo e Empresa podem ficar em branco.</div>
      </button>
      <input ref={input} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) ler(f); e.target.value = ""; }} />

      {linhas && (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" /> {ok.length} prontas</span>
            {comErro.length > 0 && <span className="inline-flex items-center gap-1.5 rounded-md bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700"><AlertCircle className="h-3.5 w-3.5" /> {comErro.length} com erro (serão ignoradas)</span>}
            <Button className="ml-auto" onClick={importar} disabled={!ok.length || importando}>
              <Upload className="mr-1.5 h-4 w-4" /> {importando ? "Importando…" : `Importar ${ok.length} atividade(s)`}
            </Button>
          </div>

          <div className="mt-3 overflow-hidden rounded-xl border">
            <div className="max-h-[60vh] overflow-auto">
              <table className="w-full min-w-[1100px] text-sm">
                <thead className="sticky top-0 border-b bg-muted/60 text-left text-xs text-muted-foreground backdrop-blur">
                  <tr>{["Linha", "Setor · Tipo", "Empresa", "Atividade", "Responsável", "Prior.", "Status", "Prazo", "Situação"].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y">
                  {[...comErro, ...ok].map((l) => (
                    <tr key={l.n} className={cn(l.erros.length && "bg-red-50/50")}>
                      <td className="px-3 py-2 text-xs tabular-nums text-muted-foreground">{l.n}</td>
                      <td className="px-3 py-2 text-[13px]">{l.setor}<div className="text-xs text-muted-foreground">{l.tipo || "—"}</div></td>
                      <td className="max-w-[200px] px-3 py-2 text-[13px]"><span className="line-clamp-2">{l.empresa || <span className="text-muted-foreground">Avulsa</span>}</span></td>
                      <td className="max-w-[280px] px-3 py-2 text-[13px]"><span className="line-clamp-2">{l.atividade}</span></td>
                      <td className="px-3 py-2 text-[13px]">{l.responsavel}</td>
                      <td className="px-3 py-2"><PrioridadePill p={l.prioridade} /></td>
                      <td className="px-3 py-2 text-[13px]">{STATUS_LABEL[l.status]}</td>
                      <td className="px-3 py-2 text-[13px] tabular-nums">{dataBR(l.prazo) ?? "—"}</td>
                      <td className="px-3 py-2 text-xs">
                        {l.erros.length
                          ? <ul className="space-y-0.5 text-red-700">{l.erros.map((e) => <li key={e}>{e}</li>)}</ul>
                          : <span className="text-emerald-700">OK</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
