import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Cpu, ShoppingBag, Users, Workflow, Wallet, Sparkles, ShieldCheck, Zap, Layers } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { TechBackground } from "@/components/brand/TechBackground";
import { HubOrbit } from "@/components/brand/HubOrbit";
import { OsWordmark } from "@/components/brand/Logo";
import { GROUP_COMPANIES } from "@/os/companies";
import { useReveal, spotlight } from "@/hooks/use-reveal";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "render.os — Grupo Render Hub" },
      { name: "description", content: "Sistema que unifica as empresas do Grupo Render Hub: Render Comex, Union Contadores, Dom Pablyto, Nortrip, ERKS e SX Paper." },
      { property: "og:title", content: "render.os" },
      { property: "og:description", content: "Uma marca. Seis operações. Um só sistema." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Landing,
});

const MODULES: { icon: LucideIcon; title: string; desc: string; live?: boolean; wide?: boolean; full?: boolean }[] = [
  { icon: Wallet, title: "Financeiro", desc: "Lançamentos, fluxo de caixa realizado e previsto, DRE e simulações — por empresa ou consolidado.", live: true, wide: true },
  { icon: ShoppingBag, title: "Comercial", desc: "Pedidos, clientes e faturamento contra a meta." },
  { icon: Workflow, title: "Operacional", desc: "O dia a dia de cada empresa: tarefas contábeis da Union hoje, processos de importação da Render Comex em seguida.", live: true, wide: true },
  { icon: Users, title: "Pessoas", desc: "Times, acessos e permissões por empresa." },
  { icon: Cpu, title: "Inteligência", desc: "IA lendo os números do grupo e apontando o que mudou.", full: true },
];

