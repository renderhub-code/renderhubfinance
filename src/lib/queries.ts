import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useCompanyStore } from "./company-store";

export interface Company {
  id: string;
  name: string;
  slug: string;
}
export interface BusinessUnit {
  id: string;
  company_id: string;
  name: string;
  slug: string;
}
export interface AccountGroup {
  id: string;
  company_id: string;
  code: string;
  name: string;
  type: "entrada" | "saida";
  dre_section: string;
  sort_order: number;
}

export interface AccountWithDre extends Account {
  subgroup: {
    group: { dre_section: string } | null;
  } | null;
}
export interface AccountSubgroup {
  id: string;
  company_id: string;
  group_id: string;
  code: string;
  name: string;
  sort_order: number;
}
export interface Account {
  id: string;
  company_id: string;
  subgroup_id: string;
  code: string;
  name: string;
  type: "entrada" | "saida";
  sort_order: number;
  active: boolean;
}
export interface CostCenter {
  id: string;
  company_id: string;
  code: string;
  name: string;
  active: boolean;
}
export interface Transaction {
  id: string;
  company_id: string;
  business_unit_id: string | null;
  account_id: string;
  cost_center_id: string | null;
  entry_date: string;
  due_date: string | null;
  settled_date: string | null;
  type: "entrada" | "saida";
  status: "previsto" | "realizado" | "cancelado" | "atrasado";
  amount_expected: number;
  amount_realized: number;
  description: string | null;
  payment_method: string | null;
  attachment_path: string | null;
  notes: string | null;
  source_simulation_id: string | null;
  created_at: string;
}

export interface Simulation {
  id: string;
  company_id: string;
  name: string;
  kind: "receita" | "custo" | "despesa";
  year: number;
  status: "rascunho" | "aplicada";
  notes: string | null;
  applied_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SimulationLine {
  id: string;
  simulation_id: string;
  account_id: string;
  business_unit_id: string | null;
  month: number;
  amount: number;
  description: string | null;
  client_name: string | null;
  unit_price: number;
  margin_pct: number;
  qty_expected: number;
  qty_realized: number;
  group_key: string;
}

export interface AccountMapping {
  id: string;
  company_id: string;
  source_code: string;
  source_name: string | null;
  account_id: string | null;
  notes: string | null;
}


export function useAccountMappings(companyId: string | null) {
  return useQuery({
    queryKey: ["account_mappings", companyId ?? "__all__"],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("account_mappings")
        .select("id,company_id,source_code,source_name,account_id,notes")
        .eq("company_id", companyId!)
        .order("source_code");
      if (error) throw error;
      return data as AccountMapping[];
    },
  });
}


export function useCompanies() {
  return useQuery({
    queryKey: ["companies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id,name,slug")
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data as Company[];
    },
  });
}

export function useBusinessUnits(companyId: string | null) {
  return useQuery({
    queryKey: ["business_units", companyId ?? "__all__"],
    queryFn: async () => {
      let q = supabase
        .from("business_units")
        .select("id,company_id,name,slug")
        .eq("active", true)
        .order("name");
      if (companyId) q = q.eq("company_id", companyId);
      const { data, error } = await q;
      if (error) throw error;
      return data as BusinessUnit[];
    },
  });
}

export function useAccountGroups(companyId: string | null) {
  return useQuery({
    queryKey: ["account_groups", companyId ?? "__all__"],
    queryFn: async () => {
      let q = supabase
        .from("account_groups")
        .select("id,company_id,code,name,type,dre_section,sort_order")
        .order("sort_order");
      if (companyId) q = q.eq("company_id", companyId);
      const { data, error } = await q;
      if (error) throw error;
      return data as AccountGroup[];
    },
  });
}

export function useAccountSubgroups(companyId: string | null) {
  return useQuery({
    queryKey: ["account_subgroups", companyId ?? "__all__"],
    queryFn: async () => {
      let q = supabase
        .from("account_subgroups")
        .select("id,company_id,group_id,code,name,sort_order")
        .order("sort_order");
      if (companyId) q = q.eq("company_id", companyId);
      const { data, error } = await q;
      if (error) throw error;
      return data as AccountSubgroup[];
    },
  });
}

