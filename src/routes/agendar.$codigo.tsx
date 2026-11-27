import { createFileRoute, notFound, useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { CalendarCheck, Clock, MapPin, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RenderMark } from "@/components/brand/Logo";
import { CalendarioMes } from "@/components/contabil/CalendarioMes";
import { getAgendaPublica, reservarHorario } from "@/os/contabil/agenda.functions";
import {
  dataExtensa, diaRecife, duracaoMin, faixaHoras, hojeRecife, horaRecife, reservaSchema,
  type HorarioPublico, type Modalidade, type ResultadoReserva,
} from "@/os/contabil/agenda";
import { cn } from "@/lib/utils";

const agendaOptions = (codigo: string) => queryOptions({
  queryKey: ["agenda-publica", codigo],
  queryFn: () => getAgendaPublica({ data: { codigo } }),
  staleTime: 15_000,
});

export const Route = createFileRoute("/agendar/$codigo")({
  loader: async ({ context, params }) => {
    const agenda = await context.queryClient.ensureQueryData(agendaOptions(params.codigo));
    if (!agenda) throw notFound();
    return { nome: agenda.nome };
  },
  head: ({ loaderData }) => {
    const title = loaderData ? `Agendar reunião com ${loaderData.nome} — Union Contadores` : "Agendar reunião — Union Contadores";
    const description = "Escolha um horário livre para a sua reunião com a Union Contadores.";
    return { meta: [
      { title }, { name: "description", content: description },
      { property: "og:title", content: title }, { property: "og:description", content: description },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
      ...(loaderData ? [] : [{ name: "robots", content: "noindex" }]),
    ] };
  },
  component: Agendar,
  notFoundComponent: () => <Aviso titulo="Agenda não encontrada">Confira o link que você recebeu ou peça um novo à Union Contadores.</Aviso>,
  errorComponent: Erro,
});

function Erro({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  return (
    <Aviso titulo="Não foi possível abrir a agenda">
      {error instanceof Error ? error.message : "Tente novamente em instantes."}
      <Button className="mt-4" onClick={() => { void router.invalidate(); reset(); }}>Tentar de novo</Button>
    </Aviso>
  );
}

function Moldura({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-muted/40 px-4 py-8 sm:py-14">
      <div className="mx-auto max-w-[880px]">
        <div className="mb-6 flex items-center gap-2 text-sm font-semibold">
          <RenderMark className="h-7 w-7" /> Union Contadores
        </div>
        {children}
      </div>
    </main>
  );
}

function Aviso({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <Moldura>
      <div className="rounded-2xl border bg-background p-8 text-center">
        <h1 className="text-lg font-semibold">{titulo}</h1>
        <div className="mt-2 flex flex-col items-center text-sm text-muted-foreground">{children}</div>
      </div>
    </Moldura>
  );
}

function Agendar() {
  const { codigo } = Route.useParams();
  const { data: agenda } = useSuspenseQuery(agendaOptions(codigo));
  const qc = useQueryClient();
  const reservar = useServerFn(reservarHorario);

  const horarios = useMemo(() => agenda?.horarios ?? [], [agenda]);
  const porDia = useMemo(() => {
    const m = new Map<string, HorarioPublico[]>();
    for (const h of horarios) {
      const d = diaRecife(h.inicio);
      m.set(d, [...(m.get(d) ?? []), h]);
    }
    return m;
  }, [horarios]);
  const primeiroLivre = horarios.find((h) => h.livre);
  const primeiroDia = primeiroLivre ? diaRecife(primeiroLivre.inicio) : horarios[0] ? diaRecife(horarios[0].inicio) : null;

  const [mes, setMes] = useState(primeiroDia?.slice(0, 7) ?? hojeRecife().slice(0, 7));
  const [dia, setDia] = useState<string | null>(primeiroDia);
  const [horario, setHorario] = useState<HorarioPublico | null>(null);
  const [form, setForm] = useState({ nome: "", empresa: "", email: "", telefone: "", assunto: "" });
  const [modalidade, setModalidade] = useState<Modalidade>("online");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [feito, setFeito] = useState<Extract<ResultadoReserva, { ok: true }> | null>(null);

  if (!agenda) return <Aviso titulo="Agenda não encontrada">Confira o link que você recebeu.</Aviso>;

  if (feito) {
    const online = feito.modalidade === "online";
    return (
      <Moldura>
        <div className="rounded-2xl border bg-background p-6 sm:p-10">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary"><CalendarCheck className="h-6 w-6" /></span>
          <h1 className="mt-4 text-xl font-semibold tracking-tight">Reunião confirmada</h1>
          <p className="mt-1 text-sm text-muted-foreground">Sua reunião com {agenda.nome} está marcada.</p>
          <dl className="mt-6 space-y-3 text-sm">
            <div><dt className="text-xs text-muted-foreground">Quando</dt><dd className="font-medium first-letter:uppercase">{dataExtensa(diaRecife(feito.inicio))}, {faixaHoras(feito)} (horário do Recife)</dd></div>
            <div>
              <dt className="text-xs text-muted-foreground">{online ? "Reunião online" : "Reunião presencial"}</dt>
              <dd className="break-words font-medium">
                {feito.local
                  ? online ? <a className="text-primary underline" href={feito.local} target="_blank" rel="noreferrer">{feito.local}</a> : feito.local
                  : online ? "O link da videochamada será enviado para o seu e-mail." : "O endereço será enviado para o seu e-mail."}
              </dd>
            </div>
          </dl>
          <p className="mt-6 text-xs text-muted-foreground">Guarde estas informações. Se precisar remarcar, fale com a Union Contadores.</p>
        </div>
      </Moldura>
    );
  }

  const doDia = dia ? porDia.get(dia) ?? [] : [];
  const campo = (k: keyof typeof form) => ({ value: form[k], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value }) });

  async function confirmar(e: React.FormEvent) {
    e.preventDefault();
    if (!horario) return;
    const dados = reservaSchema.safeParse({ codigo, horario: horario.id, ...form, modalidade: agenda?.presencial ? modalidade : "online" });
    if (!dados.success) { setErro(dados.error.issues[0]?.message ?? "Confira os campos."); return; }
    setErro(null);
    setEnviando(true);
    try {
      const r = await reservar({ data: dados.data });
      if (r.ok) { setFeito(r); return; }
      setErro(r.motivo === "ocupado" || r.motivo === "indisponivel"
        ? "Esse horário acabou de ser escolhido por outra pessoa. Escolha outro horário."
        : r.motivo === "dados" ? "Confira os dados informados." : "Esta agenda não está mais disponível.");
      if (r.motivo !== "dados") setHorario(null);
    } catch {
      setErro("Não foi possível concluir o agendamento. Tente novamente.");
    } finally {
      setEnviando(false);
      void qc.invalidateQueries({ queryKey: ["agenda-publica", codigo] });
    }
  }

  return (
    <Moldura>
      <div className="rounded-2xl border bg-background p-5 sm:p-8">
        <h1 className="text-xl font-semibold tracking-tight">Agende sua reunião com {agenda.nome}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Escolha o dia e um horário livre. Horários no fuso do Recife.</p>

        {horarios.length === 0 ? (
          <p className="mt-8 rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Não há horários abertos no momento. Fale com a Union Contadores para combinar uma data.</p>
        ) : (
          <div className="mt-6 grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,300px)]">
            <CalendarioMes
              compacto mes={mes} onMes={setMes} selecionado={dia} hoje={hojeRecife()}
              onSelecionar={(d) => { setDia(d); setHorario(null); setErro(null); }}
              desabilitado={(d) => !porDia.has(d)}
              conteudo={(d) => (porDia.get(d) ?? []).some((h) => h.livre) ? <span className="mt-0.5 h-1 w-1 rounded-full bg-primary" /> : null}
            />
            <section aria-label="Horários">
              <h2 className="text-sm font-semibold first-letter:uppercase">{dia ? dataExtensa(dia) : "Escolha um dia"}</h2>
              {dia && doDia.length === 0 && <p className="mt-3 text-sm text-muted-foreground">Sem horários neste dia.</p>}
              <ul className="mt-3 grid grid-cols-2 gap-2">
                {doDia.map((h) => (
                  <li key={h.id}>
                    <button type="button" disabled={!h.livre} aria-pressed={horario?.id === h.id}
                      onClick={() => { setHorario(h); setErro(null); }}
                      className={cn(
                        "w-full rounded-lg border px-2 py-2 text-sm font-medium tabular-nums transition-colors",
                        !h.livre ? "cursor-not-allowed bg-muted text-muted-foreground" : "hover:border-primary hover:bg-primary/5",
                        horario?.id === h.id && "border-primary bg-primary text-primary-foreground hover:bg-primary",
                      )}>
                      <span className={cn(!h.livre && "line-through")}>{horaRecife(h.inicio)}</span>
                      {!h.livre && <span className="block text-[11px] font-normal">Esgotado</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}

        {erro && !horario && <p role="alert" className="mt-6 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{erro}</p>}

        {horario && (
          <form onSubmit={confirmar} className="mt-8 border-t pt-6" noValidate>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium">
              <Clock className="h-4 w-4 text-primary" />
              <span className="first-letter:uppercase">{dataExtensa(diaRecife(horario.inicio))}, {faixaHoras(horario)}</span>
              <span className="font-normal text-muted-foreground">({duracaoMin(horario)} min)</span>
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div><Label htmlFor="r-nome" className="mb-1.5 block">Seu nome</Label><Input id="r-nome" required maxLength={120} autoComplete="name" {...campo("nome")} /></div>
              <div><Label htmlFor="r-empresa" className="mb-1.5 block">Empresa</Label><Input id="r-empresa" maxLength={160} autoComplete="organization" {...campo("empresa")} /></div>
              <div><Label htmlFor="r-email" className="mb-1.5 block">E-mail</Label><Input id="r-email" type="email" required maxLength={255} autoComplete="email" {...campo("email")} /></div>
              <div><Label htmlFor="r-tel" className="mb-1.5 block">Telefone</Label><Input id="r-tel" type="tel" maxLength={40} autoComplete="tel" {...campo("telefone")} /></div>
              <div className="sm:col-span-2"><Label htmlFor="r-assunto" className="mb-1.5 block">Assunto da reunião</Label><Textarea id="r-assunto" rows={3} maxLength={1000} {...campo("assunto")} /></div>
            </div>
            {agenda.presencial && (
              <fieldset className="mt-4">
                <legend className="mb-1.5 text-sm font-medium">Como prefere a reunião?</legend>
                <div className="grid grid-cols-2 gap-2 sm:max-w-sm">
                  {([["online", "Online", Video], ["presencial", "Presencial", MapPin]] as const).map(([valor, nome, Icone]) => (
                    <label key={valor} className={cn("flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm", modalidade === valor && "border-primary bg-primary/5 ring-1 ring-primary")}>
                      <input type="radio" name="modalidade" className="sr-only" checked={modalidade === valor} onChange={() => setModalidade(valor)} />
                      <Icone className="h-4 w-4" /> {nome}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            {erro && <p role="alert" className="mt-4 text-sm text-destructive">{erro}</p>}
            <Button type="submit" className="mt-6 w-full sm:w-auto" disabled={enviando}>{enviando ? "Confirmando…" : "Confirmar reunião"}</Button>
          </form>
        )}
      </div>
    </Moldura>
  );
}
