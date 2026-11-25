import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { unzipSync, strFromU8 } from "fflate";
import * as XLSX from "xlsx";
import { CheckCircle2, Database, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useInvalidateContabil } from "@/os/contabil/hooks";
import { importUnionChunk, importUnionIdentities } from "@/os/contabil/union.functions";
import { UNION_BASES, UNION_LABELS, sanitizeUnionRow, unionBool, unionIdentitiesSchema, unionRecordId, type UnionBase, type UnionRow } from "@/os/contabil/union-import";

type Bases = Partial<Record<UnionBase, UnionRow[]>>;

export function ImportarBasesUnion() {
  const importChunk = useServerFn(importUnionChunk);
  const importPeople = useServerFn(importUnionIdentities);
  const invalidate = useInvalidateContabil();
  const [bases, setBases] = useState<Bases | null>(null);
  const [filename, setFilename] = useState("");
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ count: 0, base: "" });
  const [done, setDone] = useState(false);
  const [awaiting, setAwaiting] = useState(0);
  const total = Object.values(bases ?? {}).reduce((sum, rows) => sum + rows.length, 0);

  async function read(file: File) {
    setError(""); setDone(false); setBases(null); setFilename(file.name);
    try {
      if (file.size > 10_000_000) throw new Error("Arquivo maior que 10 MB.");
      let expanded = 0;
      const entries = unzipSync(new Uint8Array(await file.arrayBuffer()), { filter: (entry) => {
        expanded += entry.originalSize;
        if (expanded > 20_000_000) throw new Error("As bases descompactadas ultrapassam 20 MB.");
        if (entry.name.includes("..") || entry.name.startsWith("/")) throw new Error("O arquivo contém um caminho inválido.");
        return entry.name.endsWith(".csv");
      } });
      const result: Bases = {};
      for (const [path, bytes] of Object.entries(entries)) {
        const name = (path.split("/").pop() ?? "").replace(/\.csv$/i, "");
        const base = UNION_BASES.find((b) => b === name);
        if (!base) throw new Error(`Base não reconhecida: ${name}.`);
        if (result[base]) throw new Error(`A base ${name} aparece mais de uma vez.`);
        const workbook = XLSX.read(strFromU8(bytes), { type: "string", raw: true });
        const sheet = workbook.Sheets[workbook.SheetNames[0] ?? ""];
        if (!sheet) throw new Error(`Não foi possível ler ${name}.`);
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false }).map((row) => {
          const text = Object.fromEntries(Object.entries(row).map(([key, value]) => [key.trim(), String(value ?? "")]));
          return sanitizeUnionRow(base, text);
        });
        const ids = rows.map((r) => unionRecordId(base, r));
        if (new Set(ids).size !== ids.length) throw new Error(`Identificações repetidas em ${UNION_LABELS[base]}.`);
        result[base] = rows;
      }
      for (const required of ["setores", "profiles", "user_roles", "categorias_atividade", "empresas", "atividades", "atividade_ciencias"] as const) {
        if (!result[required]?.length) throw new Error(`Falta a base ${UNION_LABELS[required]}.`);
      }
      setBases(result); setProgress({ count: 0, base: "" });
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível ler o arquivo."); }
  }

  async function start() {
    if (!bases || running) return;
    setRunning(true); setError(""); setDone(false);
    let count = 0;
    try {
      const roleMap = new Map((bases.user_roles ?? []).map((r) => [r["user_id"], r["role"]]));
      const people = unionIdentitiesSchema.parse((bases.profiles ?? []).map((p) => ({ original_id: p["id"], nome: p["nome"], email: p["email"], setor_id: p["setor_id"] || null, papel: roleMap.get(p["id"]) ?? "analista", atribuicao_global: unionBool(p["atribuicao_global"]) })));
      for (const base of UNION_BASES) {
        const rows = bases[base] ?? [];
        if (base === "profiles") {
          setProgress({ count, base: "Pessoas e vínculos" });
          const result = await importPeople({ data: people });
          setAwaiting(result.awaitingVerification);
        }
        for (let offset = 0; offset < rows.length; offset += 100) {
          setProgress({ count, base: UNION_LABELS[base] });
          await importChunk({ data: { base, rows: rows.slice(offset, offset + 100) } });
          count += Math.min(100, rows.length - offset);
          setProgress({ count, base: UNION_LABELS[base] });
        }
      }
      setDone(true);
    } catch (e) {
      setError(`${e instanceof Error ? e.message : "A importação foi interrompida."} Os lotes concluídos foram preservados; tentar novamente não duplica registros.`);
    } finally { setRunning(false); await invalidate(); }
  }

  return (
    <section className="mb-8 border-b pb-6">
      <h2 className="mb-3 flex items-center gap-2 text-base font-semibold"><Database className="h-4 w-4" /> Bases da Union</h2>
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="outline" disabled={running}>
          <label className={running ? "pointer-events-none" : "cursor-pointer"}><Upload className="mr-1.5 h-4 w-4" /> Selecionar bases .zip<input type="file" accept=".zip" aria-label="Arquivo de bases da Union" className="sr-only" disabled={running} onChange={(e) => { const file = e.target.files?.[0]; if (file) void read(file); e.target.value = ""; }} /></label>
        </Button>
        <span className="text-sm text-muted-foreground">{filename}</span>
        {bases && !done && <Button onClick={() => void start()} disabled={running}>{running ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Database className="mr-1.5 h-4 w-4" />}{running ? "Importando…" : "Importar bases da Union"}</Button>}
      </div>
      {bases && <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 text-sm md:grid-cols-4">{UNION_BASES.filter((b) => bases[b]).map((b) => <div key={b} className="flex items-center justify-between gap-2 border-b py-1.5"><span className="text-muted-foreground">{UNION_LABELS[b]}</span><span className="tabular-nums">{bases[b]?.length.toLocaleString("pt-BR")}</span></div>)}</div>}
      {(running || progress.count > 0) && <p className="mt-3 text-sm tabular-nums text-muted-foreground" role="status">{progress.base} · {progress.count.toLocaleString("pt-BR")} / {total.toLocaleString("pt-BR")} registros</p>}
      {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
      {done && <div className="mt-4 space-y-2 text-sm"><p className="flex items-center gap-2 font-medium"><CheckCircle2 className="h-4 w-4" /> Bases importadas: {total.toLocaleString("pt-BR")} registros.</p>{awaiting > 0 && <p className="text-muted-foreground">{awaiting} pessoas precisam confirmar o e-mail e definir a nova senha em Entrar › Ativar conta Union.</p>}<Button asChild variant="outline" size="sm"><Link to="/contabil/bases" search={{ base: "nibo_obrigacoes", pagina: 1, busca: "" }}>Consultar bases importadas</Link></Button></div>}
    </section>
  );
}