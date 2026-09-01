import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useHubStore } from "@/lib/hub-store";
import { useCompanyStore } from "@/lib/company-store";
import { SimulacaoComercial } from "@/components/SimulacaoComercial";

export const Route = createFileRoute("/_authenticated/simulacoes")({
  head: () => ({
    meta: [
      { title: "Simulações — Hub Financial Command" },
      { name: "description", content: "Cenários de receita, custo e despesa aplicáveis ao previsto." },
      { property: "og:title", content: "Simulações — Hub Financial Command" },
      { property: "og:description", content: "Cenários comerciais aplicáveis ao DRE e ao fluxo de caixa previsto." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SimulacoesPage,
});

function SimulacoesPage() {
  const activeHubId = useHubStore((s) => s.activeHubId);
  const companyId = useCompanyStore((s) => s.activeCompanyId);
  const isRender = activeHubId === "render";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Simulações</h1>
        <p className="text-sm text-muted-foreground">
          {isRender
            ? "Simulação comercial por cliente e conta. Aplique as quantidades previstas ao DRE e ao fluxo de caixa."
            : "Cenários de receita, custo e despesa aplicáveis ao fluxo de caixa previsto."}
        </p>
      </div>

      {isRender ? (
        companyId ? (
          <SimulacaoComercial companyId={companyId} />
        ) : (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Selecione a empresa Render Comex no cabeçalho para editar a simulação comercial.
            </CardContent>
          </Card>
        )
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cenários</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Ano</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Criada em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-muted-foreground">—</TableCell>
                    <TableCell className="text-muted-foreground">—</TableCell>
                    <TableCell className="text-muted-foreground">—</TableCell>
                    <TableCell className="text-muted-foreground">—</TableCell>
                    <TableCell className="text-muted-foreground">—</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" disabled>Abrir</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
