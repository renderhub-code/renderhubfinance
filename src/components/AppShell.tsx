import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, ArrowLeftRight, FileBarChart, ListTree, Building2, LogOut, Loader2, Wallet, FlaskConical } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompanies, useBusinessUnits, useUserRoles } from "@/lib/queries";
import { useCompanyStore } from "@/lib/company-store";
import { HUBS, getHub, useHubStore, type HubId } from "@/lib/hub-store";
import { useEffect, type ReactNode } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";


const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/lancamentos", label: "Lançamentos", icon: ArrowLeftRight },
  { to: "/fluxo-de-caixa", label: "Fluxo de Caixa", icon: Wallet },
  { to: "/dre", label: "DRE", icon: FileBarChart },
  { to: "/simulacoes", label: "Simulações", icon: FlaskConical },
  { to: "/plano-de-contas", label: "Plano de Contas", icon: ListTree },
  { to: "/centros-de-custo", label: "Centros de Custo", icon: Building2 },
];

const CONSOLIDATED = "__all__";

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const loc = useLocation();
  const { data: companies, isLoading: loadingCompanies } = useCompanies();
  const { activeCompanyId, activeBusinessUnitId, initialized, setCompany, setBusinessUnit, markInitialized } = useCompanyStore();
  const { data: units } = useBusinessUnits(activeCompanyId);
  const { data: roles } = useUserRoles();

  const { activeHubId, setHub } = useHubStore();
  const activeHub = getHub(activeHubId);

  useEffect(() => {
    if (!initialized && companies && companies.length > 0) {
      const hubCompany = companies.find((c) => c.slug === activeHub.companySlug);
      setCompany((hubCompany ?? companies[0]).id);
    } else if (!initialized && companies && companies.length === 0 && !loadingCompanies) {
      markInitialized();
    }
  }, [initialized, companies, loadingCompanies, setCompany, markInitialized, activeHub.companySlug]);

  const activeCompany = companies?.find((c) => c.id === activeCompanyId);
  const isErks = activeCompany?.slug === "erks";
  const primaryRole = roles?.[0]?.role ?? "";
  const isConsolidated = activeCompanyId === null && initialized && (companies?.length ?? 0) > 0;

  function selectHub(id: HubId) {
    setHub(id);
    const hub = getHub(id);
    const company = companies?.find((c) => c.slug === hub.companySlug);
    if (company) setCompany(company.id);
    navigate({ to: "/dashboard" });
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex min-h-screen bg-muted/30">
      <aside className="hidden md:flex flex-col w-64 border-r bg-background">
        <div className="p-5 border-b">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Hub Financial Command
          </div>
          <div className="mt-3 space-y-1">
            {HUBS.map((h) => {
              const active = h.id === activeHubId;
              return (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => selectHub(h.id)}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center gap-2",
                    active
                      ? "bg-accent font-semibold text-foreground"
                      : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full shrink-0",
                      active ? "bg-primary" : "bg-muted-foreground/40",
                    )}
                  />
                  <span className="truncate">{h.label}</span>
                </button>
              );
            })}
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-0.5">

          {NAV.map((n) => {
            const active = loc.pathname === n.to || loc.pathname.startsWith(n.to + "/");
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                  active
                    ? "bg-primary text-primary-foreground font-medium"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <n.icon className="h-4 w-4" />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t">
          <Button variant="ghost" className="w-full justify-start" onClick={signOut}>
            <LogOut className="h-4 w-4 mr-2" /> Sair
          </Button>
        </div>
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b bg-background px-4 md:px-6 flex items-center gap-3">
          <div className="text-sm font-semibold truncate max-w-[220px] md:hidden lg:block">{activeHub.label}</div>
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs text-muted-foreground hidden sm:inline">Empresa</span>

            {loadingCompanies ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Select
                value={activeCompanyId ?? CONSOLIDATED}
                onValueChange={(v) => setCompany(v === CONSOLIDATED ? null : v)}
              >
                <SelectTrigger className="w-[240px]">
                  <SelectValue placeholder="Selecionar empresa" />
                </SelectTrigger>
                <SelectContent>
                  {companies && companies.length > 0 ? (
                    <>
                      <SelectItem value={CONSOLIDATED}>Consolidado (todas)</SelectItem>
                      {companies.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </>
                  ) : (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">Nenhuma empresa disponível</div>
                  )}
                </SelectContent>
              </Select>
            )}
            {isConsolidated && (
              <span className="text-[10px] font-medium uppercase tracking-wide px-2 py-1 rounded bg-primary/10 text-primary">
                Consolidado
              </span>
            )}
            {!isConsolidated && isErks && units && units.length > 1 && (
              <Select
                value={activeBusinessUnitId ?? "consolidado"}
                onValueChange={(v) => setBusinessUnit(v === "consolidado" ? null : v)}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Unidade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="consolidado">ERKS Consolidado</SelectItem>
                  {units.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="ml-auto text-xs text-muted-foreground uppercase tracking-wide">
            {primaryRole === "controller" && "Controller"}
            {primaryRole === "financial_manager" && "Gestor Financeiro"}
            {primaryRole === "ceo_viewer" && "CEO"}
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6 min-w-0">{children}</main>
      </div>
    </div>
  );
}
