import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  blingApiProxy,
  disconnectBling,
  getBlingStatus,
  importBlingTransactions,
  startBlingAuth,
  type BlingResource,
} from "@/lib/bling.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Loader2, PlugZap, RefreshCw, Unplug } from "lucide-react";
import { toast } from "sonner";


export const Route = createFileRoute("/_authenticated/financeiro")({
  head: () => ({
    meta: [
      { title: "Financeiro Bling — RenderHub Finance" },
      { name: "description", content: "Contas a pagar, contas a receber, notas fiscais e pedidos sincronizados do Bling." },
      { property: "og:title", content: "Financeiro Bling — RenderHub Finance" },
      { property: "og:description", content: "Acompanhe contas a pagar e a receber direto da sua conta Bling." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FinanceiroPage,
});

const TABS: { id: BlingResource; label: string }[] = [
  { id: "contas-receber", label: "Contas a Receber" },
  { id: "contas-pagar", label: "Contas a Pagar" },
  { id: "notas-fiscais", label: "Notas Fiscais" },
  { id: "pedidos-venda", label: "Pedidos de Venda" },
];

function fmt(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function ResourceTable({ resource }: { resource: BlingResource }) {
  const proxy = useServerFn(blingApiProxy);
  const q = useQuery({
    queryKey: ["bling", resource],
    queryFn: () => proxy({ data: { resource } }),
  });

  if (q.isLoading) {
    return (
      <div className="py-10 text-center text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Carregando do Bling...
      </div>
    );
  }
  if (q.error) {
    return <p className="py-6 text-sm text-destructive">{(q.error as Error).message}</p>;
  }
  const rows = q.data?.rows ?? [];
  if (rows.length === 0) return <p className="py-6 text-sm text-muted-foreground">Nenhum registro retornado.</p>;

  const cols = Object.keys(rows[0]).slice(0, 7);
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {cols.map((c) => (
              <TableHead key={c}>{c}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={i}>
              {cols.map((c) => (
                <TableCell key={c} className="max-w-[240px] truncate">
                  {fmt((r as Record<string, unknown>)[c])}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function FinanceiroPage() {
  const qc = useQueryClient();
  const status = useServerFn(getBlingStatus);
  const start = useServerFn(startBlingAuth);
  const disconnect = useServerFn(disconnectBling);
  const importFn = useServerFn(importBlingTransactions);
  const year = new Date().getFullYear();

  const [tab, setTab] = useState<BlingResource>("contas-receber");

  const statusQuery = useQuery({ queryKey: ["bling-status"], queryFn: () => status({}) });

  const connectMutation = useMutation({
    mutationFn: () => start({}),
    onSuccess: (r) => {
      window.location.href = r.url;
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const disconnectMutation = useMutation({
    mutationFn: () => disconnect({}),
    onSuccess: () => {
      toast.success("Bling desconectado.");
      qc.invalidateQueries({ queryKey: ["bling-status"] });
      qc.invalidateQueries({ queryKey: ["bling"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const importMutation = useMutation({
    mutationFn: () => importFn({ data: { year } }),
    onSuccess: (r) => {
      toast.success(
        `Importação concluída: ${r.imported} novo(s) lançamento(s), ${r.skipped} já existente(s).`,
      );
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const connected = statusQuery.data?.connected === true;


  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Financeiro (Bling) — Use Noronha</h1>
        <p className="text-sm text-muted-foreground">
          Contas a pagar e a receber, notas fiscais e pedidos da empresa Use Noronha, direto da sua conta Bling.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="text-base">Conexão</CardTitle>
            <CardDescription>
              {statusQuery.isLoading
                ? "Verificando..."
                : connected
                  ? `Conectado. Token válido até ${new Date(statusQuery.data!.expiresAt!).toLocaleString("pt-BR")}.`
                  : "Nenhuma conta Bling conectada."}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {connected && (
              <Button
                variant="outline"
                onClick={() => disconnectMutation.mutate()}
                disabled={disconnectMutation.isPending}
              >
                <Unplug className="h-4 w-4 mr-2" /> Desconectar
              </Button>
            )}
            <Button onClick={() => connectMutation.mutate()} disabled={connectMutation.isPending}>
              {connectMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <PlugZap className="h-4 w-4 mr-2" />
              )}
              {connected ? "Reconectar" : "Conectar ao Bling"}
            </Button>
          </div>
        </CardHeader>
      </Card>

      {connected && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Dados do Bling</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => qc.invalidateQueries({ queryKey: ["bling", tab] })}
            >
              <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
            </Button>
          </CardHeader>
          <CardContent>
            <Tabs value={tab} onValueChange={(v) => setTab(v as BlingResource)}>
              <TabsList className="flex flex-wrap h-auto">
                {TABS.map((t) => (
                  <TabsTrigger key={t.id} value={t.id}>
                    {t.label}
                  </TabsTrigger>
                ))}
              </TabsList>
              {TABS.map((t) => (
                <TabsContent key={t.id} value={t.id}>
                  {tab === t.id && <ResourceTable resource={t.id} />}
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
