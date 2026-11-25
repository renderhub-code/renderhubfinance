import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Mail, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/os/page";
import { ClienteDialog, ComexGate } from "@/components/comex/ui";
import { grupoDaEtapa, useClientes, useComexMe, useInvalidateComex, useProcessos, xdb, type Cliente } from "@/os/comex/data";

export const Route = createFileRoute("/_authenticated/comex/clientes")({
  head: () => ({ meta: [{ title: "Clientes · Render Comex — render.os" }] }),
  component: () => <ComexGate><Clientes /></ComexGate>,
});

function Clientes() {
  const { editaClientes } = useComexMe();
  const invalidate = useInvalidateComex();
  const { data: clientes = [] } = useClientes();
  const { data: processos = [] } = useProcessos();
  const [editando, setEditando] = useState<Partial<Cliente> | null>(null);

  async function excluir(c: Cliente) {
    const n = processos.filter((p) => p.cliente_id === c.id).length;
    if (!confirm(`Excluir ${c.nome}? ${n ? `As ${n} PO(s) e o feed dele também saem. ` : ""}Não dá para desfazer.`)) return;
    const { error } = await xdb.from("cs_clientes").delete().eq("id", c.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Cliente excluído.");
    void invalidate();
  }

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        eyebrow="Render Comex · Operacional"
        title="Clientes do follow-up"
        description="Quem acompanha as importações pelo portal e com quais e-mails."
        actions={editaClientes && <Button size="sm" onClick={() => setEditando({ empresa: "render" })}><Plus className="mr-1.5 h-4 w-4" />Novo cliente</Button>}
      />
      <div className="overflow-hidden rounded-xl border bg-background">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">Cliente</th>
              <th className="px-4 py-2.5 font-medium">Responsáveis</th>
              <th className="px-4 py-2.5 font-medium">Acesso ao portal</th>
              <th className="px-4 py-2.5 text-right font-medium">POs ativas</th>
              <th className="w-24" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {clientes.map((c) => {
              const ps = processos.filter((p) => p.cliente_id === c.id);
              const ativos = ps.filter((p) => p.etapa !== "entregue");
              const porto = ativos.filter((p) => grupoDaEtapa(p.etapa) === "porto").length;
              return (
                <tr key={c.id} className="align-top">
                  <td className="px-4 py-3 font-medium">{c.nome}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    <div>Comercial: {c.comercial_responsavel || "—"}</div>
                    <div>CS: {c.cs_responsavel || "—"}</div>
                  </td>
                  <td className="px-4 py-3">
                    {c.emails.length ? (
                      <ul className="space-y-0.5 text-xs">{c.emails.map((e) => <li key={e} className="flex items-center gap-1.5"><Mail className="h-3 w-3 text-muted-foreground" />{e}</li>)}</ul>
                    ) : <span className="text-xs text-amber-700">Sem e-mail — o cliente ainda não entra no portal</span>}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{ativos.length}{porto ? <span className="block text-xs text-muted-foreground">{porto} no porto</span> : null}</td>
                  <td className="px-4 py-3 text-right">
                    {editaClientes && <button type="button" className="p-1 text-muted-foreground hover:text-foreground" aria-label="Editar" onClick={() => setEditando(c)}><Pencil className="h-4 w-4" /></button>}
                    {editaClientes && <button type="button" className="p-1 text-muted-foreground hover:text-destructive" aria-label="Excluir" onClick={() => void excluir(c)}><Trash2 className="h-4 w-4" /></button>}
                  </td>
                </tr>
              );
            })}
            {!clientes.length && <tr><td colSpan={5} className="py-12 text-center text-muted-foreground">Nenhum cliente ainda.</td></tr>}
          </tbody>
        </table>
      </div>
      {editando && <ClienteDialog value={editando} onClose={() => setEditando(null)} />}
    </div>
  );
}
