# Novo plano de contas da Use Noronha, De/Para e remoção da DRE

## Objetivo
Adotar o plano de contas e o De/Para enviados nos arquivos, reclassificar todos os lançamentos já puxados do Bling e retirar a tela DRE do sistema.

## O que será feito

1. **Novo plano de contas (117 contas, 14 grupos)**
   - Cadastrar os grupos e contas do arquivo enviado para a Use Noronha, com os códigos do arquivo (1.01, 2.01, 3.01 ...) e a natureza (entrada/saída) indicada.
   - Desativar as contas antigas que não constam no novo arquivo (elas somem das listas, mas o histórico continua preservado).
   - As contas provisórias "A Classificar (Bling)" continuam existindo para lançamentos sem correspondência.

2. **Novo De/Para (47 correspondências)**
   - Substituir as correspondências atuais pelas do arquivo, ligando cada categoria vinda do Bling à conta interna correspondente.
   - A tela Plano de Contas continua permitindo ajustar as correspondências manualmente.

3. **Reclassificar tudo que veio da API**
   - Reaplicar o De/Para em todos os lançamentos importados do Bling (2026), inclusive os que já estavam classificados, apontando para as novas contas.
   - Ajustar a rotina de importação e o botão "Reclassificar" da tela Financeiro para trabalhar sobre o novo plano.

4. **Remover a tela DRE**
   - Tirar a página DRE e o item de menu.
   - Dashboard, Lançamentos, Fluxo de Caixa e Simulações continuam funcionando normalmente com as novas contas.

## Validação
- Conferir que a tela Plano de Contas mostra os 14 grupos e as contas do arquivo, e as antigas aparecem como inativas.
- Conferir que os 1.389 lançamentos do Bling ficam com as contas novas e que nenhum fica sem classificação indevidamente.
- Conferir os totais no Dashboard e no Fluxo de Caixa antes e depois da reclassificação (os valores totais não podem mudar, só a classificação).
- Conferir que o menu não tem mais DRE e que nenhuma outra tela quebra.

## Detalhes técnicos
- Migração de dados: inserir `account_groups`/`account_subgroups`/`accounts` da Use Noronha a partir do CSV; um subgrupo por grupo. `dre_section` de cada grupo: Receitas Operacionais → receita_bruta; Deduções → deducoes; Custos → custos; Despesas Administrativas → despesas_administrativas; Pessoal, Manutenção e Estrutura → despesas_operacionais; Comerciais → despesas_comerciais; Receitas Financeiras → receitas_financeiras; Despesas Financeiras → despesas_financeiras; Imobilizado → investimentos; Empréstimos, Transferências e Não Operacionais → nao_operacional. A coluna permanece no banco mesmo sem a tela DRE.
- Contas antigas fora do novo arquivo recebem `active = false`; nada é apagado, preservando as chaves estrangeiras de `transactions`.
- `account_mappings` da Use Noronha é limpo e recriado com as 47 linhas do CSV, resolvendo `account_id` pelo código interno.
- Reclassificação em `src/lib/bling.server.ts`: remover a condição que só ajusta contas provisórias, passando a reaplicar o De/Para em todos os registros com `external_source = 'bling'` da empresa.
- Remoção de `src/routes/_authenticated/dre.tsx`, do link no `AppShell` e dos usos exclusivos de `useAccountsWithDre`/`src/lib/dre.ts` que ficarem órfãos.