export function useAccounts(companyId: string | null) {
  return useQuery({
    queryKey: ["accounts", companyId ?? "__all__"],
    queryFn: async () => {
      let q = supabase
        .from("accounts")
        .select("id,company_id,subgroup_id,code,name,type,sort_order,active")
        .order("code");
      if (companyId) q = q.eq("company_id", companyId);
      const { data, error } = await q;
      if (error) throw error;
      return data as Account[];
    },
  });
}

export function useAccountsWithDre(companyId: string | null) {
  return useQuery({
    queryKey: ["accounts_with_dre", companyId ?? "__all__"],
    queryFn: async () => {
      let q = supabase
        .from("accounts")
        .select("id,company_id,subgroup_id,code,name,type,sort_order,active,subgroup:account_subgroups(group:account_groups(dre_section))")
        .order("code");
      if (companyId) q = q.eq("company_id", companyId);
      const { data, error } = await q;
      if (error) throw error;
      return data as unknown as AccountWithDre[];
    },
  });
}

export function useCostCenters(companyId: string | null) {
  return useQuery({
    queryKey: ["cost_centers", companyId ?? "__all__"],
    queryFn: async () => {
      let q = supabase
        .from("cost_centers")
        .select("id,company_id,code,name,active")
        .order("code");
      if (companyId) q = q.eq("company_id", companyId);
      const { data, error } = await q;
      if (error) throw error;
      return data as CostCenter[];
    },
  });
}

export interface TransactionFilters {
  from?: string;
  to?: string;
  status?: Transaction["status"] | "todos";
  type?: "entrada" | "saida" | "todos";
  accountId?: string | null;
  businessUnitId?: string | null;
}

export function useTransactions(companyId: string | null, filters: TransactionFilters = {}) {
  return useQuery({
    queryKey: ["transactions", companyId ?? "__all__", filters],
    queryFn: async () => {
      let q = supabase
        .from("transactions")
        .select("*")
        .order("entry_date", { ascending: false })
        .limit(2000);
      if (companyId) q = q.eq("company_id", companyId);
      if (filters.from) q = q.gte("entry_date", filters.from);
      if (filters.to) q = q.lte("entry_date", filters.to);
      if (filters.status && filters.status !== "todos") q = q.eq("status", filters.status);
      if (filters.type && filters.type !== "todos") q = q.eq("type", filters.type);
      if (filters.accountId) q = q.eq("account_id", filters.accountId);
      if (filters.businessUnitId) q = q.eq("business_unit_id", filters.businessUnitId);
      const { data, error } = await q;
      if (error) throw error;
      return data as Transaction[];
    },
  });
}

export function useActiveCompany() {
  const activeCompanyId = useCompanyStore((s) => s.activeCompanyId);
  return activeCompanyId;
}

export function useIsConsolidated() {
  const companyId = useCompanyStore((s) => s.activeCompanyId);
  const initialized = useCompanyStore((s) => s.initialized);
  const { data: companies } = useCompanies();
  return companyId === null && initialized && (companies?.length ?? 0) > 0;
}

export function useUserRoles() {
  return useQuery({
    queryKey: ["my_user_roles"],
    queryFn: async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) return [] as { role: string; company_id: string | null }[];
      const { data, error } = await supabase
        .from("user_roles")
        .select("role,company_id")
        .eq("user_id", uid);
      if (error) throw error;
      return data as { role: string; company_id: string | null }[];
    },
  });
}

export function useSimulations(companyId: string | null) {
  return useQuery({
    queryKey: ["simulations", companyId ?? "__all__"],
    queryFn: async () => {
      let q = supabase
        .from("simulations")
        .select("*")
        .order("created_at", { ascending: false });
      if (companyId) q = q.eq("company_id", companyId);
      const { data, error } = await q;
      if (error) throw error;
      return data as Simulation[];
    },
  });
}

export function useSimulation(id: string | null) {
  return useQuery({
    queryKey: ["simulation", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("simulations").select("*").eq("id", id!).single();
      if (error) throw error;
      return data as Simulation;
    },
  });
}

export function useSimulationLines(simulationId: string | null) {
  return useQuery({
    queryKey: ["simulation_lines", simulationId],
    enabled: !!simulationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("simulation_lines")
        .select("*")
        .eq("simulation_id", simulationId!)
        .order("month");
      if (error) throw error;
      return data as SimulationLine[];
    },
  });
}
