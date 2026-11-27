# Empresas e módulos por usuário, em Pessoas › Usuários

## O que muda para você

Na aba Usuários, cada pessoa ganha um botão **Empresas e módulos**. Ele abre uma janela com duas listas de marcar:

```text
Empresas e módulos — Caio Oliveira

Marcas que pode ver
  Union            [x] Union Contadores
  Render           [ ] Render Comex   [ ] Dom Pablyto
  ERKS Ind. e Dist. [ ] ERKS          [ ] SX Paper
  Use Noronha      [ ] Nortrip

Módulos
  [ ] Financeiro   [x] Operacional   [ ] Pessoas (RH)   [ ] IA

                                   [Cancelar] [Salvar]
```

- Módulo marcado libera **ver e editar** todas as telas dele, nas marcas marcadas.
- Desmarcar tira o acesso na hora; a pessoa deixa de ver o módulo e a marca no menu.
- A lista de usuários passa a mostrar um resumo do acesso de cada um (ex.: "Union · Operacional", "Administrador", "Sem acesso").
- A janela **Novo usuário** ganha as mesmas duas listas, para a conta já nascer com o acesso certo.
- A aba **Acessos** continua existindo para o ajuste fino, tela por tela (ver ou editar).

## Quem fica administrador

Hoje 14 das 15 contas são administradoras e enxergam tudo. Com a sua resposta, passa a ser assim:

- Continuam administradoras as suas duas contas: `syer@hefsys.com.br` e `syer.rodrigues@renderhub.com.br`. Mantive as duas para você não ficar sem acesso; depois dá para tirar uma delas na própria tela.
- As outras 12 contas deixam de ser administradoras e passam a ver só o que estiver marcado.
- Ninguém fica no escuro: essas 12 pessoas já têm telas da Union marcadas (Operacional), então continuam entrando no Contábil normalmente. O Caio e a Laura têm as 8 telas; os demais têm 4.
- Erickson Andrade segue sem acesso até você marcar algo para ele.
- As abas Usuários e Acessos somem para quem não é administrador; só você define senhas provisórias e acessos.

## Detalhes que vale saber

- **Operacional** só existe na Union Contadores e na Render Comex; nas outras marcas, marcar esse módulo não libera nada, e a janela avisa isso.
- **IA** é do grupo inteiro, não depende das marcas marcadas.
- Se alguém tiver um acesso parcial feito na aba Acessos (algumas telas de um módulo, ou só ver), o módulo aparece como "parcial" e nada é alterado a menos que você mexa na caixinha.
- Você não consegue tirar o próprio acesso de administrador por engano.

## Ordem de trabalho

1. Regra que transforma "marcas + módulos marcados" nas telas liberadas, com teste (módulo marcado = editar; Operacional só onde existe; IA no grupo; parcial preservado).
2. Gravação protegida: só administrador consegue salvar acessos de outra pessoa.
3. Janela Empresas e módulos e a coluna de resumo na aba Usuários; mesmas listas em Novo usuário.
4. Retirar o acesso de administrador das 12 contas, mantendo as suas duas.
5. Conferir no app: como administrador (marcar e desmarcar) e como uma conta comum (menu só com o que foi marcado).

## Detalhes técnicos

- Sem tabela nova: a seleção grava em `os_acessos` (empresa, recurso, nível 2), a mesma base da aba Acessos; o catálogo vem de `RECURSOS` em `src/os/acessos.ts`, agrupado pelo campo `modulo` (Financeiro, Operacional, RH, IA) e as marcas por operação vêm de `src/os/companies.ts`.
- Função pura `acessosDaSelecao` em `src/os/usuarios.ts` devolve as linhas a gravar e a remover; teste ao lado dos existentes.
- Novas server functions em `src/os/usuarios.functions.ts` (`salvarEmpresasEModulos`, e `criarUsuario` aceitando a seleção), com a mesma checagem `has_role(..., 'controller')` já usada ali; `listarUsuarios` passa a devolver admin + acessos.
- Passo 4 é alteração de dados: remover a linha `controller` de `user_roles` para todos, exceto os dois ids do Syer. `handle_new_user` já não concede `controller` a contas novas, então nada a mudar nele.
- No início da implementação, conferir as regras de gravação de `os_acessos` e se o administrador do Contábil (`contabil_membros.papel`) depende do papel `controller`, para o Caio e a Laura não perderem a gestão da agenda e da equipe.
- Atualizar `AGENTS.md` com a regra: seleção por módulo em Usuários é um atalho sobre `os_acessos`, nunca uma segunda fonte de permissões.

## Ideias opcionais

- Marcar por operação inteira (um clique libera todas as marcas dela).
- Opção "só ver" por módulo na própria janela, sem precisar ir à aba Acessos.
