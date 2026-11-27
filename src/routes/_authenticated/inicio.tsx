import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, Building2, Boxes } from "lucide-react";
import { useCompanies } from "@/lib/queries";
import { useHubStore } from "@/lib/hub-store";
import { GROUP_COMPANIES, GROUP_OPERATIONS, companiesByOperation, type CompanyId } from "@/os/companies";
import { MODULES } from "@/os/modules";
import { WorkspaceAvatar } from "@/components/AppShell";
import { Section } from "@/components/os/page";
import { TechBackground } from "@/components/brand/TechBackground";
import { RenderMark } from "@/components/brand/Logo";
import { useAuth } from "@/hooks/use-auth";
import { spotlight } from "@/hooks/use-reveal";

export const Route = createFileRoute("/_authenticated/inicio")({
  head: () => ({ meta: [
    { title: "Início — render.os" },
    { name: "description", content: "Operações, marcas e módulos do Grupo Render Hub no render.os." },
    { property: "og:title", content: "Início — render.os" },
    { property: "og:description", content: "Operações, marcas e módulos do Grupo Render Hub no render.os." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: InicioPage,
});

function InicioPage() {
  const { data: companies } = useCompanies();
  const setHub = useHubStore((s) => s.setHub);
  const inDb = new Set((companies ?? []).map((c) => c.slug));
  const live = MODULES.filter((m) => m.status === "live" && m.id !== "inicio");
  const soon = MODULES.filter((m) => m.status === "soon");
  const { user } = useAuth();
  const name = ((user?.user_metadata?.full_name as string | undefined) ?? user?.email?.split("@")[0] ?? "").split(" ")[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const today = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="mx-auto max-w-6xl">
      <div className="relative mb-10 overflow-hidden rounded-2xl bg-[#06070a] px-7 py-8 text-white md:px-10 md:py-10">
        <TechBackground />
        <RenderMark className="pointer-events-none absolute -right-8 top-1/2 h-56 w-56 -translate-y-1/2 opacity-25 drop-shadow-[0_0_30px_rgba(76,195,255,.35)] md:right-6 md:opacity-90" />
        <div className="relative max-w-xl">
          <div className="font-mono text-[11px] uppercase tracking-[0.28em] text-[#4cc3ff]">{today}</div>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">
            {greeting}{name ? `, ${name}` : ""}.
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-white/60">
            {GROUP_OPERATIONS.length} operações e {GROUP_COMPANIES.length} marcas do Grupo Render Hub em um só lugar. Escolha uma marca ou siga para o consolidado.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link to="/dashboard" className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#06070a] transition-transform hover:scale-[1.02]">
              Abrir financeiro
            </Link>
            <span className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-white/75">
              {GROUP_OPERATIONS.length} operações · {inDb.size} de {GROUP_COMPANIES.length} marcas ativas
            </span>
          </div>
        </div>
      </div>

      <Section icon={Building2} title="Operações e marcas">
        <div className="space-y-6">
        {GROUP_OPERATIONS.map((op) => (
        <div key={op.id}>
        <h3 className="mb-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">{op.name}</h3>
        <div className="ros-stagger grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {companiesByOperation(op.id).map((c) => {
            const ready = inDb.has(c.slug);
            return (
              <button
                key={c.id}
                type="button"
                disabled={!ready}
                onClick={() => setHub(c.id as CompanyId)}
                onMouseMove={spotlight}
                className="ros-spotlight group flex flex-col gap-3 rounded-xl border bg-background p-4 text-left transition-all duration-300 hover:-translate-y-0.5 hover:border-foreground/15 hover:shadow-[0_8px_24px_rgb(0_0_0/0.06)] disabled:cursor-not-allowed disabled:opacity-60"
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
        </div>
        ))}
        </div>
      </Section>

      <Section icon={Boxes} title="Módulos">
        <div className="ros-stagger divide-y rounded-xl border">
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
