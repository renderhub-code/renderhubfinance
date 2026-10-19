import { createFileRoute } from "@tanstack/react-router";
import { DeParaContas } from "@/components/DeParaContas";
import { PlanoContasEditor } from "@/components/PlanoContasEditor";
import { useCompanyStore } from "@/lib/company-store";

export const Route = createFileRoute("/_authenticated/plano-de-contas")({
  head: () => ({
    meta: [
      { title: "Plano de Contas — Hub Financial Command" },
      { name: "description", content: "Estrutura hierárquica do plano de contas." },
      { property: "og:title", content: "Plano de Contas — Hub Financial Command" },
      { property: "og:description", content: "Estrutura hierárquica do plano de contas e correspondências do Bling." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlanoDeContasPage,
});

function PlanoDeContasPage() {
  const companyId = useCompanyStore((s) => s.activeCompanyId);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Plano de Contas</h1>
        <p className="text-sm text-muted-foreground">
          Estrutura contábil padronizada — contas sintéticas e analíticas.
        </p>
      </div>

      <PlanoContasEditor companyId={companyId} />
      <DeParaContas companyId={companyId} />
    </div>
  );
}
