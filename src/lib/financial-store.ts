import { create } from "zustand";
import { persist } from "zustand/middleware";

interface FinancialState {
  year: number;
  setYear: (year: number) => void;
}

export const useFinancialStore = create<FinancialState>()(
  persist(
    (set) => ({
      year: new Date().getFullYear(),
      setYear: (year) => set({ year }),
    }),
    { name: "hub-financial-year" },
  ),
);