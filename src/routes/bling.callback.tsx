import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { completeBlingAuth } from "@/lib/bling.functions";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/bling/callback")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Conectando ao Bling — RenderHub Finance" },
      { name: "description", content: "Finalizando a conexão da sua conta Bling com o RenderHub Finance." },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    code: typeof s['code'] === "string" ? s['code'] : "",
    state: typeof s['state'] === "string" ? s['state'] : "",
  }),
  component: BlingCallback,
});

function BlingCallback() {
  const { code, state } = Route.useSearch();
  const navigate = useNavigate();
  const complete = useServerFn(completeBlingAuth);
  const ran = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    if (!code || !state) {
      setError("Código de autorização ausente.");
      return;
    }
    complete({ data: { code, state } })
      .then(() => navigate({ to: "/financeiro", replace: true }))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Falha ao conectar."));
  }, [code, state, complete, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardContent className="py-10 text-center space-y-4">
          <h1 className="text-lg font-semibold">Conexão com o Bling</h1>
          {error ? (
            <>
              <p className="text-sm text-destructive">{error}</p>
              <Button onClick={() => navigate({ to: "/financeiro" })}>Voltar</Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Finalizando autorização...
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
