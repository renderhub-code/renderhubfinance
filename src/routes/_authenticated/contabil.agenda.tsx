import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, Link2, MapPin, Pencil, Settings2, Trash2, Video } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader } from "@/components/os/page";
import { ContabilGate } from "@/components/contabil/ui";
import { CalendarioMes } from "@/components/contabil/CalendarioMes";
import { supabase } from "@/integrations/supabase/client";
import { useContabilMe, useMembros } from "@/os/contabil/hooks";
import { useAgendas, useHorarios, useReservas } from "@/os/contabil/agenda-hooks";
import {
  DIAS_SEMANA, dataExtensa, diaRecife, duracaoMin, faixaHoras, gerarHorarios, hojeRecife, horaRecife, instanteRecife,
  reservaDoHorario, somaDias, type Agenda, type Horario, type Reserva,
} from "@/os/contabil/agenda";
import { dataBR } from "@/os/contabil/db";
import { contabilHead } from "@/os/contabil/head";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/contabil/agenda")({
  head: () => contabilHead("Agenda de reuniões", "Horários abertos e reuniões marcadas pelos clientes da Union Contadores."),
  component: () => <ContabilGate><AgendaReunioes /></ContabilGate>,
});

/** O link enviado ao cliente aponta sempre para o endereço publicado. */
function linkPublico(codigo: string) {
  const host = window.location.hostname;
  const previa = host === "localhost" || host.startsWith("id-preview--") || host.endsWith("lovableproject.com");
  return `${previa ? "https://render-os.hef.seg.br" : window.location.origin}/agendar/${codigo}`;
}

