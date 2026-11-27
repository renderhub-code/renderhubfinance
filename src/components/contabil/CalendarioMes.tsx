import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DIAS_SEMANA, dataExtensa, diasDoMes, somaMeses, tituloMes } from "@/os/contabil/agenda";
import { cn } from "@/lib/utils";

/** Calendário mensal: o conteúdo e o estado de cada dia vêm de quem usa. */
export function CalendarioMes({
  mes, onMes, selecionado, onSelecionar, hoje, conteudo, desabilitado, compacto,
}: {
  mes: string; onMes: (mes: string) => void;
  selecionado: string | null; onSelecionar: (dia: string) => void;
  hoje: string;
  conteudo?: (dia: string) => ReactNode;
  desabilitado?: (dia: string) => boolean;
  compacto?: boolean;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{tituloMes(mes)}</h2>
        <div className="flex gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Mês anterior" onClick={() => onMes(somaMeses(mes, -1))}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Próximo mês" onClick={() => onMes(somaMeses(mes, 1))}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-muted-foreground">
        {DIAS_SEMANA.map((d) => <div key={d} className="py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {diasDoMes(mes).map((dia, i) => {
          if (!dia) return <div key={`v${i}`} />;
          const off = desabilitado?.(dia) ?? false;
          return (
            <button
              key={dia} type="button" disabled={off} onClick={() => onSelecionar(dia)}
              aria-label={dataExtensa(dia)} aria-pressed={selecionado === dia}
              className={cn(
                "flex flex-col items-center rounded-lg border text-sm transition-colors",
                compacto ? "aspect-square justify-center" : "min-h-[76px] justify-start gap-1 p-1.5",
                off ? "cursor-default border-transparent text-muted-foreground/40" : "border-border hover:border-primary/50 hover:bg-primary/5",
                selecionado === dia && "border-primary bg-primary/10 ring-1 ring-primary",
              )}
            >
              <span className={cn("grid h-6 w-6 place-items-center rounded-full text-[13px] tabular-nums", dia === hoje && "bg-foreground font-semibold text-background")}>
                {Number(dia.slice(8))}
              </span>
              {conteudo?.(dia)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