function Landing() {
  useReveal();
  const marquee = [...GROUP_COMPANIES, ...GROUP_COMPANIES];

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#06070a] text-white selection:bg-[#4cc3ff]/30">
      {/* ===== Hero ===== */}
      <section className="relative">
        <TechBackground />

        <header className="relative z-10 mx-auto flex h-20 max-w-7xl items-center px-6">
          <OsWordmark tone="dark" />
          <nav className="ml-10 hidden gap-7 text-sm text-white/55 md:flex">
            <a href="#plataforma" className="transition-colors hover:text-white">Plataforma</a>
            <a href="#empresas" className="transition-colors hover:text-white">Empresas</a>
            <a href="#modulos" className="transition-colors hover:text-white">Módulos</a>
          </nav>
          <Link
            to="/auth"
            className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium backdrop-blur transition-colors hover:bg-white/10"
          >
            Entrar <ArrowRight className="h-4 w-4" />
          </Link>
        </header>

        <div className="relative z-10 mx-auto grid max-w-7xl items-center gap-10 px-6 pb-24 pt-10 lg:grid-cols-[1.05fr_1fr] lg:pt-16">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/70 backdrop-blur" style={{ animation: "ros-fade-up .7s ease-out .1s both" }}>
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-[#4cc3ff]" style={{ animation: "ros-ping 1.8s cubic-bezier(0,0,.2,1) infinite" }} />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#4cc3ff]" />
              </span>
              Sistema operacional do Grupo Render Hub
            </div>

            <h1 className="mt-7 font-display text-[44px] font-semibold leading-[1.04] tracking-[-0.02em] sm:text-6xl lg:text-[68px]" style={{ animation: "ros-fade-up .8s cubic-bezier(.2,.7,.2,1) .2s both" }}>
              Uma marca.<br />
              Seis operações.<br />
              <span className="ros-gradient-text">Um só sistema.</span>
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/60" style={{ animation: "ros-fade-up .8s ease-out .35s both" }}>
              O render.os conecta finanças, comercial, comex e contabilidade das empresas do grupo
              em uma única plataforma — com dados em tempo real e inteligência sobre cada número.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3" style={{ animation: "ros-fade-up .8s ease-out .5s both" }}>
              <Link
                to="/auth"
                className="group relative inline-flex items-center gap-2 overflow-hidden rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#06070a] shadow-[0_0_40px_rgba(76,195,255,.35)] transition-transform hover:scale-[1.02]"
              >
                Acessar o render.os
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <a href="#modulos" className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-medium text-white/75 transition-colors hover:text-white">
                Conhecer os módulos
              </a>
            </div>

            <div className="mt-12 flex items-center gap-6 font-mono text-[11px] uppercase tracking-[0.2em] text-white/35" style={{ animation: "ros-fade-in 1s ease-out .8s both" }}>
              <span>Recife — PE</span>
              <span className="h-px w-8 bg-white/20" />
              <span>2026</span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[560px]" style={{ animation: "ros-fade-in 1.4s ease-out .3s both" }}>
            <HubOrbit />
          </div>
        </div>
      </section>

      {/* ===== Números ===== */}
      <section id="plataforma" className="relative z-10 border-y border-white/[0.06] bg-white/[0.015]">
        <div className="mx-auto grid max-w-7xl grid-cols-2 divide-white/[0.06] px-6 md:grid-cols-4 md:divide-x">
          {[
            ["6", "empresas conectadas"],
            ["6", "setores de atuação"],
            ["1", "plataforma compartilhada"],
            ["1", "login para tudo"],
          ].map(([n, l], i) => (
            <div key={l} className="ros-reveal px-2 py-10 md:px-8" style={{ transitionDelay: `${i * 80}ms` }}>
              <div className={cn("font-display text-4xl font-semibold tracking-tight", i % 2 ? "text-[#e0337e]" : "text-[#4cc3ff]")}>{n}</div>
              <div className="mt-1 text-sm text-white/50">{l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ===== Empresas (marquee) ===== */}
      <section id="empresas" className="relative z-10 py-24">
        <div className="ros-reveal mx-auto max-w-7xl px-6">
          <Eyebrow>O ecossistema</Eyebrow>
          <h2 className="mt-3 max-w-2xl font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Cada empresa com a sua marca. Todas no mesmo sistema.
          </h2>
        </div>
        <div className="relative mt-12 overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_12%,#000_88%,transparent)]">
          <div className="flex w-max gap-4" style={{ animation: "ros-marquee 38s linear infinite" }}>
            {marquee.map((c, i) => (
              <div key={`${c.id}-${i}`} className="flex w-[300px] shrink-0 items-start gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
                {c.mark ? <img src={c.mark} alt="" className="h-10 w-10 shrink-0 rounded-xl" /> : <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-xs font-semibold" style={{ backgroundColor: c.color }}>{c.initials}</span>}
                <div className="min-w-0">
                  <div className="font-medium">{c.name}</div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#4cc3ff]/80">{c.sector}</div>
                  <p className="mt-2 text-[13px] leading-relaxed text-white/50">{c.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Módulos (bento) ===== */}
      <section id="modulos" className="relative z-10 mx-auto max-w-7xl px-6 pb-24">
        <div className="ros-reveal">
          <Eyebrow>Módulos</Eyebrow>
          <h2 className="mt-3 max-w-2xl font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Tudo o que o grupo opera, em módulos que conversam entre si.
          </h2>
        </div>
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {MODULES.map((m, i) => (
            <div
              key={m.title}
              onMouseMove={spotlight}
              className={cn(
                "ros-reveal ros-spotlight group overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.025] p-6 transition-colors hover:border-white/15",
                m.wide && "md:col-span-2",
                m.full && "md:col-span-3",
              )}
              style={{ transitionDelay: `${(i % 3) * 90}ms` }}
            >
              <div className="flex items-center justify-between">
                <span className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.04]">
                  <m.icon className="h-[18px] w-[18px] text-white/85" strokeWidth={1.75} />
                </span>
                <span className={cn(
                  "rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.16em]",
                  m.live ? "bg-emerald-400/10 text-emerald-300" : "bg-white/[0.05] text-white/40",
                )}>
                  {m.live ? "● ativo" : "em breve"}
                </span>
              </div>
              <h3 className="mt-6 text-lg font-semibold">{m.title}</h3>
              <p className="mt-1.5 max-w-md text-sm leading-relaxed text-white/50">{m.desc}</p>
              {m.title === "Financeiro" && <MiniChart />}
              {m.title === "Inteligência" && <AiLine />}
            </div>
          ))}
        </div>
      </section>

      {/* ===== Pilares ===== */}
      <section className="relative z-10 mx-auto max-w-7xl px-6 pb-28">
        <div className="grid gap-8 md:grid-cols-3">
          {[
            { icon: Layers, t: "Um só lugar", d: "Seis operações, um login, um padrão. Sem planilhas soltas entre empresas." },
            { icon: Zap, t: "Tempo real", d: "Integração com o Bling e sincronização automática do caixa e das contas." },
            { icon: ShieldCheck, t: "Acesso por empresa", d: "Cada pessoa vê o que precisa: por empresa, unidade ou consolidado." },
          ].map((p, i) => (
            <div key={p.t} className="ros-reveal border-t border-white/10 pt-6" style={{ transitionDelay: `${i * 90}ms` }}>
              <p.icon className="h-5 w-5 text-[#4cc3ff]" strokeWidth={1.75} />
              <div className="mt-4 font-medium">{p.t}</div>
              <p className="mt-1.5 text-sm leading-relaxed text-white/50">{p.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== CTA final ===== */}
      <section className="relative z-10 mx-auto max-w-7xl px-6 pb-20">
        <div className="ros-reveal relative overflow-hidden rounded-3xl border border-white/10 px-8 py-16 text-center">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(76,195,255,.18),transparent_60%),radial-gradient(ellipse_at_bottom_right,rgba(224,51,126,.18),transparent_55%)]" />
          <div className="relative">
            <Sparkles className="mx-auto h-6 w-6 text-[#4cc3ff]" strokeWidth={1.75} />
            <h2 className="mx-auto mt-5 max-w-2xl font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              Um só interlocutor. <span className="ros-gradient-text">Seis operações por trás.</span>
            </h2>
            <Link
              to="/auth"
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#06070a] transition-transform hover:scale-[1.02]"
            >
              Entrar no render.os <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <footer className="relative z-10 border-t border-white/[0.06]">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-6 py-8 text-xs text-white/40">
          <OsWordmark tone="dark" size="sm" />
          <span className="ml-auto font-mono uppercase tracking-[0.2em]">Grupo Render Hub · Recife — PE</span>
        </div>
      </footer>
    </div>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-[#4cc3ff]">{children}</div>;
}

/** Barras que "crescem" — sugestão visual do fluxo de caixa. */
function MiniChart() {
  const bars = [38, 52, 44, 63, 58, 71, 66, 80, 74, 88, 83, 96];
  return (
    <div className="mt-8 flex h-24 items-end gap-1.5">
      {bars.map((h, i) => (
        <div
          key={i}
          className="flex-1 origin-bottom rounded-t-md bg-gradient-to-t from-[#1a9bd7]/30 to-[#4cc3ff]"
          style={{ height: `${h}%`, animation: `ros-bar 1s cubic-bezier(.2,.8,.2,1) ${0.3 + i * 0.06}s both` }}
        />
      ))}
    </div>
  );
}

function AiLine() {
  return (
    <div className="mt-7 rounded-xl border border-white/[0.08] bg-black/30 p-4 font-mono text-[12px] leading-relaxed text-white/60">
      <span className="mb-1 block text-[10px] uppercase tracking-[0.2em] text-white/30">exemplo</span><span className="text-[#e0337e]">›</span> Receita da Dom Pablyto subiu <span className="text-emerald-300">+12%</span> no mês;
      despesas da Nortrip acima da média em <span className="text-[#4cc3ff]">hospedagem</span>.
      <span className="ml-0.5 inline-block h-3.5 w-1.5 translate-y-0.5 bg-[#4cc3ff]" style={{ animation: "ros-fade-in .8s steps(2) infinite alternate" }} />
    </div>
  );
}
