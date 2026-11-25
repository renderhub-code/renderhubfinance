import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader } from "@/components/os/page";
import { ContabilGate } from "@/components/contabil/ui";
import { contabilHead } from "@/os/contabil/head";
import { UNION_BASES, UNION_LABELS, type UnionBase } from "@/os/contabil/union-import";
import type { Json } from "@/integrations/supabase/types";

const searchSchema = z.object({ base: z.enum(UNION_BASES).catch("nibo_obrigacoes"), pagina: z.coerce.number().int().min(1).catch(1), busca: z.string().max(200).catch("") });
type Filters = z.infer<typeof searchSchema>;
const summaryOptions = queryOptions({ queryKey: ["contabil", "bases", "resumo"], queryFn: async () => {
  const { data, error } = await supabase.rpc("contabil_resumo_bases_union");
  if (error) throw error;
  return data;
} });
function recordsOptions(filters: Filters) {
  return queryOptions({ queryKey: ["contabil", "bases", filters], queryFn: async () => {
    let q = supabase.from("contabil_bases_union").select("registro_id,dados,importado_em", { count: "exact" }).eq("base", filters.base).order("registro_id");
    if (filters.busca) q = q.ilike("busca", `%${filters.busca.replace(/[\\%_]/g, "\\$&")}%`);
    const { data, error, count } = await q.range((filters.pagina - 1) * 50, filters.pagina * 50 - 1);
    if (error) throw error;
    return { rows: data, count: count ?? 0 };
  } });
}

export const Route = createFileRoute("/_authenticated/contabil/bases")({
  head: () => contabilHead("Bases da Union", "Contratos, obrigações, controles e históricos da Union Contadores no render.os."),
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => search,
  loader: async ({ context, deps }) => { await Promise.all([context.queryClient.ensureQueryData(recordsOptions(deps)), context.queryClient.ensureQueryData(summaryOptions)]); },
  component: () => <ContabilGate adminOnly><BasesPage /></ContabilGate>,
});

const COLUMNS: Partial<Record<UnionBase, string[]>> = {
  nibo_obrigacoes: ["cliente", "obrigacao", "referencia", "status", "vencimento", "responsavel"],
  contratos: ["cliente", "tipo", "valor_atual", "inicio_contrato", "inicio_faturamento", "encerrado_em"],
  controle_lancamentos: ["empresa", "responsavel_nome", "ultimo_mes_ok", "regime", "concluido", "observacao"],
  controle_snapshots: ["empresa", "referencia", "responsavel_nome", "criado_em"],
  ponto_dias: ["colaborador_id", "data", "situacao", "trabalhadas_min", "previstas_min", "saldo_min"],
  ponto_meses: ["colaborador_id", "referencia", "trabalhadas_min", "saldo_min", "saldo_acumulado_min", "fechado"],
  ponto_jornadas: ["colaborador_id", "dia_semana", "periodos", "previstas_min"],
  ponto_colaboradores: ["colaborador_id", "codigo", "cargo", "admissao"],
  empresas: ["razao_social", "cnpj", "codigo_dominio", "regime", "resp_fiscal", "resp_contabil"],
  atividades: ["atividade", "status", "prioridade", "prazo", "responsavel_id"],
  profiles: ["nome", "email", "setor_id", "atribuicao_global"],
  setores: ["nome", "criado_em"], categorias_atividade: ["nome", "ordem", "ativo"],
};
const LABELS: Record<string, string> = { colaborador_id: "Colaborador", responsavel_id: "Responsável", setor_id: "Setor", trabalhadas_min: "Trabalhadas (min)", previstas_min: "Previstas (min)", saldo_min: "Saldo (min)", saldo_acumulado_min: "Acumulado (min)", valor_atual: "Valor atual", codigo_dominio: "Cód. Domínio", resp_fiscal: "Resp. Fiscal", resp_contabil: "Resp. Contábil" };
const label = (key: string) => LABELS[key] ?? key.replace(/_/g, " ").replace(/^./, (s) => s.toUpperCase());
function asObject(value: Json): Record<string, Json | undefined> { return value && typeof value === "object" && !Array.isArray(value) ? value : {}; }
function display(value: Json | undefined, key: string, names: Map<string, string>): string {
  if (value == null || value === "") return "—";
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  if (key.endsWith("_id")) return names.get(text) ?? text;
  if (text === "t") return "Sim";
  if (text === "f") return "Não";
  if (key.startsWith("valor_") && Number.isFinite(Number(text))) return Number(text).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return `${text.slice(8, 10)}/${text.slice(5, 7)}/${text.slice(0, 4)}`;
  return text;
}

