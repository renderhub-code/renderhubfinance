import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ArrowRight, BarChart3, ListTree, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "render.os — Grupo Render Hub" },
      { name: "description", content: "Sistema que unifica as empresas do Grupo Render Hub: Render Comex, Union Contadores, Dom Pablyto, Nortrip, ERKS e SX Paper." },
      { property: "og:title", content: "render.os" },
      { property: "og:description", content: "Uma marca. Vários negócios. Um só sistema." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="h-16 px-6 flex items-center border-b">
        <div className="font-semibold tracking-tight">render.os</div>
        <div className="ml-auto">
          <Link to="/auth">
            <Button>Entrar <ArrowRight className="h-4 w-4 ml-1" /></Button>
          </Link>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-6 py-16 md:py-24">
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
          Um só sistema <span className="text-muted-foreground">para o Grupo Render Hub.</span>
        </h1>
        <p className="mt-6 text-lg text-muted-foreground max-w-2xl">
          Financeiro, comercial, comex e contábil das seis empresas do grupo — Render Comex, Union Contadores, Dom Pablyto, Nortrip, ERKS e SX Paper — em um só lugar.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link to="/auth">
            <Button size="lg">Acessar o sistema <ArrowRight className="h-4 w-4 ml-2" /></Button>
          </Link>
        </div>
        <div className="mt-20 grid gap-6 md:grid-cols-3">
          <Feature icon={ListTree} title="Plano de contas unificado" desc="Estrutura hierárquica padronizada em todas as empresas do hub, com suporte a unidades de negócio." />
          <Feature icon={BarChart3} title="Fluxo de caixa mês a mês" desc="Realizado e previsto para cada mês, com acumulado do ano por conta." />
          <Feature icon={TrendingUp} title="Simulações (em breve)" desc="Cenários de receita, custo e despesa aplicáveis ao fluxo de caixa previsto." />
        </div>
      </main>
    </div>
  );
}

function Feature({ icon: Icon, title, desc }: { icon: any; title: string; desc: string }) {
  return (
    <div className="rounded-lg border p-6">
      <Icon className="h-5 w-5 text-primary mb-3" />
      <div className="font-medium">{title}</div>
      <div className="text-sm text-muted-foreground mt-1">{desc}</div>
    </div>
  );
}
