import { create } from "zustand";
import { persist } from "zustand/middleware";

export type HubId = "union" | "render" | "noronha" | "dompablyto" | "erks" | "aef";

export interface Hub {
  id: HubId;
  label: string;
  companySlug: string;
}

export const HUBS: Hub[] = [
  { id: "union", label: "Union Contadores Financeiro", companySlug: "union-contadores" },
  { id: "render", label: "Render Comex Financeiro", companySlug: "render-comex" },
  { id: "noronha", label: "Use Noronha Financeiro", companySlug: "use-noronha" },
  { id: "dompablyto", label: "Dom Pablyto Financeiro", companySlug: "dom-pablyto" },
  { id: "erks", label: "ERKS Financeiro", companySlug: "erks" },
  { id: "aef", label: "A&F Financeiro", companySlug: "a-e-f" },
];

interface HubState {
  activeHubId: HubId;
  setHub: (id: HubId) => void;
}

export const useHubStore = create<HubState>()(
  persist(
    (set) => ({
      activeHubId: "union",
      setHub: (id) => set({ activeHubId: id }),
    }),
    { name: "hub-financial-command-active-hub" },
  ),
);

export function getHub(id: HubId): Hub {
  return HUBS.find((h) => h.id === id) ?? HUBS[0];
}
