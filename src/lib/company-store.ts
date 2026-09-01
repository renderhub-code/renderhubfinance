import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CompanyState {
  activeCompanyId: string | null; // null => consolidado (todas as empresas do usuário)
  activeBusinessUnitId: string | null; // null => consolidado da empresa
  initialized: boolean; // true após a primeira seleção automática/manual
  setCompany: (id: string | null) => void;
  setBusinessUnit: (id: string | null) => void;
  markInitialized: () => void;
}

export const useCompanyStore = create<CompanyState>()(
  persist(
    (set) => ({
      activeCompanyId: null,
      activeBusinessUnitId: null,
      initialized: false,
      setCompany: (id) => set({ activeCompanyId: id, activeBusinessUnitId: null, initialized: true }),
      setBusinessUnit: (id) => set({ activeBusinessUnitId: id }),
      markInitialized: () => set({ initialized: true }),
    }),
    { name: "union-active-company" },
  ),
);
