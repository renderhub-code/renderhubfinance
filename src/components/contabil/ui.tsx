import type { ReactNode } from "react";
import { Loader2, Lock, DatabaseZap } from "lucide-react";
import { useContabilMe } from "@/os/contabil/hooks";
import { PRIORIDADE_LABEL, PRIORIDADE_TONE, STATUS_LABEL, STATUS_TONE, type Status } from "@/os/contabil/db";
import { cn } from "@/lib/utils";

export function StatusPill({ status }: { status: Status }) {
  return (
    <span className={cn("inline-flex items-center whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset", STATUS_TONE[status])}>
      {STATUS_LABEL[status]}
    </span>
  );
}

export function PrioridadePill({ p, long }: { p: number; long?: boolean }) {
  return (
    <span className={cn("inline-flex items-center whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset", PRIORIDADE_TONE[p])}>
      P{p}{long ? ` · ${PRIORIDADE_LABEL[p]}` : ""}
    </span>
  );
}

/**
 * Porta de entrada das telas do Contábil: espera o perfil, explica quando as
 * tabelas ainda não existem, quando a pessoa não está na equipe ou não é admin.
 */
export function ContabilGate({ children, adminOnly }: { children: ReactNode; adminOnly?: boolean }) {
  const { loading, membro, erro, isAdmin } = useContabilMe();
  if (loading) {
    return <div className="grid min-h-[40vh] place-items-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }
  if (erro) {
    return (
      <Notice icon={DatabaseZap} title="O módulo Contábil ainda não está no banco">
        Rode o SQL <code className="rounded bg-muted px-1">contabil_tarefas</code> no SQL Editor do Supabase e recarregue a página.
        <span className="mt-2 block text-xs opacity-70">Detalhe: {erro}</span>
      </Notice>
    );
  }
  if (!membro) {
    return (
      <Notice icon={Lock} title="Você ainda não tem acesso ao Operacional da Union">
        Peça a um administrador do render.os para liberar em <b>Pessoas › Acessos</b> (empresa Union Contadores). O setor e o papel se ajustam depois em <b>Equipe</b>.
      </Notice>
    );
  }
  if (adminOnly && !isAdmin) {
    return <Notice icon={Lock} title="Área de administradores">Somente administradores do Contábil acessam esta tela.</Notice>;
  }
  return <>{children}</>;
}

function Notice({ icon: Icon, title, children }: { icon: typeof Lock; title: string; children: ReactNode }) {
  return (
    <div className="grid min-h-[50vh] place-items-center">
      <div className="max-w-md text-center">
        <span className="mx-auto mb-4 grid h-11 w-11 place-items-center rounded-full border bg-muted/40">
          <Icon className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">{children}</p>
      </div>
    </div>
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{children}</label>;
}
