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
  const token = await getAccessToken();
  const url = new URL(`${BLING_API_BASE}${path.startsWith("/") ? path : `/${path}`}`);
  for (const [k, v] of Object.entries(params ?? {})) {
    if (v !== "" && v != null) url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  const text = await res.text();
  if (!res.ok) {
    console.error("[Bling] api error", path, res.status, text);
    throw new Error(`Erro na API do Bling (${res.status}).`);
  }
  return text ? JSON.parse(text) : null;
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
