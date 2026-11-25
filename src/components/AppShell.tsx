import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Check, ChevronsUpDown, CircleHelp, LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useCompanies, useBusinessUnits, useUserRoles } from "@/lib/queries";
import { useCompanyStore } from "@/lib/company-store";
import { useFinancialStore } from "@/lib/financial-store";
import { getHub, useHubStore } from "@/lib/hub-store";
import { GROUP_COMPANIES, GROUP_WORKSPACE, getCompany, type WorkspaceId } from "@/os/companies";
import { MODULES, SETTINGS_MODULE, moduleForPath, moduleHasAccess, visibleItems, type OsModule } from "@/os/modules";
import { useOs } from "@/os/acessos";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { RenderMark } from "@/components/brand/Logo";
import { NovaAtividadeAlerta } from "@/components/contabil/NovaAtividadeAlerta";

const ROLE_LABEL: Record<string, string> = {
  controller: "Controller",
  financial_manager: "Gestor financeiro",
  ceo_viewer: "CEO",
};

/**
 * Shell do render.os.
 *  ┌──────┬──────────────┬──────────────────────────────┐
 *  │trilho│ painel       │ conteúdo (cartão branco)     │
 *  │módulo│ workspace +  │                              │
 *  │      │ menu módulo  │                              │
 *  └──────┴──────────────┴──────────────────────────────┘
 */
