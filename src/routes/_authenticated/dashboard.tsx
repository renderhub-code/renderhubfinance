import { createFileRoute } from "@tanstack/react-router";
import { useHubStore } from "@/lib/hub-store";
import { DashboardPadrao } from "@/components/padrao/DashboardPadrao";
import { DashboardNortrip } from "@/components/nortrip/DashboardNortrip";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard · Financeiro — render.os" },
      { name: "description", content: "Visão geral financeira: caixa, entradas, saídas e resultado do período." },
    ],
  }),
  component: DashboardPage,
});

/** A Nortrip usa o caixa sincronizado do Bling; as demais empresas usam a estrutura padrão do hub. */
function DashboardPage() {
  const activeHubId = useHubStore((s) => s.activeHubId);
  return activeHubId === "nortrip" ? <DashboardNortrip /> : <DashboardPadrao />;
}
