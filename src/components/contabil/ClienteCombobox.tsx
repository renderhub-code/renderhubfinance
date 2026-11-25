import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useClientes } from "@/os/contabil/hooks";
import { clienteLabel } from "@/os/contabil/db";
import { cn } from "@/lib/utils";

/** Busca de empresa cliente por razão social, fantasia, CNPJ, código ou apelido. Vazio = atividade avulsa. */
export function ClienteCombobox({ value, onChange, disabled }: { value: string; onChange: (id: string) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const { data: clientes = [], isLoading } = useClientes();
  const ativos = useMemo(() => clientes.filter((c) => c.ativo || c.id === value), [clientes, value]);
  const selected = ativos.find((c) => c.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" disabled={disabled} className="h-9 w-full justify-between font-normal">
          <span className={cn("truncate", !selected && "text-muted-foreground")}>
            {selected ? clienteLabel(selected) : isLoading ? "Carregando…" : "Avulsa (sem empresa) — busque para escolher"}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Razão social, CNPJ, código…" />
          <CommandList>
            <CommandEmpty>Nenhuma empresa encontrada.</CommandEmpty>
            <CommandGroup>
              <CommandItem value="__avulsa atividade avulsa sem empresa" onSelect={() => { onChange(""); setOpen(false); }}>
                <Check className={cn("mr-2 h-4 w-4", !value ? "opacity-100" : "opacity-0")} />
                <span className="text-muted-foreground">Avulsa (sem empresa)</span>
              </CommandItem>
              {ativos.map((c) => (
                <CommandItem
                  key={c.id}
                  value={[c.razao_social, c.nome_fantasia, c.cnpj, c.codigo_dominio, c.apelido, c.id].filter(Boolean).join(" ")}
                  onSelect={() => { onChange(c.id); setOpen(false); }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === c.id ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{clienteLabel(c)}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
