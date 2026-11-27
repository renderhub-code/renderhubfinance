import { test } from "node:test";
import assert from "node:assert/strict";
import { GROUP_COMPANIES, GROUP_OPERATIONS, companiesByOperation } from "./companies";

test("o grupo tem 4 operações e 6 marcas, cada marca em uma operação", () => {
  assert.equal(GROUP_OPERATIONS.length, 4);
  assert.equal(GROUP_COMPANIES.length, 6);
  const names = (id: Parameters<typeof companiesByOperation>[0]) => companiesByOperation(id).map((c) => c.name).sort();
  assert.deepEqual(GROUP_OPERATIONS.map((o) => o.name), ["Union", "Render", "ERKS Indústria e Distribuidora", "Use Noronha"]);
  assert.deepEqual(names("union"), ["Union Contadores"]);
  assert.deepEqual(names("render"), ["Dom Pablyto", "Render Comex"]);
  assert.deepEqual(names("erks"), ["ERKS", "SX Paper"]);
  assert.deepEqual(names("use-noronha"), ["Nortrip"]);
});
