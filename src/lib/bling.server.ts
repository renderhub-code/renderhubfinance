// Server-only helpers for the Bling API integration.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const BLING_OAUTH_BASE = "https://www.bling.com.br/Api/v3/oauth";
export const BLING_API_BASE = "https://api.bling.com.br/Api/v3";

function creds() {
  const clientId = process.env["BLING_CLIENT_ID"];
  const clientSecret = process.env["BLING_CLIENT_SECRET"];
  const redirectUri = process.env["BLING_REDIRECT_URI"];
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Credenciais do Bling ausentes. Configure BLING_CLIENT_ID, BLING_CLIENT_SECRET e BLING_REDIRECT_URI.",
    );
  }
  return { clientId, clientSecret, redirectUri };
}

function basicAuth(clientId: string, clientSecret: string) {
  return `Basic ${btoa(`${clientId}:${clientSecret}`)}`;
}

export function buildAuthorizeUrl(state: string) {
  const { clientId, redirectUri } = creds();
  const url = new URL(`${BLING_OAUTH_BASE}/authorize`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("state", state);
  url.searchParams.set("redirect_uri", redirectUri);
  return url.toString();
}

type TokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
};

async function requestToken(body: Record<string, string>): Promise<TokenResponse> {
  const { clientId, clientSecret } = creds();
  const res = await fetch(`${BLING_OAUTH_BASE}/token`, {
    method: "POST",
    headers: {
      Authorization: basicAuth(clientId, clientSecret),
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams(body).toString(),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error("[Bling] token error", res.status, text);
    throw new Error(`Falha ao obter token do Bling (${res.status}).`);
  }
  return JSON.parse(text) as TokenResponse;
}

/** A integração Bling pertence à empresa Use Noronha. */
async function getBlingCompanyId(): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("companies")
    .select("id")
    .eq("slug", "use-noronha")
    .maybeSingle();
  if (error || !data) throw new Error("Empresa Use Noronha não encontrada.");
  return data.id;
}

async function saveTokens(t: TokenResponse, userId?: string) {
  const companyId = await getBlingCompanyId();
  const expiresAt = new Date(Date.now() + (t.expires_in ?? 3600) * 1000).toISOString();
  const { data: existing } = await supabaseAdmin
    .from("bling_tokens")
    .select("id")
    .eq("company_id", companyId)
    .limit(1)
    .maybeSingle();

  const row = {
    company_id: companyId,
    access_token: t.access_token,
    refresh_token: t.refresh_token,
    expires_at: expiresAt,
    ...(userId ? { connected_by: userId } : {}),
  };

  if (existing?.id) {
    const { error } = await supabaseAdmin.from("bling_tokens").update(row).eq("id", existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabaseAdmin.from("bling_tokens").insert(row);
    if (error) throw new Error(error.message);
  }
  return expiresAt;
}

export async function exchangeCodeForTokens(code: string, userId: string) {
  const { redirectUri } = creds();
  const tokens = await requestToken({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });
  return saveTokens(tokens, userId);
}

export async function getConnection() {
  const companyId = await getBlingCompanyId();
  const { data } = await supabaseAdmin
    .from("bling_tokens")
    .select("id, expires_at, updated_at, access_token, refresh_token")
    .eq("company_id", companyId)
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

/** Returns a valid access token, refreshing it when close to expiring. */
export async function getAccessToken(): Promise<string> {
  const conn = await getConnection();
  if (!conn) throw new Error("Bling não conectado.");
  const expiresAt = new Date(conn.expires_at).getTime();
  if (expiresAt - Date.now() > 60_000) return conn.access_token;

  const tokens = await requestToken({
    grant_type: "refresh_token",
    refresh_token: conn.refresh_token,
  });
  await saveTokens(tokens);
  return tokens.access_token;
}

export async function blingFetch(path: string, params?: Record<string, string>) {
  const url = new URL(`${BLING_API_BASE}${path.startsWith("/") ? path : `/${path}`}`);
  for (const [k, v] of Object.entries(params ?? {})) {
    if (v !== "" && v != null) url.searchParams.set(k, v);
  }
  for (let attempt = 0; attempt < 4; attempt++) {
    const token = await getAccessToken();
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    if (res.status === 429 && attempt < 3) {
      // Limite de requisições do Bling: espera progressiva e tenta de novo.
      await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
      continue;
    }
    const text = await res.text();
    if (!res.ok) {
      console.error("[Bling] api error", path, res.status, text);
      throw new Error(`Erro na API do Bling (${res.status}).`);
    }
    return text ? JSON.parse(text) : null;
  }
  throw new Error("Erro na API do Bling (429).");
}

export async function saveState(state: string, userId: string) {
  await supabaseAdmin.from("bling_oauth_states").insert({ state, user_id: userId });
}

export async function consumeState(state: string, userId: string) {
  const { data } = await supabaseAdmin
    .from("bling_oauth_states")
    .select("state, user_id, created_at")
    .eq("state", state)
    .maybeSingle();
  if (!data || data.user_id !== userId) return false;
  await supabaseAdmin.from("bling_oauth_states").delete().eq("state", state);
  const age = Date.now() - new Date(data.created_at).getTime();
  return age < 15 * 60 * 1000;
}

export async function clearConnection() {
  const companyId = await getBlingCompanyId();
  await supabaseAdmin.from("bling_tokens").delete().eq("company_id", companyId);
}

// ---------- Importação Bling -> lançamentos ----------

const UN_ACCOUNTS = {
  entrada: "e8ea8445-d22b-4ded-9025-676776fa6b9d",
  saida: "82ebf305-173d-49d3-b4b4-bcae44fd39fc",
} as const;

type BlingConta = {
  id: number | string;
  situacao?: number;
  vencimento?: string;
  dataEmissao?: string;
  valor?: number;
  historico?: string;
  contato?: { nome?: string };
  categoria?: { id?: number | string; descricao?: string };
};

async function fetchAllContas(path: string, year: number): Promise<BlingConta[]> {
  const out: BlingConta[] = [];
  for (let pagina = 1; pagina <= 30; pagina++) {
    const json = await blingFetch(path, {
      pagina: String(pagina),
      limite: "100",
      dataVencimentoInicial: `${year}-01-01`,
      dataVencimentoFinal: `${year}-12-31`,
    });
    const rows: BlingConta[] = Array.isArray(json?.data) ? json.data : [];
    out.push(...rows);
    if (rows.length < 100) break;
  }
  return out;
}

function normalizeLabel(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** Categorias do Bling (id -> descrição), usadas para casar com o De/Para. */
async function fetchBlingCategorias(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    for (let pagina = 1; pagina <= 10; pagina++) {
      const json = await blingFetch("/categorias/receitas-despesas", {
        pagina: String(pagina),
        limite: "100",
      });
      const rows: { id?: number | string; descricao?: string }[] = Array.isArray(json?.data)
        ? json.data
        : [];
      for (const c of rows) {
        if (c.id != null && c.descricao) map.set(String(c.id), c.descricao);
      }
      if (rows.length < 100) break;
    }
  } catch (err) {
    console.error("[Bling] categorias", err);
  }
  return map;
}

/** De/Para da empresa: descrição da categoria -> conta do plano de contas. */
async function loadMappings(companyId: string) {
  const { data } = await supabaseAdmin
    .from("account_mappings")
    .select("source_code, account_id, accounts(type)")
    .eq("company_id", companyId)
    .not("account_id", "is", null);

  const byLabel = new Map<string, { id: string; type: string | null }>();
  for (const m of data ?? []) {
    const acc = m.accounts as { type?: string } | null;
    if (m.account_id) {
      byLabel.set(normalizeLabel(m.source_code), { id: m.account_id, type: acc?.type ?? null });
    }
  }
  return byLabel;
}

const resolveAccountFor = (
  mappings: Map<string, { id: string; type: string | null }>,
  categorias: Map<string, string>,
  r: BlingConta,
  type: "entrada" | "saida",
) => {
  const label =
    r.categoria?.descricao ??
    (r.categoria?.id != null ? categorias.get(String(r.categoria.id)) : undefined);
  if (label) {
    const hit = mappings.get(normalizeLabel(label));
    if (hit && (hit.type === null || hit.type === type)) return hit.id;
  }
  return UN_ACCOUNTS[type];
};

export async function importBlingYear(year: number, userId: string) {
  const companyId = await getBlingCompanyId();
  const [receber, pagar, categorias, mappings] = await Promise.all([
    fetchAllContas("/contas/receber", year),
    fetchAllContas("/contas/pagar", year),
    fetchBlingCategorias(),
    loadMappings(companyId),
  ]);

  const resolveAccount = (r: BlingConta, type: "entrada" | "saida") =>
    resolveAccountFor(mappings, categorias, r, type);

  const rows = [
    ...receber.map((r) => ({ r, type: "entrada" as const, prefix: "receber" })),
    ...pagar.map((r) => ({ r, type: "saida" as const, prefix: "pagar" })),
  ]
    .filter((x) => x.r.vencimento && String(x.r.vencimento).startsWith(String(year)))
    .map(({ r, type, prefix }) => {
      const settled = r.situacao === 2 || r.situacao === 3;
      const valor = Number(r.valor ?? 0);
      return {
        company_id: companyId,
        account_id: resolveAccount(r, type),

        entry_date: (r.dataEmissao && r.dataEmissao !== "0000-00-00" ? r.dataEmissao : r.vencimento) as string,
        due_date: r.vencimento as string,
        settled_date: settled ? (r.vencimento as string) : null,
        type,
        status: (settled ? "realizado" : "previsto") as "realizado" | "previsto",
        amount_expected: valor,
        amount_realized: settled ? valor : 0,
        description: r.historico || r.contato?.nome || (type === "entrada" ? "Conta a receber (Bling)" : "Conta a pagar (Bling)"),
        notes: r.contato?.nome ?? null,
        created_by: userId,
        external_source: `bling:${prefix}`,
        external_id: String(r.id),
      };
    });

  if (rows.length === 0) return { imported: 0, skipped: 0, total: 0 };

  const { data: existing } = await supabaseAdmin
    .from("transactions")
    .select("external_source, external_id")
    .eq("company_id", companyId)
    .not("external_id", "is", null);

  const seen = new Set((existing ?? []).map((e) => `${e.external_source}|${e.external_id}`));
  const fresh = rows.filter((r) => !seen.has(`${r.external_source}|${r.external_id}`));

  for (let i = 0; i < fresh.length; i += 200) {
    const { error } = await supabaseAdmin.from("transactions").insert(fresh.slice(i, i + 200));
    if (error) throw new Error(error.message);
  }

  return { imported: fresh.length, skipped: rows.length - fresh.length, total: rows.length };
}

const RECLASSIFY_BATCH = 100;

/** Contas que precisam ser reclassificadas: provisórias ou contas antigas desativadas. */
async function pendingAccountIds(companyId: string) {
  const { data } = await supabaseAdmin
    .from("accounts")
    .select("id, active")
    .eq("company_id", companyId);
  const ids = (data ?? []).filter((a) => !a.active).map((a) => a.id);
  return Array.from(new Set([...ids, UN_ACCOUNTS.entrada, UN_ACCOUNTS.saida]));
}

/** Reclassifica lançamentos importados do Bling que ainda não usam o plano de contas atual.
 *  A listagem do Bling não traz a categoria, então buscamos o detalhe de cada registro. */
export async function reclassifyBlingYear(_year: number) {
  const companyId = await getBlingCompanyId();
  const [categorias, mappings, pendingIds] = await Promise.all([
    fetchBlingCategorias(),
    loadMappings(companyId),
    pendingAccountIds(companyId),
  ]);

  const { data: stuck, error: stuckErr } = await supabaseAdmin
    .from("transactions")
    .select("id, external_source, external_id, type")
    .eq("company_id", companyId)
    .not("external_id", "is", null)
    .like("external_source", "bling:%")
    .in("account_id", pendingIds)
    .order("created_at", { ascending: true })
    .limit(RECLASSIFY_BATCH);
  if (stuckErr) throw new Error(stuckErr.message);

  let reclassified = 0;
  for (const tx of stuck ?? []) {
    const prefix = tx.external_source === "bling:receber" ? "receber" : "pagar";
    const type = tx.type === "entrada" ? "entrada" : "saida";
    try {
      const json = await blingFetch(`/contas/${prefix}/${tx.external_id}`);
      const d = json?.data as BlingConta | undefined;
      if (!d) continue;
      const accountId = resolveAccountFor(mappings, categorias, d, type);
      const { error } = await supabaseAdmin
        .from("transactions")
        .update({ account_id: accountId })
        .eq("id", tx.id);
      if (!error && accountId !== UN_ACCOUNTS[type]) reclassified++;
    } catch (err) {
      console.error("[Bling] reclassify item", tx.external_id, err);
    }
  }

  const { count } = await supabaseAdmin
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .like("external_source", "bling:%")
    .in("account_id", pendingIds);

  return { reclassified, pending: count ?? 0 };
}

