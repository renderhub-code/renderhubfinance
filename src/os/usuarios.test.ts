import { test } from "node:test";
import assert from "node:assert/strict";
import { acessosDaSelecao, definirSenhaSchema, modulosSemTela, resumoDoAcesso, selecaoDosAcessos, situacaoDaConta } from "./usuarios";

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

const vazio = { Financeiro: "nao", Operacional: "nao", RH: "nao", IA: "nao" } as const;

test("módulo marcado libera ver e editar todas as telas dele nas marcas marcadas", () => {
  const { gravar, remover } = acessosDaSelecao([], { marcas: ["nortrip", "erks"], modulos: { ...vazio, Financeiro: "sim" } });
  assert.equal(remover.length, 0);
  assert.ok(gravar.every((g) => g.nivel === 2));
  assert.deepEqual(gravar.filter((g) => g.empresa === "erks").map((g) => g.recurso).sort(), ["fin.centros", "fin.dashboard", "fin.fluxo", "fin.lancamentos", "fin.plano", "fin.simulacoes"]);
  assert.ok(gravar.some((g) => g.empresa === "nortrip" && g.recurso === "fin.bling"));
  assert.ok(gravar.every((g) => g.empresa === "nortrip" || g.empresa === "erks"));
});

test("desmarcar a marca ou o módulo tira o acesso", () => {
  const atuais = [
    { empresa: "union", recurso: "con.painel", nivel: 2 as const },
    { empresa: "erks", recurso: "fin.dashboard", nivel: 2 as const },
    { empresa: "erks", recurso: "rh.painel", nivel: 1 as const },
  ];
  const semErks = acessosDaSelecao(atuais, { marcas: ["union"], modulos: { ...vazio, Operacional: "sim", Financeiro: "parcial", RH: "parcial" } });
  assert.deepEqual(semErks.remover, [{ empresa: "erks", recurso: "fin.dashboard" }, { empresa: "erks", recurso: "rh.painel" }]);
  const semFinanceiro = acessosDaSelecao(atuais, { marcas: ["union", "erks"], modulos: { ...vazio, Operacional: "parcial", RH: "parcial" } });
  assert.deepEqual(semFinanceiro.remover, [{ empresa: "erks", recurso: "fin.dashboard" }]);
});

test("Operacional só existe na Union Contadores e na Render Comex; IA vale para o grupo", () => {
  const sel = { marcas: ["nortrip" as const], modulos: { ...vazio, Operacional: "sim" as const, IA: "sim" as const } };
  const { gravar } = acessosDaSelecao([], sel);
  assert.ok(gravar.length > 0 && gravar.every((g) => g.empresa === "grupo" && g.recurso.startsWith("ia.")));
  assert.deepEqual(modulosSemTela(sel), ["Operacional"]);
});

test("acesso parcial feito na aba Acessos aparece como parcial e não muda ao salvar", () => {
  const atuais = [
    { empresa: "union", recurso: "con.painel", nivel: 2 as const },
    { empresa: "union", recurso: "con.atividades", nivel: 1 as const },
  ];
  const sel = selecaoDosAcessos(atuais);
  assert.deepEqual(sel.marcas, ["union"]);
  assert.equal(sel.modulos.Operacional, "parcial");
  assert.deepEqual(acessosDaSelecao(atuais, sel), { gravar: [], remover: [] });
  assert.equal(resumoDoAcesso(false, atuais), "Union Contadores · Operacional (parcial)");
});

test("seleção salva volta marcada ao reabrir a janela", () => {
  const sel = { marcas: ["union" as const], modulos: { ...vazio, Operacional: "sim" as const } };
  const { gravar } = acessosDaSelecao([], sel);
  assert.deepEqual(selecaoDosAcessos(gravar), sel);
  assert.equal(resumoDoAcesso(false, gravar), "Union Contadores · Operacional");
  assert.equal(resumoDoAcesso(false, []), "Sem acesso");
  assert.equal(resumoDoAcesso(true, []), "Administrador");
});
