import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, Building2, Boxes } from "lucide-react";
import { useCompanies } from "@/lib/queries";
import { useHubStore } from "@/lib/hub-store";
import { GROUP_COMPANIES, type CompanyId } from "@/os/companies";
import { MODULES } from "@/os/modules";
import { WorkspaceAvatar } from "@/components/AppShell";
import { PageHeader, Section } from "@/components/os/page";

export const Route = createFileRoute("/_authenticated/inicio")({
  head: () => ({ meta: [{ title: "Início — render.os" }] }),
  component: InicioPage,
});

function InicioPage() {
  const { data: companies } = useCompanies();
  const setHub = useHubStore((s) => s.setHub);
  const inDb = new Set((companies ?? []).map((c) => c.slug));
  const live = MODULES.filter((m) => m.status === "live" && m.id !== "inicio");
  const soon = MODULES.filter((m) => m.status === "soon");

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Grupo Render Hub"
        title="Visão geral"
        description="Uma marca. Vários negócios. Um só sistema."
      />

      <Section icon={Building2} title="Empresas do grupo">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {GROUP_COMPANIES.map((c) => {
            const ready = inDb.has(c.slug);
            return (
              <button
                key={c.id}
                type="button"
                disabled={!ready}
                onClick={() => setHub(c.id as CompanyId)}
                className="group flex flex-col gap-3 rounded-xl border bg-background p-4 text-left transition-colors hover:border-foreground/15 hover:bg-muted/30 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <div className="flex items-center gap-3">
                  <WorkspaceAvatar id={c.id} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{c.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{c.sector}</div>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
                <p className="text-[13px] leading-relaxed text-muted-foreground">{c.description}</p>
                <div className="flex flex-wrap gap-1.5">
                  {ready ? <Pill tone="ok">Financeiro ativo</Pill> : <Pill tone="muted">Cadastro pendente</Pill>}
                  {c.bling && <Pill tone="info">Bling</Pill>}
                </div>
              </button>
            );
          })}
        </div>
      </Section>

      <Section icon={Boxes} title="Módulos">
        <div className="divide-y rounded-xl border">
          {[...live, ...soon].map((m) => (
            <div key={m.id} className="flex items-center gap-4 px-4 py-3.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border bg-muted/40">
                <m.icon className="h-4 w-4" strokeWidth={1.75} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{m.label}</div>
                <div className="truncate text-[13px] text-muted-foreground">{m.description}</div>
              </div>
              {m.status === "live" ? (
                <Link to={m.home} className="text-sm font-medium text-primary hover:underline">Abrir</Link>
              ) : (
                <Pill tone="muted">Em breve</Pill>
              )}
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function Pill({ tone, children }: { tone: "ok" | "info" | "muted"; children: React.ReactNode }) {
  const cls = {
    ok: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
    info: "bg-sky-50 text-sky-700 ring-sky-600/15",
    muted: "bg-muted text-muted-foreground ring-border",
  }[tone];
  return <span className={`rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${cls}`}>{children}</span>;
}