function AgendaReunioes() {
  const { user, isAdmin } = useContabilMe();
  const { data: agendas = [], isLoading } = useAgendas();
  const { data: membros = [] } = useMembros();
  const agenda = agendas[0];
  const { data: horarios = [] } = useHorarios(agenda?.id);
  const { data: reservas = [] } = useReservas(agenda?.id);
  const qc = useQueryClient();
  const recarregar = () => qc.invalidateQueries({ queryKey: ["contabil", "agenda"] });

  const hoje = hojeRecife();
  const [mes, setMes] = useState(hoje.slice(0, 7));
  const [dia, setDia] = useState<string>(hoje);
  const [abrindo, setAbrindo] = useState(false);
  const [configurando, setConfigurando] = useState(false);
  const [editando, setEditando] = useState<Horario | null>(null);
  const [vendo, setVendo] = useState<{ horario: Horario; reserva: Reserva } | null>(null);

  const porDia = useMemo(() => {
    const m = new Map<string, Horario[]>();
    for (const h of horarios) {
      const d = diaRecife(h.inicio);
      m.set(d, [...(m.get(d) ?? []), h]);
    }
    return m;
  }, [horarios]);

  const agora = new Date().toISOString();
  const proximas = useMemo(() => horarios
    .filter((h) => h.fim > agora)
    .map((h) => ({ horario: h, reserva: reservaDoHorario(h.id, reservas) }))
    .filter((x): x is { horario: Horario; reserva: Reserva } => x.reserva !== null), [horarios, reservas, agora]);

  if (isLoading) return null;
  if (!agenda) return <p className="text-sm text-muted-foreground">Nenhuma agenda cadastrada.</p>;

  const dono = membros.find((m) => m.user_id === agenda.dono_id)?.nome ?? "Caio Oliveira";
  const podeEditar = agenda.dono_id === user?.id || isAdmin;
  const doDia = porDia.get(dia) ?? [];

  async function copiarLink() {
    if (!agenda) return;
    const link = linkPublico(agenda.codigo);
    try { await navigator.clipboard.writeText(link); toast.success("Link copiado. É só enviar ao cliente."); }
    catch { toast.message(link); }
  }

  async function remover(h: Horario) {
    const { error } = await supabase.from("contabil_agenda_horarios").delete().eq("id", h.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Horário removido.");
    recarregar();
  }

  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader
        eyebrow="Contábil"
        title="Agenda de reuniões"
        description={`Agenda de ${dono}. Os clientes escolhem um horário livre pelo link; o horário escolhido fica esgotado para os demais.`}
        actions={
          <>
            <Button variant="outline" onClick={copiarLink}><Link2 className="mr-1.5 h-4 w-4" /> Copiar link</Button>
            {podeEditar && <Button variant="outline" onClick={() => setConfigurando(true)}><Settings2 className="mr-1.5 h-4 w-4" /> Configurar</Button>}
            {podeEditar && <Button onClick={() => setAbrindo(true)}><CalendarPlus className="mr-1.5 h-4 w-4" /> Abrir horários</Button>}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="rounded-xl border p-4">
          <CalendarioMes
            mes={mes} onMes={setMes} selecionado={dia} onSelecionar={setDia} hoje={hoje}
            conteudo={(d) => {
              const hs = porDia.get(d) ?? [];
              if (!hs.length) return null;
              const marcadas = hs.filter((h) => reservaDoHorario(h.id, reservas)).length;
              const livres = hs.length - marcadas;
              return (
                <span className="flex flex-col gap-0.5 text-[10px] leading-tight">
                  {livres > 0 && <span className="rounded bg-primary/10 px-1 text-primary">{livres} {livres === 1 ? "livre" : "livres"}</span>}
                  {marcadas > 0 && <span className="rounded bg-foreground px-1 text-background">{marcadas} {marcadas === 1 ? "reunião" : "reuniões"}</span>}
                </span>
              );
            }}
          />
        </div>

        <section className="rounded-xl border p-4" aria-label="Horários do dia">
          <h2 className="text-sm font-semibold first-letter:uppercase">{dataExtensa(dia)}</h2>
          {doDia.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Nenhum horário aberto neste dia.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {doDia.map((h) => {
                const r = reservaDoHorario(h.id, reservas);
                const passou = h.fim <= agora;
                return (
                  <li key={h.id} className={cn("rounded-lg border p-2.5", passou && "opacity-55")}>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium tabular-nums">{faixaHoras(h)}</span>
                      <span className={cn("rounded px-1.5 py-0.5 text-[11px] font-medium", r ? "bg-foreground text-background" : "bg-primary/10 text-primary")}>
                        {r ? "Reservado" : "Livre"}
                      </span>
                      <span className="ml-auto flex gap-1">
                        {!r && podeEditar && (
                          <>
                            <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={`Editar horário das ${horaRecife(h.inicio)}`} onClick={() => setEditando(h)}><Pencil className="h-3.5 w-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={`Remover horário das ${horaRecife(h.inicio)}`} onClick={() => remover(h)}><Trash2 className="h-3.5 w-3.5" /></Button>
                          </>
                        )}
                      </span>
                    </div>
                    {r && (
                      <button type="button" className="mt-1.5 block w-full min-w-0 text-left text-[13px] hover:underline" onClick={() => setVendo({ horario: h, reserva: r })}>
                        <span className="block truncate font-medium">{r.nome}</span>
                        <span className="block truncate text-xs text-muted-foreground">{r.empresa ?? r.email} · {r.modalidade === "online" ? "Online" : "Presencial"}</span>
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold">Próximas reuniões</h2>
        {proximas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma reunião marcada ainda.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Quando</th>
                  <th className="px-3 py-2.5 font-medium">Cliente</th>
                  <th className="hidden px-3 py-2.5 font-medium sm:table-cell">Assunto</th>
                  <th className="px-3 py-2.5 font-medium">Tipo</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {proximas.map(({ horario, reserva }) => (
                  <tr key={reserva.id} className="cursor-pointer hover:bg-muted/30" onClick={() => setVendo({ horario, reserva })}>
                    <td className="whitespace-nowrap px-4 py-2.5 tabular-nums">{dataBR(diaRecife(horario.inicio))} · {faixaHoras(horario)}</td>
                    <td className="px-3 py-2.5"><div className="font-medium">{reserva.nome}</div><div className="text-xs text-muted-foreground">{reserva.empresa ?? reserva.email}</div></td>
                    <td className="hidden max-w-[280px] truncate px-3 py-2.5 text-muted-foreground sm:table-cell">{reserva.assunto ?? "—"}</td>
                    <td className="px-3 py-2.5">{reserva.modalidade === "online" ? "Online" : "Presencial"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {abrindo && <AbrirHorarios agenda={agenda} dia={dia < hoje ? hoje : dia} onClose={() => setAbrindo(false)} onSaved={recarregar} />}
      {editando && <EditarHorario horario={editando} onClose={() => setEditando(null)} onSaved={recarregar} />}
      {configurando && <Configurar agenda={agenda} onClose={() => setConfigurando(false)} onSaved={recarregar} />}
      {vendo && <VerReuniao {...vendo} podeEditar={podeEditar} onClose={() => setVendo(null)} onSaved={recarregar} />}
    </div>
  );
}

function Campo({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return <div className="min-w-0"><Label htmlFor={id} className="mb-1.5 block text-xs text-muted-foreground">{label}</Label>{children}</div>;
}

function AbrirHorarios({ agenda, dia, onClose, onSaved }: { agenda: Agenda; dia: string; onClose: () => void; onSaved: () => void }) {
  const [modo, setModo] = useState("um");
  const [data, setData] = useState(dia);
  const [hora, setHora] = useState("09:00");
  const [duracao, setDuracao] = useState("45");
  const [ate, setAte] = useState(somaDias(dia, 27));
  const [das, setDas] = useState("09:00");
  const [as, setAs] = useState("12:00");
  const [dias, setDias] = useState<number[]>([1, 2, 3, 4, 5]);
  const [salvando, setSalvando] = useState(false);

  let lote: { inicio: string; fim: string }[] = [];
  let erro: string | null = null;
  try {
    const d = Number(duracao);
    lote = modo === "um"
      ? gerarHorarios({ de: data, ate: data, dias: [0, 1, 2, 3, 4, 5, 6], das: hora, as: somaHora(hora, d), duracao: d })
      : gerarHorarios({ de: data, ate, dias, das, as, duracao: d });
    const agora = new Date().toISOString();
    lote = lote.filter((h) => h.inicio > agora);
    if (!lote.length) erro = "Nenhum horário futuro nesse período.";
  } catch (e) { erro = e instanceof Error ? e.message : "Confira os campos."; }

  async function salvar() {
    setSalvando(true);
    const { error } = await supabase.from("contabil_agenda_horarios").insert(lote.map((h) => ({ ...h, agenda_id: agenda.id })));
    setSalvando(false);
    if (error) { toast.error(error.code === "23505" ? "Já existe um horário aberto nesse período." : error.message); return; }
    toast.success(lote.length === 1 ? "Horário aberto." : `${lote.length} horários abertos.`);
    onSaved();
    onClose();
  }

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">Abrir horários</DialogTitle>
          <DialogDescription className="text-xs">Horários abertos aparecem no link dos clientes. Horário do Recife.</DialogDescription>
        </DialogHeader>
        <Tabs value={modo} onValueChange={setModo}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="um">Um horário</TabsTrigger>
            <TabsTrigger value="varios">Vários horários</TabsTrigger>
          </TabsList>
          <TabsContent value="um" className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Campo id="h-data" label="Dia"><Input id="h-data" type="date" value={data} onChange={(e) => setData(e.target.value)} /></Campo>
            <Campo id="h-hora" label="Início"><Input id="h-hora" type="time" value={hora} onChange={(e) => setHora(e.target.value)} /></Campo>
            <Campo id="h-dur" label="Duração (min)"><Input id="h-dur" type="number" min={10} max={480} step={5} value={duracao} onChange={(e) => setDuracao(e.target.value)} /></Campo>
          </TabsContent>
          <TabsContent value="varios" className="mt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Campo id="v-de" label="A partir de"><Input id="v-de" type="date" value={data} onChange={(e) => setData(e.target.value)} /></Campo>
              <Campo id="v-ate" label="Até o dia"><Input id="v-ate" type="date" value={ate} onChange={(e) => setAte(e.target.value)} /></Campo>
            </div>
            <div>
              <span className="mb-1.5 block text-xs text-muted-foreground">Dias da semana</span>
              <div className="flex flex-wrap gap-1.5">
                {DIAS_SEMANA.map((nome, i) => {
                  const on = dias.includes(i);
                  return (
                    <button key={nome} type="button" aria-pressed={on}
                      onClick={() => setDias(on ? dias.filter((d) => d !== i) : [...dias, i])}
                      className={cn("rounded-md border px-2.5 py-1 text-xs font-medium", on ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>
                      {nome}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Campo id="v-das" label="Das"><Input id="v-das" type="time" value={das} onChange={(e) => setDas(e.target.value)} /></Campo>
              <Campo id="v-as" label="Até as"><Input id="v-as" type="time" value={as} onChange={(e) => setAs(e.target.value)} /></Campo>
              <Campo id="v-dur" label="Duração (min)"><Input id="v-dur" type="number" min={10} max={480} step={5} value={duracao} onChange={(e) => setDuracao(e.target.value)} /></Campo>
            </div>
          </TabsContent>
        </Tabs>
        <p className={cn("text-xs", erro ? "text-destructive" : "text-muted-foreground")} role="status">
          {erro ?? (lote.length === 1 ? `1 horário: ${dataBR(diaRecife(lote[0]!.inicio))}, ${faixaHoras(lote[0]!)}.` : `${lote.length} horários serão abertos.`)}
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={salvar} disabled={!!erro || salvando}>{salvando ? "Abrindo…" : "Abrir"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function somaHora(hora: string, min: number): string {
  const [h, m] = hora.split(":").map(Number);
  const t = Math.min((h ?? 0) * 60 + (m ?? 0) + (Number.isFinite(min) ? min : 0), 23 * 60 + 59);
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

function EditarHorario({ horario, onClose, onSaved }: { horario: Horario; onClose: () => void; onSaved: () => void }) {
  const [data, setData] = useState(diaRecife(horario.inicio));
  const [hora, setHora] = useState(horaRecife(horario.inicio));
  const [duracao, setDuracao] = useState(String(duracaoMin(horario)));
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    const d = Number(duracao);
    if (!Number.isInteger(d) || d < 10 || d > 480) { toast.error("A duração deve ficar entre 10 minutos e 8 horas."); return; }
    let inicio: string;
    try { inicio = instanteRecife(data, hora); } catch { toast.error("Confira o dia e a hora."); return; }
    const fim = new Date(new Date(inicio).getTime() + d * 60000).toISOString();
    setSalvando(true);
    const { error } = await supabase.from("contabil_agenda_horarios").update({ inicio, fim }).eq("id", horario.id);
    setSalvando(false);
    if (error) { toast.error(error.code === "23505" ? "Já existe um horário aberto nesse período." : error.message); return; }
    toast.success("Horário atualizado.");
    onSaved();
    onClose();
  }

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle className="text-base">Editar horário</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Campo id="e-data" label="Dia"><Input id="e-data" type="date" value={data} onChange={(e) => setData(e.target.value)} /></Campo>
          <Campo id="e-hora" label="Início"><Input id="e-hora" type="time" value={hora} onChange={(e) => setHora(e.target.value)} /></Campo>
          <Campo id="e-dur" label="Duração (min)"><Input id="e-dur" type="number" min={10} max={480} step={5} value={duracao} onChange={(e) => setDuracao(e.target.value)} /></Campo>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Configurar({ agenda, onClose, onSaved }: { agenda: Agenda; onClose: () => void; onSaved: () => void }) {
  const [endereco, setEndereco] = useState(agenda.endereco ?? "");
  const [link, setLink] = useState(agenda.link_video ?? "");
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    const l = link.trim();
    if (l && !/^https:\/\/\S+$/.test(l)) { toast.error("O link da videochamada deve começar com https://"); return; }
    if (endereco.length > 300 || l.length > 500) { toast.error("Texto muito longo."); return; }
    setSalvando(true);
    const { error } = await supabase.from("contabil_agendas").update({ endereco: endereco.trim() || null, link_video: l || null }).eq("id", agenda.id);
    setSalvando(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Configurações salvas.");
    onSaved();
    onClose();
  }

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Configurar agenda</DialogTitle>
          <DialogDescription className="text-xs">O cliente vê estes dados depois de confirmar a reunião.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Campo id="c-link" label="Link da videochamada (reuniões online)"><Input id="c-link" placeholder="https://meet.google.com/…" value={link} onChange={(e) => setLink(e.target.value)} /></Campo>
          <Campo id="c-end" label="Endereço do escritório (reuniões presenciais)"><Textarea id="c-end" rows={3} value={endereco} onChange={(e) => setEndereco(e.target.value)} /></Campo>
          <p className="text-xs text-muted-foreground">Sem endereço, o link oferece apenas reunião online.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function VerReuniao({ horario, reserva, podeEditar, onClose, onSaved }: { horario: Horario; reserva: Reserva; podeEditar: boolean; onClose: () => void; onSaved: () => void }) {
  const [confirmando, setConfirmando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  async function cancelar() {
    setSalvando(true);
    const { error } = await supabase.from("contabil_agenda_reservas").update({ situacao: "cancelada", cancelado_em: new Date().toISOString() }).eq("id", reserva.id);
    setSalvando(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Reunião cancelada. O horário voltou a ficar livre no link.");
    onSaved();
    onClose();
  }

  const Icone = reserva.modalidade === "online" ? Video : MapPin;
  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Reunião com {reserva.nome}</DialogTitle>
          <DialogDescription className="text-xs first-letter:uppercase">{dataExtensa(diaRecife(horario.inicio))} · {faixaHoras(horario)}</DialogDescription>
        </DialogHeader>
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Tipo</dt><dd className="flex items-center gap-1.5"><Icone className="h-3.5 w-3.5" />{reserva.modalidade === "online" ? "Online" : "Presencial"}</dd>
          <dt className="text-muted-foreground">Empresa</dt><dd className="break-words">{reserva.empresa ?? "—"}</dd>
          <dt className="text-muted-foreground">E-mail</dt><dd className="break-all">{reserva.email}</dd>
          <dt className="text-muted-foreground">Telefone</dt><dd>{reserva.telefone ?? "—"}</dd>
          <dt className="text-muted-foreground">Assunto</dt><dd className="whitespace-pre-wrap break-words">{reserva.assunto ?? "—"}</dd>
        </dl>
        {podeEditar && (
          <DialogFooter>
            {confirmando ? (
              <>
                <Button variant="outline" onClick={() => setConfirmando(false)}>Manter reunião</Button>
                <Button variant="destructive" onClick={cancelar} disabled={salvando}>Confirmar cancelamento</Button>
              </>
            ) : (
              <Button variant="outline" onClick={() => setConfirmando(true)}>Cancelar reunião</Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
