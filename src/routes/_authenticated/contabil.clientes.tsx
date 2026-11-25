import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Building2, Pencil, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader } from "@/components/os/page";
import { ContabilGate, FieldLabel } from "@/components/contabil/ui";
import { useAtividades, useClientes, useContabilMe, useInvalidateContabil } from "@/os/contabil/hooks";
import { cdb, norm, statusEfetivo, type Cliente } from "@/os/contabil/db";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/contabil/clientes")({
  head: () => ({ meta: [{ title: "Empresas clientes · Contábil — render.os" }] }),
  component: () => <ContabilGate><Clientes /></ContabilGate>,
});

function Clientes() {
  const { isAdmin } = useContabilMe();
  const { data: clientes = [], isLoading } = useClientes();
  const { data: atividades = [] } = useAtividades();
  const [busca, setBusca] = useState("");
  const [inativos, setInativos] = useState(false);
  const [editing, setEditing] = useState<Cliente | "novo" | null>(null);

  const abertas = useMemo(() => {
    const m = new Map<string, number>();
    atividades.forEach((a) => {
      if (a.cliente_id && statusEfetivo(a.status, a.prazo) !== "concluido") m.set(a.cliente_id, (m.get(a.cliente_id) ?? 0) + 1);
    });
    return m;
  }, [atividades]);

  const lista = useMemo(() => {
    const q = norm(busca);
    const qd = busca.replace(/\D/g, "");
    return clientes.filter((c) => {
      if (!inativos && !c.ativo) return false;
      if (!q) return true;
      const hay = norm([c.razao_social, c.nome_fantasia, c.apelido, c.codigo_dominio, c.grupo_economico, c.cidade].join(" "));
      return hay.includes(q) || (!!qd && (c.cnpj ?? "").replace(/\D/g, "").includes(qd));
    });
  }, [clientes, busca, inativos]);

  return (
    <div className="mx-auto max-w-[1300px]">
      <PageHeader
        eyebrow="Contábil"
        title="Empresas clientes"
        description={`${clientes.filter((c) => c.ativo).length} empresa(s) ativa(s) na carteira da Union`}
        actions={isAdmin && <Button onClick={() => setEditing("novo")}><Plus className="mr-1.5 h-4 w-4" /> Nova empresa</Button>}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="h-9 pl-8" placeholder="Razão social, CNPJ, código, apelido…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground"><Switch checked={inativos} onCheckedChange={setInativos} /> Mostrar inativas</label>
        <span className="ml-auto text-xs text-muted-foreground">{lista.length} resultado(s)</span>
      </div>

      <div className="overflow-hidden rounded-xl border">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
              <tr>
                {["Empresa", "CNPJ", "Cód. Domínio", "Regime", "Cidade/UF", "Em aberto", ""].map((h) => <th key={h} className="px-3 py-2.5 font-medium">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading && <tr><td colSpan={7} className="py-10 text-center text-muted-foreground">Carregando…</td></tr>}
              {!isLoading && lista.length === 0 && (
                <tr><td colSpan={7} className="py-14 text-center">
                  <Building2 className="mx-auto mb-2 h-6 w-6 text-muted-foreground/60" />
                  <div className="text-sm text-muted-foreground">{clientes.length ? "Nenhuma empresa encontrada." : "Nenhuma empresa cadastrada ainda."}</div>
                </td></tr>
              )}
              {lista.slice(0, 500).map((c) => (
                <tr key={c.id} className={cn("hover:bg-muted/20", !c.ativo && "opacity-50")}>
                  <td className="max-w-[340px] px-3 py-2.5">
                    <div className="line-clamp-1 font-medium">{c.razao_social}</div>
                    {(c.nome_fantasia || c.apelido) && <div className="line-clamp-1 text-xs text-muted-foreground">{[c.nome_fantasia, c.apelido].filter(Boolean).join(" · ")}</div>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs">{c.cnpj ?? "—"}</td>
                  <td className="px-3 py-2.5 text-[13px]">{c.codigo_dominio ?? "—"}</td>
                  <td className="px-3 py-2.5 text-[13px]">{c.regime ?? "—"}</td>
                  <td className="px-3 py-2.5 text-[13px]">{[c.cidade, c.uf].filter(Boolean).join("/") || "—"}</td>
                  <td className="px-3 py-2.5">
                    {abertas.get(c.id)
                      ? <Link to="/contabil/atividades" search={{ cliente: c.id }} className="text-[13px] font-medium text-primary hover:underline">{abertas.get(c.id)}</Link>
                      : <span className="text-[13px] text-muted-foreground">0</span>}
                  </td>
                  <td className="px-2 py-2 text-right">
                    {isAdmin && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditing(c)} aria-label="Editar"><Pencil className="h-4 w-4" /></Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {lista.length > 500 && <p className="border-t px-3 py-2 text-xs text-muted-foreground">Mostrando 500 de {lista.length}. Refine a busca.</p>}
      </div>

      {editing && <ClienteDialog cliente={editing === "novo" ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

const CAMPOS: { k: keyof Cliente; label: string; span?: boolean }[] = [
  { k: "razao_social", label: "Razão social", span: true },
  { k: "nome_fantasia", label: "Nome fantasia" },
  { k: "apelido", label: "Apelido" },
  { k: "cnpj", label: "CNPJ" },
  { k: "codigo_dominio", label: "Código Domínio" },
  { k: "grupo_economico", label: "Grupo econômico" },
  { k: "regime", label: "Regime tributário" },
  { k: "segmento", label: "Segmento" },
  { k: "cidade", label: "Cidade" },
  { k: "uf", label: "UF" },
];

function ClienteDialog({ cliente, onClose }: { cliente: Cliente | null; onClose: () => void }) {
  const invalidate = useInvalidateContabil();
  const [form, setForm] = useState<Record<string, string>>(
    Object.fromEntries(CAMPOS.map(({ k }) => [k, String(cliente?.[k] ?? "")])),
  );
  const [ativo, setAtivo] = useState(cliente?.ativo ?? true);
  const [saving, setSaving] = useState(false);

  async function salvar() {
    setSaving(true);
    const payload: Record<string, unknown> = { ativo };
    CAMPOS.forEach(({ k }) => { payload[k] = form[k].trim() || null; });
    if (payload.uf) payload.uf = String(payload.uf).toUpperCase().slice(0, 2);
    const { error } = cliente
      ? await cdb.from("contabil_clientes").update(payload).eq("id", cliente.id)
      : await cdb.from("contabil_clientes").insert(payload);
    setSaving(false);
    if (error) {
      toast.error(error.code === "23505" ? "Já existe uma empresa com esse CNPJ." : error.message);
      return;
    }
    toast.success(cliente ? "Empresa atualizada." : "Empresa cadastrada.");
    invalidate();
    onClose();
  }

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle className="text-base">{cliente ? "Editar empresa" : "Nova empresa"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          {CAMPOS.map(({ k, label, span }) => (
            <div key={k} className={cn(span && "col-span-2")}>
              <FieldLabel>{label}</FieldLabel>
              <Input className="h-9" value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
            </div>
          ))}
          <label className="col-span-2 flex items-center gap-2 text-sm"><Switch checked={ativo} onCheckedChange={setAtivo} /> Empresa ativa</label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={salvar} disabled={saving || !form.razao_social.trim()}>{saving ? "Salvando…" : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
