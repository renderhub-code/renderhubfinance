import type { ReactNode } from "react";
import { DatabaseZap, Eye, Loader2, Lock } from "lucide-react";
import { useIaMe, STATUS_COLOR, STATUS_TONE } from "@/os/ia/data";
import { getCompany } from "@/os/companies";
import { cn } from "@/lib/utils";

export function StatusPill({ s }: { s: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset", STATUS_TONE[s] ?? STATUS_TONE.Ideia)}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: STATUS_COLOR[s] ?? STATUS_COLOR.Ideia }} />
      {s}
    </span>
  );
}

/** Siglas coloridas das empresas do grupo atendidas por uma entrega. */
export function EmpresaChips({ ids, max = 6 }: { ids: string[]; max?: number }) {
  const cs = ids.map((id) => getCompany(id)).filter(Boolean);
  if (cs.length === 6) return <span className="text-xs font-medium text-muted-foreground">Todo o grupo</span>;
  return (
    <div className="flex -space-x-1">
      {cs.slice(0, max).map((c) => (
        <span key={c!.id} title={c!.name} className="grid h-6 w-6 place-items-center rounded-full text-[9px] font-semibold text-white ring-2 ring-background" style={{ background: c!.color }}>
          {c!.initials}
        </span>
      ))}
    </div>
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{children}</label>;
}

/** Porta de entrada das telas de IA. */
export function IaGate({ children, adminOnly }: { children: ReactNode; adminOnly?: boolean }) {
  const { loading, acesso, erro, isAdmin, canEdit } = useIaMe();
  if (loading) return <div className="grid min-h-[40vh] place-items-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  if (erro) {
    return (
      <Notice icon={DatabaseZap} title="O módulo de IA ainda não está no banco">
        Rode o SQL <code className="rounded bg-muted px-1">ia_departamento</code> no SQL Editor do Supabase e recarregue a página.
        <span className="mt-2 block text-xs opacity-70">Detalhe: {erro}</span>
      </Notice>
    );
  }
  if (!acesso) {
    return <Notice icon={Lock} title="Você ainda não tem acesso ao módulo de IA">Peça a um administrador para liberar você em <b>IA › Acesso</b>.</Notice>;
  }
  if (adminOnly && !isAdmin) return <Notice icon={Lock} title="Área de administradores">Somente administradores do módulo de IA acessam esta tela.</Notice>;
  return (
    <>
      {!canEdit && (
        <div className="mb-5 flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <Eye className="h-3.5 w-3.5" /> Acesso somente leitura.
        </div>
      )}
      {children}
    </>
  );
}

function Notice({ icon: Icon, title, children }: { icon: typeof Lock; title: string; children: ReactNode }) {
  return (
    <div className="grid min-h-[50vh] place-items-center">
      <div className="max-w-md text-center">
        <span className="mx-auto mb-4 grid h-11 w-11 place-items-center rounded-full border bg-muted/40"><Icon className="h-5 w-5" strokeWidth={1.75} /></span>
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">{children}</p>
      </div>
    </div>
  );
}

export function Card({ title, sub, action, className, children }: { title: string; sub?: string; action?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <section className={cn("rounded-xl border bg-background p-5", className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Empty({ text }: { text: string }) {
  return <p className="py-8 text-center text-sm text-muted-foreground">{text}</p>;
}