const namesOptions = queryOptions({ queryKey: ["contabil", "bases", "nomes"], queryFn: async () => {
  const { data, error } = await supabase.from("contabil_bases_union").select("registro_id,dados").in("base", ["profiles", "setores"]);
  if (error) throw error;
  return new Map((data ?? []).map((r) => [r.registro_id, String(asObject(r.dados)["nome"] ?? r.registro_id)]));
} });

function BasesPage() {
  const filters = Route.useSearch();
  const navigate = Route.useNavigate();
  const { data: result } = useSuspenseQuery(recordsOptions(filters));
  const { data: summary } = useSuspenseQuery(summaryOptions);
  const { data: names } = useSuspenseQuery(namesOptions);
  const [search, setSearch] = useState(filters.busca);
  const [detail, setDetail] = useState<Record<string, Json | undefined> | null>(null);
  const columns = COLUMNS[filters.base] ?? Object.keys(asObject(result.rows?.[0]?.dados ?? {})).filter((k) => k !== "id").slice(0, 6);
  const total = summary.reduce((sum, row) => sum + Number(row.quantidade), 0);
  const change = (patch: Partial<Filters>) => void navigate({ search: { ...filters, ...patch } });
  return <div className="mx-auto max-w-[1400px]">
    <PageHeader eyebrow="Contábil · Union Contadores" title="Bases da Union" description={`${total.toLocaleString("pt-BR")} registros · ${summary.length} bases importadas`} />
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <Select value={filters.base} onValueChange={(v) => { const base = UNION_BASES.find((b) => b === v); if (base) change({ base, pagina: 1 }); }}><SelectTrigger className="w-full sm:w-64" aria-label="Base da Union"><SelectValue /></SelectTrigger><SelectContent>{UNION_BASES.map((b) => <SelectItem key={b} value={b}>{UNION_LABELS[b]} · {summary.find((s) => s.base === b)?.quantidade ?? 0}</SelectItem>)}</SelectContent></Select>
      <form className="flex w-full gap-2 sm:w-auto" onSubmit={(e) => { e.preventDefault(); change({ busca: search, pagina: 1 }); }}><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Pesquisar nesta base…" aria-label="Pesquisar nesta base" /><Button type="submit" variant="outline" size="icon" aria-label="Pesquisar"><Search className="h-4 w-4" /></Button></form>
      <span className="text-sm tabular-nums text-muted-foreground sm:ml-auto">{result.count.toLocaleString("pt-BR")} registros</span>
    </div>
    <div className="overflow-x-auto border"><table className="w-full min-w-[850px] text-sm"><thead className="bg-muted text-left"><tr>{columns.map((key) => <th key={key} className="px-3 py-3 font-medium">{label(key)}</th>)}<th className="px-3 py-3" /></tr></thead><tbody className="divide-y">{result.rows?.map((r) => { const values = asObject(r.dados); return <tr key={r.registro_id} className="hover:bg-muted/30">{columns.map((key) => <td key={key} className="max-w-72 px-3 py-3"><span className="line-clamp-2">{display(values[key], key, names)}</span></td>)}<td className="px-3 py-3"><Button variant="ghost" size="sm" onClick={() => setDetail(values)}>Detalhes</Button></td></tr>; })}{!result.count && <tr><td colSpan={columns.length + 1} className="py-12 text-center text-muted-foreground">Nenhum registro encontrado.</td></tr>}</tbody></table></div>
    <div className="mt-4 flex items-center justify-between gap-3"><span className="text-sm tabular-nums text-muted-foreground">Página {filters.pagina} de {Math.max(1, Math.ceil(result.count / 50))}</span><div className="flex gap-2"><Button variant="outline" size="icon" aria-label="Página anterior" disabled={filters.pagina <= 1} onClick={() => change({ pagina: filters.pagina - 1 })}><ChevronLeft className="h-4 w-4" /></Button><Button variant="outline" size="icon" aria-label="Próxima página" disabled={filters.pagina * 50 >= result.count} onClick={() => change({ pagina: filters.pagina + 1 })}><ChevronRight className="h-4 w-4" /></Button></div></div>
    <Dialog open={Boolean(detail)} onOpenChange={(open) => { if (!open) setDetail(null); }}><DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle>{UNION_LABELS[filters.base]} · Detalhes</DialogTitle></DialogHeader><dl className="divide-y">{Object.entries(detail ?? {}).map(([key, value]) => <div key={key} className="grid gap-1 py-2 sm:grid-cols-[180px_1fr]"><dt className="text-sm text-muted-foreground">{label(key)}</dt><dd className="whitespace-pre-wrap break-words text-sm">{display(value, key, names)}</dd></div>)}</dl></DialogContent></Dialog>
  </div>;
}