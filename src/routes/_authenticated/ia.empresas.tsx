import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/os/page";
import { IaGate, StatusPill } from "@/components/ia/ui";
import { brl, ganhoPorEmpresa, useSolucoes } from "@/os/ia/data";
import { GROUP_COMPANIES, getOperation } from "@/os/companies";

export const Route = createFileRoute("/_authenticated/ia/empresas")({
  head: () => ({ meta: [{ title: "Por marca · IA — render.os" }] }),
  component: () => <IaGate><PorEmpresa /></IaGate>,
});

function PorEmpresa() {
  const { data: solucoes = [] } = useSolucoes();
  const por = ganhoPorEmpresa(solucoes);

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader eyebrow="Departamento de IA" title="Por marca" description="O que a IA entrega para cada marca do grupo e quanto rende por mês." />
      <div className="ros-stagger grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {GROUP_COMPANIES.map((c) => {
          const sols = solucoes.filter((s) => s.empresas.includes(c.id));
          const prod = sols.filter((s) => s.status === "Produção").length;
          return (
            <section key={c.id} className="rounded-xl border bg-background p-5">
              <header className="mb-4 flex items-center gap-3">
                {c.mark ? <img src={c.mark} alt="" className="h-10 w-10 shrink-0 rounded-lg" /> : <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-xs font-semibold text-white" style={{ background: c.color }}>{c.initials}</span>}
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{c.name}</div>
                  <div className="text-xs text-muted-foreground">{getOperation(c.operation)?.name} · {sols.length} entrega(s) · {prod} em produção</div>
                </div>
                <div className="text-right">
                  <div className="font-display font-semibold tabular-nums">{brl(por[c.id] ?? 0)}</div>
                  <div className="text-[11px] text-muted-foreground">por mês</div>
                </div>
              </header>
              <ul className="divide-y text-sm">
                {sols.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2 py-2">
                    <span className="truncate">{s.titulo}</span>
                    <StatusPill s={s.status} />
                  </li>
                ))}
                {!sols.length && <li className="py-2 text-muted-foreground">Nenhuma entrega ainda.</li>}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