export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user } = useAuth();
  const { data: companies } = useCompanies();
  const { data: roles } = useUserRoles();
  const { activeCompanyId, setCompany, markInitialized } = useCompanyStore();
  const { activeHubId, setHub } = useHubStore();
  const [panelOpen, setPanelOpen] = useState(true);

  const workspace = getHub(activeHubId).id as WorkspaceId;
  const isGroup = workspace === "grupo";
  const currentModule = moduleForPath(pathname);
  // Permissões por empresa × aba. Enquanto carregam, nada é escondido.
  const os = useOs();
  const navItems = visibleItems(currentModule, workspace, os.nivelNo, os.loading || os.admin);
  /** O módulo tem telas nesta empresa, mas a pessoa não tem acesso a nenhuma. */
  const semAcessoAqui = navItems.length === 0 && visibleItems(currentModule, workspace, () => 2, true).length > 0;
  const railModules = MODULES.filter((m) => moduleHasAccess(m, os.nivelNo, os.loading || os.admin));
  /** Item ativo = o de rota mais longa que casa com a URL (ex.: /contabil vs /contabil/atividades). */
  const activeTo = navItems
    .filter((i) => pathname === i.to || pathname.startsWith(i.to + "/"))
    .sort((a, b) => b.to.length - a.to.length)[0]?.to;

  /** Empresas do registro que já existem no banco (por slug). */
  const dbIdBySlug = useMemo(() => new Map((companies ?? []).map((c) => [c.slug, c.id])), [companies]);

  // Mantém a empresa ativa do financeiro presa ao workspace escolhido.
  useEffect(() => {
    if (isGroup) {
      if (activeCompanyId !== null) setCompany(null);
      else markInitialized();
      return;
    }
    const slug = getCompany(workspace)?.slug;
    const id = slug ? dbIdBySlug.get(slug) : undefined;
    if (id && id !== activeCompanyId) setCompany(id);
  }, [isGroup, workspace, dbIdBySlug, activeCompanyId, setCompany, markInitialized]);

  // Se o item atual não existe neste workspace, volta para a entrada do módulo.
  useEffect(() => {
    if (currentModule.status !== "live" || currentModule.items.length === 0) return;
    const ok = navItems.some((i) => pathname === i.to || pathname.startsWith(i.to + "/"));
    if (!ok && navItems[0]) navigate({ to: navItems[0].to });
  }, [currentModule, navItems, pathname, navigate]);

  function selectWorkspace(id: WorkspaceId) {
    setHub(id);
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const displayName = (user?.user_metadata?.full_name as string | undefined) ?? user?.email?.split("@")[0] ?? "Usuário";
  const role = os.admin && !os.loading ? "Administrador do render.os" : ROLE_LABEL[roles?.[0]?.role ?? ""] ?? "";

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex h-screen overflow-hidden bg-sidebar text-foreground">
        {/* Trilho de módulos */}
        <aside className="hidden md:flex w-[60px] shrink-0 flex-col items-center bg-rail py-4 text-rail-foreground">
          <Link to="/inicio" aria-label="render.os — início" className="group mb-6 grid h-10 w-10 place-items-center">
            <RenderMark className="h-8 w-8 transition-transform duration-300 group-hover:scale-110" />
          </Link>
          <nav className="flex flex-col items-center gap-1.5">
            {railModules.map((m) => (
              <RailButton key={m.id} module={m} active={m.id === currentModule.id} />
            ))}
          </nav>
          <div className="mt-auto flex flex-col items-center gap-1.5">
            <RailButton module={SETTINGS_MODULE} active={currentModule.id === SETTINGS_MODULE.id} />
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="grid h-10 w-10 place-items-center rounded-lg text-rail-foreground/70">
                  <CircleHelp className="h-[18px] w-[18px]" strokeWidth={1.75} />
                </span>
              </TooltipTrigger>
              <TooltipContent side="right">Ajuda</TooltipContent>
            </Tooltip>
            <div className="mt-2 grid h-9 w-9 place-items-center rounded-full bg-rail-active text-xs font-semibold text-white">
              {initialsOf(displayName)}
            </div>
          </div>
        </aside>

        {/* Painel do módulo */}
        {panelOpen && (
          <aside className="hidden md:flex w-[248px] shrink-0 flex-col px-3 pt-5 pb-4">
            <div className="flex items-center justify-between px-2">
              <h2 className="text-[15px] font-semibold tracking-tight">{currentModule.label}</h2>
              <button
                type="button"
                onClick={() => setPanelOpen(false)}
                className="rounded-md p-1 text-muted-foreground hover:bg-background hover:text-foreground"
                aria-label="Recolher painel"
              >
                <PanelLeftClose className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </div>

            <WorkspaceSwitcher workspace={workspace} available={dbIdBySlug} onSelect={selectWorkspace} />

            <nav className="mt-4 flex flex-col gap-0.5">
              {navItems.map((n) => {
                const active = n.to === activeTo;
                return (
                  <Link
                    key={n.to}
                    to={n.to}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
                      active
                        ? "bg-background font-medium text-foreground shadow-[0_1px_2px_rgb(0_0_0/0.04)] ring-1 ring-border"
                        : "text-muted-foreground hover:bg-background/70 hover:text-foreground",
                    )}
                  >
                    <n.icon className={cn("h-4 w-4", active && "text-primary")} strokeWidth={1.75} />
                    {n.label}
                  </Link>
                );
              })}
              {currentModule.status === "soon" && (
                <p className="px-2.5 py-2 text-sm text-muted-foreground">Módulo em construção.</p>
              )}
            </nav>

            <div className="mt-auto flex items-center gap-2 px-2">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{displayName}</div>
                <div className="truncate text-xs text-muted-foreground">{role || user?.email}</div>
              </div>
              <button
                type="button"
                onClick={signOut}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-background hover:text-foreground"
                aria-label="Sair"
                title="Sair"
              >
                <LogOut className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </div>
          </aside>
        )}

        {/* Conteúdo */}
        <main className="flex min-w-0 flex-1 flex-col p-2 md:pl-0">
          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-background shadow-[0_1px_3px_rgb(0_0_0/0.04)]">
            {!panelOpen && (
              <button
                type="button"
                onClick={() => setPanelOpen(true)}
                className="absolute left-3 top-3 z-10 hidden rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground md:block"
                aria-label="Abrir painel"
              >
                <PanelLeftOpen className="h-4 w-4" strokeWidth={1.75} />
              </button>
            )}
            {currentModule.id === "financeiro" && <FinanceToolbar />}
            <div className="min-h-0 flex-1 overflow-auto px-5 py-6 md:px-10 md:py-8">
              <div key={pathname} className="ros-page-enter">
                {currentModule.status === "live" && navItems.length === 0
                  ? <EmConstrucao module={currentModule} workspace={workspace} semAcesso={semAcessoAqui} />
                  : children}
              </div>
            </div>
          </div>
        </main>
      </div>
      <NovaAtividadeAlerta />
    </TooltipProvider>
  );
}

