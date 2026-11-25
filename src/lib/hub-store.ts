import { create } from "zustand";
import { persist } from "zustand/middleware";
import { GROUP_COMPANIES, GROUP_WORKSPACE, type WorkspaceId } from "@/os/companies";

/**
 * Workspace ativo do render.os: o grupo consolidado ou uma empresa.
 * Mantém a API antiga (`HubId`, `HUBS`, `getHub`) para as telas do financeiro.
 */
export type HubId = WorkspaceId;

export interface Hub {
  id: HubId;
  label: string;
  companySlug: string | null;
  consolidator?: boolean;
}

export const HUBS: Hub[] = [
  { id: GROUP_WORKSPACE.id, label: GROUP_WORKSPACE.name, companySlug: null, consolidator: true },
  ...GROUP_COMPANIES.map((c) => ({ id: c.id, label: c.name, companySlug: c.slug })),
];

interface HubState {
  activeHubId: HubId;
  setHub: (id: HubId) => void;
}

export const useHubStore = create<HubState>()(
  persist(
    (set) => ({
      activeHubId: "grupo",
      setHub: (id) => set({ activeHubId: id }),
    }),
    { name: "render-os-workspace", version: 1 },
  ),
);

export function getHub(id: HubId): Hub {
  return HUBS.find((h) => h.id === id) ?? HUBS[0];
}
