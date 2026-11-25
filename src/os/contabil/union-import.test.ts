import { test } from "node:test";
import assert from "node:assert/strict";
import { projectUnionActivity, sanitizeUnionRow, unionRecordId } from "./union-import";

test("preserves source status, priority, dates and mapped ownership", () => {
  const row = { id: "f6c58c1b-b95d-49d5-8b2c-991e1bfd1148", setor_id: "old-sector", categoria_id: "old-category", empresa_id: "original-client", atividade: "Comunicado DARF", responsavel_id: "old-owner", criado_por: "old-author", atualizado_por: "old-owner", prioridade: "4", status: "concluido", prazo: "2026-09-08", criado_em: "2026-09-08 19:12:26.550576+00", ultima_atualizacao: "2026-09-17 15:13:12.763782+00", follow_up: "Cliente ciente" };
  const result = projectUnionActivity(row, { sectors: new Map([["old-sector", "new-sector"]]), categories: new Map([["old-category", "new-category"]]), users: new Map([["old-owner", "verified-owner"], ["old-author", "verified-author"]]) });
  assert.equal(result.cliente_id, "original-client");
  assert.equal(result.responsavel_id, "verified-owner");
  assert.equal(result.criado_por, "verified-author");
  assert.equal(result.setor_id, "new-sector");
  assert.equal(result.categoria_id, "new-category");
  assert.equal(result.status, "concluido");
  assert.equal(result.prioridade, 4);
  assert.equal(result.prazo, "2026-09-08");
  assert.equal(result.criado_em, row.criado_em);
});

test("rejects an activity whose original owner has no identity mapping", () => {
  assert.throws(() => projectUnionActivity({ id: "f6c58c1b-b95d-49d5-8b2c-991e1bfd1148", status: "concluido", prioridade: "4", setor_id: "s", responsavel_id: "missing" }, { sectors: new Map([["s", "mapped"]]), categories: new Map(), users: new Map() }), /Vínculo/);
});

test("filters credentials, including nested snapshot fields", () => {
  const person = sanitizeUnionRow("profiles", { id: "original", nome: "Pessoa", email: "pessoa@example.com", password: "must-not-import", access_token: "must-not-import" });
  assert.deepEqual(person, { id: "original", nome: "Pessoa", email: "pessoa@example.com" });
  const snapshot = sanitizeUnionRow("controle_snapshots", { id: "record", dados: JSON.stringify({ Empresa: "Empresa A", nested: { saldo: 10, api_key: "must-not-import" }, password: "must-not-import" }) });
  assert.deepEqual(JSON.parse(snapshot["dados"] ?? "{}"), { Empresa: "Empresa A", nested: { saldo: 10 } });
});

test("source identifiers are stable for re-uploading employee and access records", () => {
  assert.equal(unionRecordId("ponto_colaboradores", { colaborador_id: "original-person" }), "original-person");
  assert.equal(unionRecordId("admin_allowlist", { email: " PERSON@EXAMPLE.COM " }), "person@example.com");
  assert.throws(() => unionRecordId("atividades", {}), /sem identificação/);
});