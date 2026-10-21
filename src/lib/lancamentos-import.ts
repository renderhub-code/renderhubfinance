import { parseBRLInput } from "./format";

export interface ImportAccount {
  id: string;
  code: string;
  name: string;
  type: "entrada" | "saida";
}

export interface ImportMapping {
  source_code: string;
  source_name: string | null;
  account_id: string | null;
}

export interface ParsedTransaction {
  line: number;
  account_id: string;
  type: "entrada" | "saida";
  entry_date: string;
  settled_date: string;
  amount: number;
  document_number: string | null;
  notes: string | null;
  description: string | null;
  bank: string | null;
  bank_account: string | null;
}

export interface RejectedRow {
  line: number;
  reason: string;
}

export function normKey(v: unknown): string {
  return String(v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[º°]/g, "o")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const FIELD_ALIASES: Record<string, string[]> = {
  docDate: ["data do documento", "data documento", "data doc"],
  docNumber: ["no do documento", "n do documento", "numero do documento", "n documento", "no documento", "documento"],
  payDate: ["data do pagamento", "data pagamento", "data pgto"],
  amount: ["valor pago", "valor"],
  history: ["historico"],
  description: ["descricao"],
  category: ["categoria"],
  account: ["conta financeira"],
  bank: ["banco"],
  bankAccount: ["conta", "conta bancaria"],
};

export function mapHeader(header: unknown[]): Record<string, number> {
  const keys = header.map(normKey);
  const out: Record<string, number> = {};
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    const i = keys.findIndex((k) => aliases.includes(k));
    if (i >= 0) out[field] = i;
  }
  return out;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function parseDate(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date && !isNaN(v.getTime())) {
    return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`;
  }
  if (typeof v === "number" && isFinite(v)) {
    const d = new Date(Math.round((v - 25569) * 86400000));
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) {
    const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    const mo = Number(m[2]), d = Number(m[1]);
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    return `${y}-${pad(mo)}-${pad(d)}`;
  }
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) {
    const mo = Number(m[2]), d = Number(m[3]);
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    return `${m[1]}-${pad(mo)}-${pad(d)}`;
  }
  return null;
}

export function parseAmount(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return isFinite(v) ? v : 0;
  const s = String(v).trim();
  // "1250.50" (sem vírgula, um ponto decimal) é tratado como decimal
  if (/^-?\d+\.\d{1,2}$/.test(s)) return Number(s);
  return parseBRLInput(s);
}

function text(v: unknown): string | null {
  const s = String(v ?? "").trim();
  return s ? s : null;
}

export function buildAccountResolver(accounts: ImportAccount[], mappings: ImportMapping[]) {
  const byCode = new Map(accounts.map((a) => [a.code.trim(), a]));
  const byName = new Map(accounts.map((a) => [normKey(a.name), a]));
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const mapCode = new Map<string, ImportAccount>();
  const mapName = new Map<string, ImportAccount>();
  for (const m of mappings) {
    const acc = m.account_id ? byId.get(m.account_id) : undefined;
    if (!acc) continue;
    mapCode.set(m.source_code.trim(), acc);
    if (m.source_name) mapName.set(normKey(m.source_name), acc);
  }
  return (raw: string): ImportAccount | undefined => {
    const s = raw.trim();
    const codePart = s.split(/\s+-\s+|\s+/)[0];
    return (
      byCode.get(s) ?? byCode.get(codePart) ?? byName.get(normKey(s)) ??
      byName.get(normKey(s.replace(/^[\d.]+\s*-?\s*/, ""))) ??
      mapCode.get(s) ?? mapName.get(normKey(s))
    );
  };
}

export function parseRows(
  rows: unknown[][],
  accounts: ImportAccount[],
  mappings: ImportMapping[],
): { ok: ParsedTransaction[]; rejected: RejectedRow[]; headerError?: string } {
  const headerIdx = rows.findIndex((r) => {
    const h = mapHeader(r);
    return h.payDate !== undefined && h.account !== undefined;
  });
  if (headerIdx < 0) {
    return { ok: [], rejected: [], headerError: "Cabeçalho não encontrado: a planilha precisa ter as colunas 'Data do Pagamento' e 'Conta Financeira'." };
  }
  const h = mapHeader(rows[headerIdx]);
  const resolve = buildAccountResolver(accounts, mappings);
  const ok: ParsedTransaction[] = [];
  const rejected: RejectedRow[] = [];
  const get = (r: unknown[], f: string) => (h[f] === undefined ? undefined : r[h[f]]);

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i] ?? [];
    if (r.every((c) => String(c ?? "").trim() === "")) continue;
    const line = i + 1;
    const payDate = parseDate(get(r, "payDate"));
    if (!payDate) {
      rejected.push({ line, reason: String(get(r, "payDate") ?? "").trim() ? "Data do Pagamento inválida" : "Data do Pagamento vazia" });
      continue;
    }
    const accRaw = text(get(r, "account"));
    if (!accRaw) { rejected.push({ line, reason: "Conta Financeira vazia" }); continue; }
    const acc = resolve(accRaw);
    if (!acc) { rejected.push({ line, reason: `Conta Financeira "${accRaw}" não encontrada` }); continue; }
    ok.push({
      line,
      account_id: acc.id,
      type: acc.type,
      entry_date: parseDate(get(r, "docDate")) ?? payDate,
      settled_date: payDate,
      amount: (acc.type === "saida" ? -1 : 1) * parseAmount(get(r, "amount")) || 0,
      document_number: text(get(r, "docNumber")),
      notes: text(get(r, "history")),
      description: text(get(r, "description")),
      bank: text(get(r, "bank")),
      bank_account: text(get(r, "bankAccount")),
    });
  }
  return { ok, rejected };
}
