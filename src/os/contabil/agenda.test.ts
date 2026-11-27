import { test } from "node:test";
import assert from "node:assert/strict";
import { conflitaComIntervalo, diaRecife, gerarHorarios, horaRecife, horarioEsgotado, instanteRecife, reservaSchema } from "./agenda";

test("abre horários nos dias escolhidos com 30 minutos de intervalo", () => {
  // 01/12/2026 é terça; 03/12 é quinta.
  const lote = gerarHorarios({ de: "2026-12-01", ate: "2026-12-07", dias: [2, 4], das: "09:00", as: "12:00", duracao: 45 });
  assert.equal(lote.length, 4);
  assert.deepEqual(lote.map((h) => `${diaRecife(h.inicio)} ${horaRecife(h.inicio)}-${horaRecife(h.fim)}`), [
    "2026-12-01 09:00-09:45", "2026-12-01 10:15-11:00",
    "2026-12-03 09:00-09:45", "2026-12-03 10:15-11:00",
  ]);
});

test("não cria horário que passe do fim do período", () => {
  const lote = gerarHorarios({ de: "2026-12-01", ate: "2026-12-01", dias: [2], das: "09:00", as: "10:00", duracao: 40 });
  assert.equal(lote.length, 1);
  const primeiro = lote[0];
  assert.ok(primeiro);
  assert.equal(horaRecife(primeiro.fim), "09:40");
});

test("horários são do Recife (UTC-3)", () => {
  assert.equal(instanteRecife("2026-12-01", "22:30"), "2026-12-02T01:30:00.000Z");
  assert.equal(diaRecife("2026-12-02T01:30:00.000Z"), "2026-12-01");
});

test("horário escolhido por um cliente fica esgotado", () => {
  assert.equal(horarioEsgotado("h1", [{ horario_id: "h1", situacao: "confirmada" }]), true);
  assert.equal(horarioEsgotado("h2", [{ horario_id: "h1", situacao: "confirmada" }]), false);
});

test("cancelar a reunião libera o horário de novo", () => {
  assert.equal(horarioEsgotado("h1", [{ horario_id: "h1", situacao: "cancelada" }]), false);
});

test("reuniões de uma hora seguem o exemplo 09:00–10:00 e 10:30–11:30", () => {
  const lote = gerarHorarios({ de: "2026-12-01", ate: "2026-12-01", dias: [2], das: "09:00", as: "11:30", duracao: 60 });
  assert.deepEqual(lote.map((h) => [horaRecife(h.inicio), horaRecife(h.fim)]), [["09:00", "10:00"], ["10:30", "11:30"]]);
});

test("intervalo menor que 30 minutos conflita; exatamente 30 é permitido", () => {
  const a = { inicio: instanteRecife("2026-12-01", "09:00"), fim: instanteRecife("2026-12-01", "10:00") };
  const b = { inicio: instanteRecife("2026-12-01", "10:29"), fim: instanteRecife("2026-12-01", "11:29") };
  assert.equal(conflitaComIntervalo(a, b), true);
  assert.equal(conflitaComIntervalo(b, a), true);
  assert.equal(conflitaComIntervalo(a, { ...b, inicio: instanteRecife("2026-12-01", "10:30") }), false);
});

test("cliente pode escolher online ou presencial; outros formatos são rejeitados", () => {
  const input = { codigo: "caio-oliveira", horario: "00000000-0000-4000-8000-000000000001", nome: "Cliente Teste", empresa: "", email: "cliente@example.com", telefone: "", assunto: "" };
  assert.equal(reservaSchema.safeParse({ ...input, modalidade: "online" }).success, true);
  assert.equal(reservaSchema.safeParse({ ...input, modalidade: "presencial" }).success, true);
  assert.equal(reservaSchema.safeParse({ ...input, modalidade: "telefone" }).success, false);
});
