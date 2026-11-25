import { useState, type ReactNode } from "react";
import { AlertTriangle, Anchor, DatabaseZap, Loader2, Lock, Ship } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ETAPAS, diasAte, etapaIndex, etapaLabel, fmtData, useComexMe, useInvalidateComex, xdb,
  type Cliente, type Etapa, type Processo,
} from "@/os/comex/data";
import { cn } from "@/lib/utils";

/** Porta de entrada das telas da equipe do follow-up. */
export function ComexGate({ children, adminOnly }: { children: ReactNode; adminOnly?: boolean }) {
  const { loading, membro, erro, isAdmin } = useComexMe();
  if (loading) return <div className="grid min-h-[40vh] place-items-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  if (erro) {
    return (
      <Notice icon={DatabaseZap} title="O follow-up da Render Comex ainda não está no banco">
        Rode o SQL <code className="rounded bg-muted px-1">acesso_e_followup_comex</code> no SQL Editor do Supabase e recarregue a página.
        <span className="mt-2 block text-xs opacity-70">Detalhe: {erro}</span>
      </Notice>
    );
  }
  if (!membro) return <Notice icon={Lock} title="Você ainda não faz parte da equipe do follow-up">Peça a um administrador para liberar você em <b>Operacional › Equipe</b>.</Notice>;
  if (adminOnly && !isAdmin) return <Notice icon={Lock} title="Área de administradores">Somente administradores do follow-up acessam esta tela.</Notice>;
  return <>{children}</>;
}

