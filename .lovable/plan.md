# Reclassificar lançamentos Bling pelo De/Para

## Contexto

A integração Bling ↔ Use Noronha já está aplicada e funcional: aba Financeiro com 4 abas de dados, importação para `transactions` e 55 mapeamentos De/Para cadastrados. Porém os **1.389 lançamentos já importados** (865 saídas `5.2.999` + 524 entradas `1.1.999`) foram gravados nas contas "A Classificar (Bling)" antes do De/Para existir, e a importação não reprocessa registros existentes.

## O que será feito

1. **Nova função server-side** `reclassifyBlingTransactions` (em `bling.functions.ts` + helper em `bling.server.ts`):
   - Busca novamente no Bling as contas a pagar e a receber do ano corrente (endpoints de listagem já incluem `categoria.id` — sem chamada extra por registro).
   - Para cada conta, resolve a categoria → conta do plano via `account_mappings` (mesma lógica da importação, incluindo normalização de acentos e validação do tipo entrada/saída).
   - Atualiza `transactions.account_id` **somente** dos lançamentos da Use Noronha com `external_source = 'bling:*'` cuja conta atual seja uma das duas "A Classificar (Bling)" (`1.1.999` / `5.2.999`). Lançamentos já classificados manualmente ou por outra regra não são tocados.
   - Retorna um resumo: quantos reclassificados, quantos permanecem em "A Classificar" (sem categoria ou sem mapeamento).

2. **Botão "Reclassificar"** na página Financeiro (`financeiro.tsx`), ao lado do botão "Importar", visível quando conectado:
   - Ao clicar, roda a função e mostra um toast com o resultado (ex.: "1.200 reclassificados, 189 sem categoria mapeada").
   - Invalida as queries para Dashboard, Lançamentos, DRE e Fluxo de Caixa refletirem na hora.

3. **Validação**: rodar a reclassificação e conferir no banco quantos permanecem em "A Classificar" e em quais contas os demais foram distribuídos.

## Notas técnicas

- Nenhuma mudança de schema — apenas código (`src/lib/bling.server.ts`, `src/lib/bling.functions.ts`, `src/routes/_authenticated/financeiro.tsx`).
- Sem risco de duplicidade: é um UPDATE em registros existentes, identificados por `external_source` + `external_id`.
- Categorias homônimas (ex.: "Bebidas" como receita e despesa) são desambiguadas pelo tipo do lançamento, como já ocorre na importação.
- Lançamentos que ficarem sem correspondência serão listados no resultado para você revisar o De/Para depois, se quiser.
