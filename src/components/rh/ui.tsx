import type { ReactNode } from "react";
import { DatabaseZap, Loader2, Lock } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Notice } from "@/components/comex/ui";
import { WorkspaceAvatar } from "@/components/AppShell";
import { getCompany, type CompanyId } from "@/os/companies";
import { nomeEmpresa, type Colaborador } from "@/os/rh/data";
import { cn } from "@/lib/utils";

export { Card, Notice } from "@/components/comex/ui";

/** Porta das telas do RH: carregando, sem acesso ou SQL ainda não rodado. */
export function RhGate({
  ver,
  loading,
  erro,
  children,
}: {
  ver: boolean;
  loading: boolean;
  erro?: unknown;
  children: ReactNode;
}) {
  if (loading)
    return (
      <div className="grid min-h-[40vh] place-items-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  if (!ver)
    return (
      <Notice icon={Lock} title="Você não tem acesso a esta aba do RH">
        Peça a um administrador para liberar em <b>Pessoas › Acessos</b>.
      </Notice>
    );
  if (erro) {
    const msg =
      erro instanceof Error
        ? erro.message
        : ((erro as { message?: string })?.message ?? String(erro));
    return (
      <Notice icon={DatabaseZap} title="O RH ainda não está no banco">
        Rode o SQL <code className="rounded bg-muted px-1">rh</code> no SQL Editor do Supabase e
        recarregue a página.
        <span className="mt-2 block text-xs opacity-70">Detalhe: {msg}</span>
      </Notice>
    );
  }
  return <>{children}</>;
}

export function Kpi({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "warn" | "bad" | "good";
}) {
  return (
    <div className="rounded-xl border bg-background p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "mt-1.5 text-2xl font-semibold tabular-nums tracking-tight",
          tone === "warn" && "text-amber-700",
          tone === "bad" && "text-red-700",
          tone === "good" && "text-emerald-700",
        )}
      >
        {value}
      </div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

export function Field({
  label,
  full,
  hint,
  children,
}: {
  label: string;
  full?: boolean;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("min-w-0 space-y-1.5", full && "sm:col-span-2")}>
      <Label className="text-xs">{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function NumInput({
  value,
  onChange,
  step = "0.01",
  ...rest
}: {
  value: number | null | undefined;
  onChange: (v: number) => void;
  step?: string;
  placeholder?: string;
  min?: number;
  max?: number;
}) {
  return (
    <Input
      type="number"
      inputMode="decimal"
      step={step}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
      {...rest}
    />
  );
}

export function EmpresaTag({ id }: { id: string }) {
  if (!getCompany(id)) return <span className="text-xs text-muted-foreground">{id}</span>;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <WorkspaceAvatar id={id as CompanyId} small />
      {nomeEmpresa(id)}
    </span>
  );
}

export function EmpresaSelect({
  value,
  onChange,
  empresas,
}: {
  value: string | undefined;
  onChange: (v: CompanyId) => void;
  empresas: CompanyId[];
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as CompanyId)}>
      <SelectTrigger>
        <SelectValue placeholder="Empresa" />
      </SelectTrigger>
      <SelectContent>
        {empresas.map((e) => (
          <SelectItem key={e} value={e}>
            {nomeEmpresa(e)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function ColabSelect({
  value,
  onChange,
  colabs,
  placeholder = "Colaborador",
}: {
  value: string | undefined | null;
  onChange: (id: string) => void;
  colabs: Colaborador[];
  placeholder?: string;
}) {
  return (
    <Select value={value ?? undefined} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {colabs.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            {c.nome}
            {c.status === "desligado" ? " (desligado)" : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function Pill({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "good" | "warn" | "bad" | "info";
  children: ReactNode;
}) {
  const t = {
    neutral: "bg-zinc-100 text-zinc-600 ring-zinc-500/15",
    good: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
    warn: "bg-amber-50 text-amber-800 ring-amber-600/20",
    bad: "bg-red-50 text-red-700 ring-red-600/15",
    info: "bg-blue-50 text-blue-700 ring-blue-600/15",
  }[tone];
  return (
    <span
      className={cn(
        "inline-flex whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
        t,
      )}
    >
      {children}
    </span>
  );
}

/** Tabela no padrão do render.os (borda, cabeçalho cinza). */
export function Tabela({
  cab,
  vazio,
  colSpan,
  children,
  className,
}: {
  cab: ReactNode;
  vazio?: string | false;
  colSpan?: number;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("overflow-x-auto rounded-xl border bg-background", className)}>
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/30 text-left text-xs text-muted-foreground [&_th]:px-4 [&_th]:py-2.5 [&_th]:font-medium [&_th]:whitespace-nowrap">
          {cab}
        </thead>
        <tbody className="divide-y [&_td]:px-4 [&_td]:py-3">
          {children}
          {vazio && (
            <tr>
              <td colSpan={colSpan} className="py-12 text-center text-muted-foreground">
                {vazio}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/** Nota de rodapé no tom do protótipo (estimativas, LGPD etc.). */
export function Nota({ children }: { children: ReactNode }) {
  return (
    <p className="mt-4 rounded-lg border border-dashed bg-muted/20 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
      {children}
    </p>
  );
}

/** Eyebrow das páginas: "Empresa · RH" ou "Grupo · RH". */
export function eyebrow(ws: string) {
  return `${ws === "grupo" ? "Grupo Render Hub" : nomeEmpresa(ws)} · RH`;
}