export function Notice({ icon: Icon, title, children }: { icon: typeof Lock; title: string; children: ReactNode }) {
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

export function EtapaPill({ e }: { e: Etapa }) {
  const i = etapaIndex(e);
  const tone = e === "entregue" ? "bg-emerald-50 text-emerald-700 ring-emerald-600/15"
    : i >= 4 ? "bg-amber-50 text-amber-800 ring-amber-600/20"
    : i >= 2 ? "bg-blue-50 text-blue-700 ring-blue-600/15"
    : "bg-zinc-100 text-zinc-600 ring-zinc-500/15";
  return <span className={cn("inline-flex whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset", tone)}>{etapaLabel(e)}</span>;
}

/** Cartão de um processo com a linha do tempo das 7 etapas. Usado na equipe e no portal. */
export function ProcessoCard({ p, novo, onEdit, clienteNome }: { p: Processo; novo?: boolean; onEdit?: () => void; clienteNome?: string }) {
  const idx = etapaIndex(p.etapa);
  const dias = p.chegada_prevista ? diasAte(p.chegada_prevista) : null;
  const entregue = p.etapa === "entregue";
  return (
    <article className="rounded-xl border bg-background p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-medium text-brand-blue">PO #{p.po}</span>
            {p.invoice && <span className="font-mono text-xs text-muted-foreground">· {p.invoice}</span>}
            {clienteNome && <span className="text-xs text-muted-foreground">· {clienteNome}</span>}
            {novo && <span className="rounded-full bg-brand-blue/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-brand-blue">Atualizado</span>}
          </div>
          <h3 className="mt-1 break-words text-base font-semibold">{p.mercadoria}</h3>
          {p.container && <p className="mt-0.5 flex items-center gap-1.5 font-mono text-xs text-muted-foreground"><Ship className="h-3.5 w-3.5" /> {p.container}</p>}
        </div>
        <div className="flex items-start gap-3">
          {dias !== null && !entregue && (
            <div className="text-right">
              <div className="font-display text-3xl font-semibold leading-none tabular-nums text-brand-blue">{dias > 0 ? dias : dias === 0 ? "Hoje" : "✓"}</div>
              <div className="mt-1 text-xs text-muted-foreground">{dias > 0 ? "dias para chegar" : dias === 0 ? "chegada prevista" : `chegou ${fmtData(p.chegada_prevista)}`}</div>
            </div>
          )}
          {onEdit && <Button size="sm" variant="outline" onClick={onEdit}>Atualizar</Button>}
        </div>
      </div>

      <ol className="mt-5 grid grid-cols-7 gap-1" aria-label="Etapas">
        {ETAPAS.map((st, i) => (
          <li key={st.key} className="flex flex-col gap-1.5">
            <div className={cn("relative h-1.5 rounded-full", i < idx ? "bg-brand-blue" : i === idx ? "bg-amber-400" : "bg-muted")}>
              {i === idx && !entregue && <span className="absolute -top-1 right-0 h-3.5 w-3.5 animate-pulse rounded-full bg-amber-400" />}
            </div>
            <span className={cn("hidden text-[10px] leading-tight sm:block", i === idx ? "font-semibold text-foreground" : "text-muted-foreground")}>{st.label}</span>
          </li>
        ))}
      </ol>
      <p className="mt-2 text-xs font-semibold sm:hidden">{etapaLabel(p.etapa)}</p>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div><dt className="text-xs text-muted-foreground">Embarque</dt><dd className="font-medium">{fmtData(p.data_embarque)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Chegada prevista</dt><dd className="flex items-center gap-1 font-medium"><Anchor className="h-3.5 w-3.5" />{fmtData(p.chegada_prevista)}</dd></div>
      </dl>

      {p.status_texto && <p className="mt-4 text-sm leading-relaxed text-foreground/80">{p.status_texto}</p>}
      {p.pendencia && (
        <div className="mt-4 flex items-start gap-2 rounded-r-md border-l-2 border-amber-400 bg-amber-50 p-3 text-sm text-amber-950">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div><span className="font-semibold">Ação do cliente: </span>{p.pendencia}</div>
        </div>
      )}
    </article>
  );
}

function Field({ label, full, children }: { label: string; full?: boolean; children: ReactNode }) {
  return <div className={cn("min-w-0 space-y-1.5", full && "sm:col-span-2")}><Label className="text-xs">{label}</Label>{children}</div>;
}

/** Cria/edita uma PO. Ao mudar a etapa (ou escrever uma nota) publica no feed do cliente. */
export function ProcessoDialog({ value, clientes, onClose }: { value: Partial<Processo>; clientes: Cliente[]; onClose: () => void }) {
  const invalidate = useInvalidateComex();
  const [f, setF] = useState<Partial<Processo>>(value);
  const [nota, setNota] = useState("");
  const [salvando, setSalvando] = useState(false);
  const set = (k: keyof Processo) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value || null });

  async function salvar() {
    if (!f.cliente_id || !f.po || !f.mercadoria) { toast.error("Preencha cliente, PO e mercadoria."); return; }
    setSalvando(true);
    const row = {
      cliente_id: f.cliente_id, po: f.po.trim(), mercadoria: f.mercadoria.trim(), invoice: f.invoice ?? null,
      container: f.container ?? null, data_embarque: f.data_embarque ?? null, chegada_prevista: f.chegada_prevista ?? null,
      etapa: (f.etapa ?? "pedido") as Etapa, status_texto: f.status_texto ?? null, pendencia: f.pendencia ?? null,
    };
    const res = f.id
      ? await xdb.from("cs_processos").update(row).eq("id", f.id).select().single()
      : await xdb.from("cs_processos").insert(row).select().single();
    if (res.error) { setSalvando(false); toast.error(res.error.message); return; }
    const mudouEtapa = value.etapa !== row.etapa;
    const msg = nota.trim() || (mudouEtapa ? `Etapa atualizada: ${etapaLabel(row.etapa)}.${row.status_texto ? " " + row.status_texto : ""}` : "");
    if (msg) {
      const fe = await xdb.from("cs_atualizacoes").insert({ processo_id: res.data.id, cliente_id: row.cliente_id, mensagem: msg });
      if (fe.error) toast.error(`PO salva, mas o feed falhou: ${fe.error.message}`);
    }
    setSalvando(false);
    toast.success("Salvo — o cliente já vê a atualização.");
    void invalidate();
    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader><DialogTitle>{f.id ? `PO ${f.po}` : "Nova PO"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Cliente" full>
            <Select value={f.cliente_id ?? ""} onValueChange={(v) => setF({ ...f, cliente_id: v })} disabled={!!f.id}>
              <SelectTrigger><SelectValue placeholder="Escolha o cliente" /></SelectTrigger>
              <SelectContent>{clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="PO #"><Input value={f.po ?? ""} onChange={set("po")} /></Field>
          <Field label="Proforma / Invoice"><Input value={f.invoice ?? ""} onChange={set("invoice")} /></Field>
          <Field label="Mercadoria" full><Input value={f.mercadoria ?? ""} onChange={set("mercadoria")} /></Field>
          <Field label="Container"><Input value={f.container ?? ""} onChange={set("container")} /></Field>
          <Field label="Etapa">
            <Select value={f.etapa ?? "pedido"} onValueChange={(v) => setF({ ...f, etapa: v as Etapa })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{ETAPAS.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Data de embarque"><Input type="date" value={f.data_embarque ?? ""} onChange={set("data_embarque")} /></Field>
          <Field label="Chegada prevista"><Input type="date" value={f.chegada_prevista ?? ""} onChange={set("chegada_prevista")} /></Field>
          <Field label="Status (o cliente vê)" full><Textarea rows={3} value={f.status_texto ?? ""} onChange={set("status_texto")} /></Field>
          <Field label="Pendência do cliente (vazio se não houver)" full><Input value={f.pendencia ?? ""} onChange={set("pendencia")} /></Field>
          <Field label="Mensagem no feed (opcional)" full><Textarea rows={2} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ex.: Navio atracou em Suape." /></Field>
        </div>
        <Button onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : "Salvar e publicar"}</Button>
      </DialogContent>
    </Dialog>
  );
}

/** Cria/edita um cliente e os e-mails que entram no portal. */
export function ClienteDialog({ value, onClose, onSaved }: { value: Partial<Cliente>; onClose: () => void; onSaved?: (id: string) => void }) {
  const invalidate = useInvalidateComex();
  const [f, setF] = useState<Partial<Cliente>>(value);
  const [emails, setEmails] = useState((value.emails ?? []).join(", "));
  async function salvar() {
    if (!f.nome?.trim()) { toast.error("Informe o nome."); return; }
    const lista = emails.split(/[,;\s]+/).map((e) => e.trim().toLowerCase()).filter(Boolean);
    const invalido = lista.find((e) => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));
    if (invalido) { toast.error(`E-mail inválido: ${invalido}`); return; }
    const row = { nome: f.nome.trim(), empresa: f.empresa ?? "render", comercial_responsavel: f.comercial_responsavel || null, cs_responsavel: f.cs_responsavel || null, emails: lista };
    const res = f.id
      ? await xdb.from("cs_clientes").update(row).eq("id", f.id).select().single()
      : await xdb.from("cs_clientes").insert(row).select().single();
    if (res.error) { toast.error(res.error.message); return; }
    toast.success("Cliente salvo.");
    void invalidate();
    onSaved?.(res.data.id);
    onClose();
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{f.id ? "Editar cliente" : "Novo cliente"}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <Field label="Nome"><Input value={f.nome ?? ""} onChange={(e) => setF({ ...f, nome: e.target.value })} /></Field>
          <Field label="Comercial (quem captou)"><Input value={f.comercial_responsavel ?? ""} onChange={(e) => setF({ ...f, comercial_responsavel: e.target.value })} /></Field>
          <Field label="Customer Success (quem acompanha)"><Input value={f.cs_responsavel ?? ""} onChange={(e) => setF({ ...f, cs_responsavel: e.target.value })} /></Field>
          <Field label="E-mails do cliente com acesso ao portal (separe por vírgula)">
            <Textarea rows={2} value={emails} onChange={(e) => setEmails(e.target.value)} placeholder="compras@cliente.com.br, diretor@cliente.com.br" />
          </Field>
          <p className="text-xs text-muted-foreground">O cliente entra em <b>{typeof window !== "undefined" ? window.location.origin : ""}/portal</b> criando conta com um desses e-mails (ou com o Google). Ele vê só os processos dele.</p>
        </div>
        <Button onClick={salvar}>Salvar</Button>
      </DialogContent>
    </Dialog>
  );
}
