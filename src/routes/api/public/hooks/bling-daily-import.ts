import { createFileRoute } from "@tanstack/react-router";

// Chamado diariamente pelo agendador do banco. Protegido por segredo só do servidor.
export const Route = createFileRoute("/api/public/hooks/bling-daily-import")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.BLING_CRON_SECRET;
        const token = request.headers.get("x-cron-secret");
        if (!secret || token !== secret) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
        }
        const { importBlingYear } = await import("@/lib/bling.server");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: tok } = await supabaseAdmin
          .from("bling_tokens")
          .select("connected_by")
          .not("connected_by", "is", null)
          .limit(1)
          .maybeSingle();
        const userId = tok?.connected_by ?? "2c404397-5e69-4621-944f-d17f046b9e03";
        try {
          const year = new Date().getUTCFullYear();
          const result = await importBlingYear(year, userId);
          console.log("[Bling cron] import ok", result);
          return Response.json({ ok: true, ...result });
        } catch (err) {
          console.error("[Bling cron] import failed", err);
          return Response.json({ ok: false, error: String(err) }, { status: 500 });
        }
      },
    },
  },
});