/** Módulo que existe no grupo, mas ainda não tem telas para a empresa escolhida. */
function EmConstrucao({ module: m, workspace, semAcesso }: { module: OsModule; workspace: WorkspaceId; semAcesso?: boolean }) {
  const nome = workspace === "grupo" ? GROUP_WORKSPACE.name : getCompany(workspace)?.name ?? "esta empresa";
  const Icon = m.icon;
  if (semAcesso) {
    return (
      <div className="grid min-h-[55vh] place-items-center">
        <div className="max-w-md text-center">
          <span className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-xl border bg-muted/40">
            <Icon className="h-5 w-5 text-muted-foreground" strokeWidth={1.75} />
          </span>
          <h2 className="text-base font-semibold">Sem acesso ao {m.label} da {nome}</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">Peça a um administrador do render.os para liberar em <b>Pessoas › Acessos</b>, ou troque de empresa no seletor ao lado.</p>
        </div>
      </div>
    );
  }
  return (
    <div className="grid min-h-[55vh] place-items-center">
      <div className="max-w-md text-center">
        <span className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-xl border bg-muted/40">
          <Icon className="h-5 w-5 text-muted-foreground" strokeWidth={1.75} />
        </span>
        <h2 className="text-base font-semibold">{m.label} da {nome} em construção</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Por enquanto, o {m.label} está pronto para {prontas(m)}. Troque de empresa no seletor ao lado para ver.
        </p>
      </div>
    </div>
  );
}

/** Empresas em que o módulo já tem telas, por extenso. */
function prontas(m: OsModule): string {
  const ids = new Set(m.items.flatMap((i) => i.only ?? []).filter((w) => w !== "grupo"));
  const nomes = [...ids].map((id) => getCompany(id)?.name).filter(Boolean) as string[];
  if (!nomes.length) return "o grupo";
  return nomes.length === 1 ? `a ${nomes[0]}` : `${nomes.slice(0, -1).map((n) => `a ${n}`).join(", ")} e a ${nomes.at(-1)}`;
}

function RailButton({ module: m, active }: { module: OsModule; active: boolean }) {
  const content = (
    <span
      className={cn(
        "relative grid h-10 w-10 place-items-center rounded-lg transition-colors",
        active ? "bg-rail-active text-white" : "text-rail-foreground hover:bg-rail-active/60 hover:text-white",
      )}
    >
      <m.icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
      {m.status === "soon" && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-rail-foreground/40" />}
    </span>
  );
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {m.status === "live" ? (
          <Link to={m.home} aria-label={m.label}>{content}</Link>
        ) : (
          <Link to="/modulo/$id" params={{ id: m.id }} aria-label={m.label}>{content}</Link>
        )}
      </TooltipTrigger>
      <TooltipContent side="right">
        {m.label}
        {m.status === "soon" && <span className="opacity-70"> · em breve</span>}
      </TooltipContent>
    </Tooltip>
  );
}

