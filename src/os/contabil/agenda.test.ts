import { test } from "node:test";
import assert from "node:assert/strict";
import { diaRecife, gerarHorarios, horaRecife, horarioEsgotado, instanteRecife } from "./agenda";

test("abre horários em lote só nos dias da semana escolhidos, um a cada duração", () => {
  // 01/12/2026 é terça; 03/12 é quinta.
  const lote = gerarHorarios({ de: "2026-12-01", ate: "2026-12-07", dias: [2, 4], das: "09:00", as: "12:00", duracao: 45 });
  assert.equal(lote.length, 8);
  assert.deepEqual(lote.map((h) => `${diaRecife(h.inicio)} ${horaRecife(h.inicio)}-${horaRecife(h.fim)}`), [
    "2026-12-01 09:00-09:45", "2026-12-01 09:45-10:30", "2026-12-01 10:30-11:15", "2026-12-01 11:15-12:00",
    "2026-12-03 09:00-09:45", "2026-12-03 09:45-10:30", "2026-12-03 10:30-11:15", "2026-12-03 11:15-12:00",
  ]);
});

test("não cria horário que passe do fim do período", () => {
  const lote = gerarHorarios({ de: "2026-12-01", ate: "2026-12-01", dias: [2], das: "09:00", as: "10:00", duracao: 40 });
  assert.equal(lote.length, 1);
  assert.equal(horaRecife(lote[0]!.fim), "09:40");
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
