import { test } from "node:test";
import assert from "node:assert/strict";
import { definirSenhaSchema, situacaoDaConta } from "./usuarios";

const id = "4ff84eef-6f0e-4c2b-bf20-cf741142db6b";

test("senha provisória precisa de pelo menos 8 caracteres", () => {
  assert.equal(definirSenhaSchema.safeParse({ userId: id, senha: "1234567" }).success, false);
  assert.equal(definirSenhaSchema.safeParse({ userId: id, senha: "12345678" }).success, true);
});

test("conta com senha provisória aparece como provisória até a pessoa trocar", () => {
  assert.equal(situacaoDaConta({ ativo: false, senha_provisoria: false, ultimo_acesso: null }), "pendente");
  assert.equal(situacaoDaConta({ ativo: true, senha_provisoria: true, ultimo_acesso: "2026-11-27T12:00:00Z" }), "provisoria");
  assert.equal(situacaoDaConta({ ativo: true, senha_provisoria: false, ultimo_acesso: "2026-11-27T12:00:00Z" }), "ativa");
});
