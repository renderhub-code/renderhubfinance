# Separar 4 operações e 6 marcas

Objetivo: o sistema passa a mostrar o grupo como **4 operações**, cada uma com as suas **marcas**. As 6 marcas continuam as que já existem; nenhum dado é movido ou apagado.

## Como fica

```text
Grupo Render Hub
├── Union ................................ Union Contadores
├── Render ............................... Render Comex, Dom Pablyto
├── ERKS Indústria e Distribuidora ....... ERKS, SX Paper
└── Use Noronha .......................... Nortrip
```

## O que muda nas telas

1. **Seletor do topo**: as marcas aparecem agrupadas por operação, com o nome da operação como título de cada grupo. Continua sendo possível escolher o grupo inteiro ou uma marca.
2. **Início e página de entrada**: os textos e contadores passam a dizer "4 operações e 6 marcas", e os cartões das marcas ficam organizados por operação.
3. **Acessos de pessoas**: a lista de onde cada pessoa tem acesso fica agrupada por operação, e o texto troca "empresas" por "marcas". As permissões atuais de cada pessoa ficam iguais.
4. **Demais telas** (Financeiro, Pessoas, IA, Contábil): onde hoje está escrito "empresa" para se referir a uma das 6, passa a ser "marca"; onde fizer sentido, o nome da operação aparece junto.

## O que não muda

- Lançamentos, fluxo de caixa, plano de contas, De/Para e simulações de cada marca.
- A integração com o Bling e a importação diária das 17h da Nortrip.
- As bases da Union no Contábil.
- Os acessos já concedidos.

## Validação

- Abrir o seletor e conferir as 4 operações com as 6 marcas nos grupos certos.
- Trocar para cada marca e confirmar que os dados continuam os mesmos de antes (em especial o Fluxo de Caixa da Nortrip).
- Conferir Início e Acessos em tela grande e no celular.

## Ideias opcionais (não incluídas)

- Poder escolher uma **operação** no seletor e ver o financeiro somado das suas marcas (ex.: Render = Render Comex + Dom Pablyto).
- Dar acesso a uma pessoa por operação inteira, em vez de marca por marca.

## Detalhes técnicos

- `src/os/companies.ts` segue como fonte única: adicionar `OperationId`, a lista `GROUP_OPERATIONS` (id, nome, marcas) e o campo `operation` em cada item de `GROUP_COMPANIES`, mais helpers `getOperation` / `companiesByOperation`. Ids (`CompanyId`) e slugs das marcas ficam inalterados, inclusive `use-noronha`.
- Sem mudança no banco: `public.companies` (6 ativas + A&F inativa) e `public.business_units` ficam como estão; as tabelas de RH, IA, acessos e financeiro continuam referenciando os mesmos ids.
- `useHubStore` / `HUBS` mantêm os mesmos ids de workspace; só a apresentação é agrupada.
- Telas a ajustar: `src/components/AppShell.tsx` (seletor), `src/routes/_authenticated/inicio.tsx`, `src/routes/index.tsx`, `src/components/brand/HubOrbit.tsx`, `src/routes/_authenticated/pessoas.acessos.tsx`, `src/routes/_authenticated/ia.empresas.tsx` e rótulos em `src/os/modules.ts`.
- Teste pequeno em `src/os/` garantindo: 4 operações, 6 marcas, cada marca em exatamente uma operação, com o mapeamento acima.
- Atualizar a regra de empresas no `AGENTS.md` e salvar o mapeamento operação → marcas na memória do projeto.
