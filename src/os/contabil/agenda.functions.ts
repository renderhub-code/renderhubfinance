import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { reservaSchema, type AgendaPublica, type ResultadoReserva } from "./agenda";
import { agendaPublicClient } from "./agenda.server";

const horarioSchema = z.object({ id: z.string(), inicio: z.string(), fim: z.string(), livre: z.boolean() });
const agendaSchema = z.object({ nome: z.string(), presencial: z.boolean(), horarios: z.array(horarioSchema) });
const instante = (v: string) => new Date(v).toISOString();

/** Link público: horários futuros e se estão livres. Nunca devolve dados de clientes. */
export const getAgendaPublica = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ codigo: z.string().trim().min(1).max(80) }).parse(d))
  .handler(async ({ data }): Promise<AgendaPublica | null> => {
    const { data: raw, error } = await agendaPublicClient().rpc("contabil_agenda_publica", { _codigo: data.codigo });
    if (error) { console.error("agenda publica", error.message); throw new Error("Não foi possível carregar a agenda."); }
    if (!raw) return null;
    const a = agendaSchema.parse(raw);
    return { ...a, horarios: a.horarios.map((h) => ({ ...h, inicio: instante(h.inicio), fim: instante(h.fim) })) };
  });

const resultadoSchema = z.union([
  z.object({ ok: z.literal(true), inicio: z.string(), fim: z.string(), modalidade: z.enum(["online", "presencial"]), local: z.string().nullable() }),
  z.object({ ok: z.literal(false), motivo: z.enum(["agenda", "indisponivel", "dados", "ocupado"]) }),
]);

/** Reserva um horário livre. O banco garante um cliente por horário. */
export const reservarHorario = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => reservaSchema.parse(d))
  .handler(async ({ data }): Promise<ResultadoReserva> => {
    const { data: raw, error } = await agendaPublicClient().rpc("contabil_agenda_reservar", {
      _codigo: data.codigo, _horario: data.horario, _nome: data.nome, _empresa: data.empresa, _email: data.email,
      _telefone: data.telefone, _assunto: data.assunto, _modalidade: data.modalidade,
    });
    if (error) { console.error("agenda reservar", error.message); throw new Error("Não foi possível concluir o agendamento."); }
    const r = resultadoSchema.parse(raw);
    return r.ok ? { ...r, inicio: instante(r.inicio), fim: instante(r.fim) } : r;
  });
