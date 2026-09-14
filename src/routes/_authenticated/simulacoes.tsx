import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  const supportsCommercialSimulation = activeHubId === "render" || activeHubId === "noronha";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Simulações</h1>
        <p className="text-sm text-muted-foreground">
           {supportsCommercialSimulation
            ? "Simulação comercial por cliente e categoria. Aplique as quantidades previstas ao DRE e ao fluxo de caixa."
            : "Cenários de receita, custo e despesa aplicáveis ao fluxo de caixa previsto."}
        </p>
      </div>

       {supportsCommercialSimulation ? (
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
         <Card><CardHeader><CardTitle className="text-base">Cenários</CardTitle></CardHeader><CardContent className="py-10 text-center text-sm text-muted-foreground">A simulação comercial está disponível nos hubs Render Comex e Use Noronha.</CardContent></Card>
      )}
    </div>
  );
}
