import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/** Cabeçalho padrão de página do render.os (título + ação à direita + divisória). */
export function PageHeader({
  eyebrow, title, description, actions,
}: {
  eyebrow?: string; title: string; description?: string; actions?: ReactNode;
}) {
  return (
    <header className="mb-8 flex items-start gap-4 border-b pb-6">
      <div className="min-w-0 flex-1">
        {eyebrow && (
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-blue">{eyebrow}</div>
        )}
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

/** Seção com ícone e título, como "Change Password" / "Session History" na referência. */
export function Section({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="mb-4 flex items-center gap-2.5 text-[15px] font-semibold">
        <Icon className="h-[18px] w-[18px] text-muted-foreground" strokeWidth={1.75} />
        {title}
      </h2>
      {children}
    </section>
  );
}
