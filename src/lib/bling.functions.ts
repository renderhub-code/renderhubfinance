import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Gera a URL de autorização do Bling com um state aleatório salvo no banco. */
export const startBlingAuth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { buildAuthorizeUrl, saveState } = await import("./bling.server");
    const state = crypto.randomUUID();
    await saveState(state, context.userId);
    return { url: buildAuthorizeUrl(state) };
  });

/** Troca o code por access/refresh token e salva no banco. */
export const completeBlingAuth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string; state: string }) => {
    if (!input?.code || !input?.state) throw new Error("Parâmetros inválidos.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { consumeState, exchangeCodeForTokens } = await import("./bling.server");
    const ok = await consumeState(data.state, context.userId);
    if (!ok) throw new Error("State inválido ou expirado. Refaça a conexão.");
    const expiresAt = await exchangeCodeForTokens(data.code, context.userId);
    return { connected: true, expiresAt };
  });

export const getBlingStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { getConnection } = await import("./bling.server");
    const conn = await getConnection();
    if (!conn) return { connected: false as const };
    return {
      connected: true as const,
      expiresAt: conn.expires_at,
      updatedAt: conn.updated_at,
    };
  });

export const disconnectBling = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { clearConnection } = await import("./bling.server");
    await clearConnection();
    return { connected: false };
  });

const RESOURCES = {
  "contas-pagar": "/contas/pagar",
  "contas-receber": "/contas/receber",
  "notas-fiscais": "/nfe",
  "pedidos-venda": "/pedidos/vendas",
  "categorias": "/categorias/receitas-despesas",
  "contas-contabeis": "/contas-contabeis",
} as const;

export type BlingResource = keyof typeof RESOURCES;

/** Proxy de leitura da API do Bling. */
export const blingApiProxy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { resource: BlingResource; params?: Record<string, string> }) => {
    if (!input || !(input.resource in RESOURCES)) throw new Error("Recurso inválido.");
    return input;
  })
  .handler(async ({ data }) => {
    const { blingFetch } = await import("./bling.server");
    const json = await blingFetch(RESOURCES[data.resource], data.params ?? {});
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows: any[] = Array.isArray(json?.data) ? json.data : [];
    return { rows };
  });

/** Importa contas a pagar/receber do Bling como lançamentos da Use Noronha. */
export const importBlingTransactions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { year: number }) => {
    const y = Number(input?.year);
    if (!Number.isInteger(y) || y < 2000 || y > 2100) throw new Error("Ano inválido.");
    return { year: y };
  })
  .handler(async ({ data, context }) => {
    const { importBlingYear } = await import("./bling.server");
    return importBlingYear(data.year, context.userId);
  });