function WorkspaceSwitcher({
  workspace,
  available,
  onSelect,
}: {
  workspace: WorkspaceId;
  available: Map<string, string>;
  onSelect: (id: WorkspaceId) => void;
}) {
  const company = getCompany(workspace);
  const label = company?.name ?? GROUP_WORKSPACE.name;
  const sector = company?.sector ?? GROUP_WORKSPACE.sector;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="mt-4 flex w-full items-center gap-2.5 rounded-lg border bg-background px-2.5 py-2 text-left shadow-[0_1px_2px_rgb(0_0_0/0.03)] transition-colors hover:bg-muted/50"
        >
          <WorkspaceAvatar id={workspace} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{label}</span>
            <span className="block truncate text-xs text-muted-foreground">{sector}</span>
          </span>
          <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[232px]">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Grupo</DropdownMenuLabel>
        <WorkspaceItem id="grupo" name={GROUP_WORKSPACE.name} sector="Visão consolidada" active={workspace === "grupo"} onSelect={onSelect} />
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Empresas</DropdownMenuLabel>
        {GROUP_COMPANIES.map((c) => {
          const ready = available.has(c.slug);
          return (
            <WorkspaceItem
              key={c.id}
              id={c.id}
              name={c.name}
              sector={ready ? c.sector : "Ainda não cadastrada"}
              active={workspace === c.id}
              disabled={!ready}
              onSelect={onSelect}
            />
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function WorkspaceItem({
  id, name, sector, active, disabled, onSelect,
}: {
  id: WorkspaceId; name: string; sector: string; active: boolean; disabled?: boolean; onSelect: (id: WorkspaceId) => void;
}) {
  return (
    <DropdownMenuItem disabled={disabled} onSelect={() => onSelect(id)} className="gap-2.5 py-1.5">
      <WorkspaceAvatar id={id} small />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm">{name}</span>
        <span className="block truncate text-xs text-muted-foreground">{sector}</span>
      </span>
      {active && <Check className="h-4 w-4 text-primary" />}
    </DropdownMenuItem>
  );
}

export function WorkspaceAvatar({ id, small }: { id: WorkspaceId; small?: boolean }) {
  const company = getCompany(id);
  const size = small ? "h-7 w-7 text-[10px]" : "h-8 w-8 text-[11px]";
  if (!company) {
    return (
      <span className={cn("grid shrink-0 place-items-center rounded-md bg-rail", size)}>
        <RenderMark className="h-[78%] w-[78%]" />
      </span>
    );
  }
  if (company.mark) {
    return <img src={company.mark} alt="" className={cn("shrink-0 rounded-md object-cover", size)} />;
  }
  return (
    <span
      className={cn("grid shrink-0 place-items-center rounded-md font-semibold text-white", size)}
      style={{ backgroundColor: company.color }}
    >
      {company.initials}
    </span>
  );
}

/** Filtros globais do financeiro (ano e unidade de negócio da ERKS). */
function FinanceToolbar() {
  const { activeCompanyId, activeBusinessUnitId, setBusinessUnit } = useCompanyStore();
  const { year, setYear } = useFinancialStore();
  const workspace = useHubStore((s) => s.activeHubId);
  const { data: units } = useBusinessUnits(activeCompanyId);
  const showUnits = workspace === "erks" && (units?.length ?? 0) > 1;

  return (
    <div className="flex items-center gap-2 border-b px-5 py-2.5 md:px-10">
      <span className="text-xs text-muted-foreground">Período</span>
      <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
        <SelectTrigger className="h-8 w-[92px]" aria-label="Ano financeiro">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((y) => (
            <SelectItem key={y} value={String(y)}>{y}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {showUnits && (
        <Select value={activeBusinessUnitId ?? "consolidado"} onValueChange={(v) => setBusinessUnit(v === "consolidado" ? null : v)}>
          <SelectTrigger className="h-8 w-[200px]" aria-label="Unidade de negócio">
            <SelectValue placeholder="Unidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="consolidado">ERKS consolidado</SelectItem>
            {units!.map((u) => (
              <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {workspace === "grupo" && (
        <span className="ml-1 rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">Consolidado do grupo</span>
      )}
    </div>
  );
}

function initialsOf(name: string) {
  return name
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}
