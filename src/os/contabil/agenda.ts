import { z } from "zod";

/**
 * Agenda de reuniões do Contábil. Todos os horários são do Recife (UTC-3, sem
 * horário de verão), então a conversão é um deslocamento fixo — igual no
 * servidor e no navegador de qualquer cliente.
 */
const OFFSET_MS = 3 * 60 * 60 * 1000;
const pad = (n: number) => String(n).padStart(2, "0");

export const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;
export const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"] as const;
const DIAS_EXTENSO = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"] as const;

export interface Agenda { id: string; dono_id: string; codigo: string; endereco: string | null; link_video: string | null; ativa: boolean }
export interface Horario { id: string; agenda_id: string; inicio: string; fim: string }
export type Modalidade = "online" | "presencial";
export interface Reserva {
  id: string; horario_id: string; nome: string; empresa: string | null; email: string; telefone: string | null;
  assunto: string | null; modalidade: Modalidade; situacao: "confirmada" | "cancelada"; criado_em: string;
}

/** Data (AAAA-MM-DD) e hora (HH:MM) do Recife → instante ISO em UTC. */
export function instanteRecife(data: string, hora: string): string {
  const d = new Date(`${data}T${hora}:00-03:00`);
  if (Number.isNaN(d.getTime())) throw new Error("Data ou hora inválida.");
  return d.toISOString();
}
const noRecife = (iso: string) => new Date(new Date(iso).getTime() - OFFSET_MS).toISOString();
/** Dia do Recife (AAAA-MM-DD) de um instante. */
export const diaRecife = (iso: string) => noRecife(iso).slice(0, 10);
/** Hora do Recife (HH:MM) de um instante. */
export const horaRecife = (iso: string) => noRecife(iso).slice(11, 16);
export const hojeRecife = () => diaRecife(new Date().toISOString());
export const duracaoMin = (h: { inicio: string; fim: string }) => Math.round((new Date(h.fim).getTime() - new Date(h.inicio).getTime()) / 60000);

export function diaDaSemana(data: string): number {
  return new Date(`${data}T12:00:00Z`).getUTCDay();
}
export function somaDias(data: string, n: number): string {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
/** "terça-feira, 1 de dezembro de 2026" */
export function dataExtensa(data: string): string {
  const [a, m, d] = data.split("-").map(Number);
  return `${DIAS_EXTENSO[diaDaSemana(data)] ?? ""}, ${d ?? 0} de ${(MESES[(m ?? 1) - 1] ?? "").toLowerCase()} de ${a ?? 0}`;
}
export const faixaHoras = (h: { inicio: string; fim: string }) => `${horaRecife(h.inicio)} – ${horaRecife(h.fim)}`;

/** Dias (AAAA-MM-DD ou null para as células vazias) de um mês "AAAA-MM", em semanas começando no domingo. */
export function diasDoMes(mes: string): (string | null)[] {
  const [a, m] = mes.split("-").map(Number);
  const total = new Date(Date.UTC(a ?? 0, m ?? 1, 0)).getUTCDate();
  const vazias = diaDaSemana(`${mes}-01`);
  const dias: (string | null)[] = Array.from({ length: vazias }, () => null);
  for (let d = 1; d <= total; d++) dias.push(`${mes}-${pad(d)}`);
  while (dias.length % 7 !== 0) dias.push(null);
  return dias;
}
export function somaMeses(mes: string, n: number): string {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(a ?? 0, (m ?? 1) - 1 + n, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
}
export function tituloMes(mes: string): string {
  const [a, m] = mes.split("-").map(Number);
  return `${MESES[(m ?? 1) - 1] ?? ""} de ${a ?? 0}`;
}

const minutos = (hora: string) => {
  const [h, m] = hora.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};
const horaDe = (min: number) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;

export const LIMITE_HORARIOS = 400;

export interface LoteHorarios {
  /** Primeiro e último dia (inclusive), AAAA-MM-DD. */
  de: string; ate: string;
  /** Dias da semana (0 = domingo). */
  dias: number[];
  /** Janela do dia, HH:MM. */
  das: string; as: string;
  /** Duração de cada horário, em minutos. */
  duracao: number;
}

/** Abre vários horários de uma vez: um a cada `duracao` minutos dentro da janela, nos dias escolhidos. */
export function gerarHorarios(p: LoteHorarios): { inicio: string; fim: string }[] {
  if (!Number.isInteger(p.duracao) || p.duracao < 10 || p.duracao > 480) throw new Error("A duração deve ficar entre 10 minutos e 8 horas.");
  if (p.ate < p.de) throw new Error("A data final vem antes da inicial.");
  const ini = minutos(p.das), fim = minutos(p.as);
  if (fim - ini < p.duracao) throw new Error("O período do dia é menor que a duração de um horário.");
  const out: { inicio: string; fim: string }[] = [];
  for (let dia = p.de; dia <= p.ate; dia = somaDias(dia, 1)) {
    if (!p.dias.includes(diaDaSemana(dia))) continue;
    for (let t = ini; t + p.duracao <= fim; t += p.duracao) {
      out.push({ inicio: instanteRecife(dia, horaDe(t)), fim: instanteRecife(dia, horaDe(t + p.duracao)) });
      if (out.length > LIMITE_HORARIOS) throw new Error(`São mais de ${LIMITE_HORARIOS} horários de uma vez. Reduza o período.`);
    }
  }
  return out;
}

/** Reunião confirmada do horário; reserva cancelada libera o horário de novo. */
export function reservaDoHorario<T extends { horario_id: string; situacao: string }>(horarioId: string, reservas: T[]): T | null {
  return reservas.find((r) => r.horario_id === horarioId && r.situacao === "confirmada") ?? null;
}
/** Esgotado = já tem reunião confirmada. */
export const horarioEsgotado = (horarioId: string, reservas: { horario_id: string; situacao: string }[]) =>
  reservaDoHorario(horarioId, reservas) !== null;

/** Dados que o cliente preenche no link público. */
export const reservaSchema = z.object({
  codigo: z.string().trim().min(1).max(80),
  horario: z.string().uuid(),
  nome: z.string().trim().min(2, "Informe seu nome.").max(120, "Nome muito longo."),
  empresa: z.string().trim().max(160, "Nome da empresa muito longo."),
  email: z.string().trim().email("E-mail inválido.").max(255),
  telefone: z.string().trim().max(40, "Telefone muito longo."),
  assunto: z.string().trim().max(1000, "Assunto muito longo."),
  modalidade: z.enum(["online", "presencial"]),
});
export type ReservaInput = z.infer<typeof reservaSchema>;

export interface HorarioPublico { id: string; inicio: string; fim: string; livre: boolean }
export interface AgendaPublica { nome: string; presencial: boolean; horarios: HorarioPublico[] }
export type ResultadoReserva =
  | { ok: true; inicio: string; fim: string; modalidade: Modalidade; local: string | null }
  | { ok: false; motivo: "agenda" | "indisponivel" | "dados" | "ocupado" };
