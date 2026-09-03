import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  blingApiProxy,
  disconnectBling,
  getBlingStatus,
  importBlingTransactions,
  reclassifyBlingTransactions,
  startBlingAuth,
  type BlingResource,
} from "@/lib/bling.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  if (v == null || v === "") return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function fmtDate(v: unknown): string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(v)) return fmt(v);
  return v.slice(0, 10).split("-").reverse().join("/");
}

function fmtMoney(v: unknown): string {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";
}

const SITUACAO_CONTA: Record<number, string> = { 1: "Em aberto", 2: "Pago", 3: "Parcial" };

type Row = Record<string, unknown> & { id?: number | string };
type Col = { label: string; render: (r: Row) => string };

const contatoNome = (r: Row) => fmt((r.contato as { nome?: string } | undefined)?.nome);

const COLS: Record<string, Col[]> = {
  "contas-receber": [
    { label: "Cliente", render: contatoNome },
    { label: "Vencimento", render: (r) => fmtDate(r.vencimento) },
    { label: "Valor", render: (r) => fmtMoney(r.valor) },
    { label: "Saldo", render: (r) => fmtMoney(r.saldo) },
    { label: "Situação", render: (r) => SITUACAO_CONTA[Number(r.situacao)] ?? fmt(r.situacao) },
  ],
  "contas-pagar": [
    { label: "Fornecedor", render: contatoNome },
    { label: "Vencimento", render: (r) => fmtDate(r.vencimento) },
    { label: "Valor", render: (r) => fmtMoney(r.valor) },
    { label: "Saldo", render: (r) => fmtMoney(r.saldo) },
    { label: "Situação", render: (r) => SITUACAO_CONTA[Number(r.situacao)] ?? fmt(r.situacao) },
  ],
  "notas-fiscais": [
    { label: "Número", render: (r) => fmt(r.numero) },
    { label: "Emissão", render: (r) => fmtDate(r.dataEmissao ?? r.data) },
    { label: "Cliente", render: contatoNome },
    { label: "Valor", render: (r) => fmtMoney(r.valorNota ?? r.valor) },
    { label: "Situação", render: (r) => fmt(r.situacao) },
  ],
  "pedidos-venda": [
    { label: "Número", render: (r) => fmt(r.numero) },
    { label: "Data", render: (r) => fmtDate(r.data) },
    { label: "Cliente", render: contatoNome },
    { label: "Total", render: (r) => fmtMoney(r.total) },
    { label: "Situação", render: (r) => fmt(r.situacao) },
  ],
};

function DetailView({ detail }: { detail: unknown }) {
  if (!detail || typeof detail !== "object") return <p className="text-sm text-muted-foreground">Sem detalhes.</p>;
  const entries = Object.entries(detail as Record<string, unknown>).filter(([, v]) => v != null && v !== "");
  return (
    <dl className="grid grid-cols-[160px_1fr] gap-x-4 gap-y-1.5 text-sm">
      {entries.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="break-words">{fmt(v)}</dd>
        </div>
      ))}
    </dl>
  );
}

function ResourceTable({ resource }: { resource: BlingResource }) {
  const proxy = useServerFn(blingApiProxy);
  const [detailId, setDetailId] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ["bling", resource],
    queryFn: () => proxy({ data: { resource } }),
  });
  const detailQuery = useQuery({
    queryKey: ["bling", resource, "detail", detailId],
    queryFn: () => proxy({ data: { resource, id: detailId! } }),
    enabled: detailId != null,
  });

  const cols = COLS[resource] ?? [];
  const label = TABS.find((t) => t.id === resource)?.label ?? resource;

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
  const rows = (q.data?.rows ?? []) as Row[];
  if (rows.length === 0) return <p className="py-6 text-sm text-muted-foreground">Nenhum registro retornado.</p>;

  return (
    <>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {cols.map((c) => (
                <TableHead key={c.label}>{c.label}</TableHead>
              ))}
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={r.id ?? i}>
                {cols.map((c) => (
                  <TableCell key={c.label} className="max-w-[240px] truncate">
                    {c.render(r)}
                  </TableCell>
                ))}
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={r.id == null}
                    onClick={() => setDetailId(String(r.id))}
                  >
                    Detalhes
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={detailId != null} onOpenChange={(o: boolean) => !o && setDetailId(null)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Detalhes — {label} #{detailId}
            </DialogTitle>
          </DialogHeader>
          {detailQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Buscando detalhes no Bling...
            </p>
          ) : detailQuery.error ? (
            <p className="text-sm text-destructive">{(detailQuery.error as Error).message}</p>
          ) : (
            <DetailView detail={detailQuery.data?.detail} />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function FinanceiroPage() {
  const qc = useQueryClient();
  const status = useServerFn(getBlingStatus);
  const start = useServerFn(startBlingAuth);
  const disconnect = useServerFn(disconnectBling);
  const importFn = useServerFn(importBlingTransactions);
  const reclassify = useServerFn(reclassifyBlingTransactions);
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

  const reclassifyMutation = useMutation({
    mutationFn: async () => {
      let total = 0;
      let pending = 0;
      // Processa em lotes (o servidor limita cada chamada); para quando não há mais progresso.
      for (let i = 0; i < 25; i++) {
        const r = await reclassify({ data: { year } });
        total += r.reclassified;
        pending = r.pending;
        if (r.reclassified === 0) break;
      }
      return { reclassified: total, pending };
    },
    onSuccess: (r) => {
      toast.success(
        `Reclassificação concluída: ${r.reclassified} lançamento(s) atualizados, ${r.pending} ainda sem mapeamento.`,
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
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
            <div>
              <CardTitle className="text-base">Importar para Lançamentos</CardTitle>
              <CardDescription>
                Traz as contas a pagar e a receber de {year} para os Lançamentos da Use Noronha, alimentando
                Dashboard, Fluxo de Caixa e DRE. Registros já importados não são duplicados.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => reclassifyMutation.mutate()}
                disabled={reclassifyMutation.isPending}
              >
                {reclassifyMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Reclassificar
              </Button>
              <Button onClick={() => importMutation.mutate()} disabled={importMutation.isPending}>
                {importMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Importar {year}
              </Button>
            </div>
          </CardHeader>
        </Card>
      )}



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
