# Fluxo de Caixa detalhado por plano de contas

## Objetivo
Transformar o Fluxo de Caixa numa tabela detalhada por conta, com os meses nas colunas e três valores por mês (Previsto, Realizado e Delta), podendo abrir e fechar os níveis do plano de contas.

## O que será feito

1. **Meses nas colunas**
   - Cada mês (Jan a Dez) vira um bloco com três colunas: Previsto, Realizado e Delta (Realizado − Previsto).
   - Uma coluna final de Total no ano, com os mesmos três valores.
   - Rolagem horizontal com a coluna de descrição fixa à esquerda.

2. **Detalhamento pelo plano de contas**
   - Linhas organizadas em três níveis: Grupo → Subgrupo → Conta.
   - Cada nível mostra a soma dos níveis abaixo; a conta mostra os lançamentos do ano e da empresa selecionada.
   - Setas para abrir e fechar cada nível, além de botões "Expandir tudo" e "Recolher tudo".
   - Contas sem nenhum valor no ano ficam ocultas por padrão, com uma opção para mostrá-las.

3. **Resumo mantido no rodapé**
   - Total de entradas, total de saídas, variação do mês e saldo acumulado continuam no fim da tabela, agora também com Previsto, Realizado e Delta.

4. **Filtros já existentes**
   - Continua respeitando a empresa, a unidade de negócio e o ano escolhidos no topo do sistema.
   - Lançamentos cancelados seguem fora do cálculo.

## Validação
- Conferir com a Use Noronha em 2026: a soma das contas de entrada e de saída bate com os totais atuais do Fluxo de Caixa.
- Abrir e fechar grupos e conferir que os subtotais somam corretamente.
- Trocar de empresa e de ano e conferir que a tabela muda.

## Detalhes técnicos
- Nova consulta agregando `transactions` por `account_id` e mês, unindo `accounts → account_subgroups → account_groups` (hook novo em `src/lib/cashflow.ts`, reutilizando `useTransactions`, `useAccounts`, `useAccountSubgroups`, `useAccountGroups`).
- Previsto = `amount_expected` de linhas `previsto`; Realizado = `amount_realized` de linhas `realizado`; Delta = Realizado − Previsto. Saídas exibidas como negativas.
- Estado de expansão local (`useState` com um `Set` de ids); nenhuma mudança de banco de dados.
- Alterações concentradas em `src/routes/_authenticated/fluxo-de-caixa.tsx` mais o novo arquivo de agregação; `src/lib/forecast.ts` permanece para o Dashboard.
