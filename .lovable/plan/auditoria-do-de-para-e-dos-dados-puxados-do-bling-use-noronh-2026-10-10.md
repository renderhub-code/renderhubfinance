# Auditoria do De/Para e dos dados puxados do Bling (Use Noronha)

## Objetivo
Conferir se cada correspondência do De/Para aponta para a conta certa do plano enviado e se os lançamentos gravados no sistema batem com o que está no Bling. Nesta etapa nada é alterado: o resultado é um relatório.

## O que será analisado

1. **De/Para x arquivos enviados**
   - Comparar as correspondências cadastradas com `UseNoronha_De_Para.csv`: as que faltam, as que sobram e as que apontam para uma conta diferente.
   - Verificar se cada conta de destino existe, está ativa e tem o tipo certo (uma categoria de receita não pode cair numa conta de saída, e o contrário também).
   - Listar as contas do plano que não recebem nenhuma categoria do Bling.

2. **Categorias do Bling x De/Para**
   - Buscar no Bling a lista completa de categorias financeiras.
   - Mostrar quais categorias usadas nos lançamentos não têm correspondência. Elas explicam os 61 lançamentos que estão em "A Classificar".
   - Apontar nomes parecidos ou repetidos que podem estar causando classificação errada.

3. **Lançamentos gravados x Bling**
   - Quantidade e valores por mês, por contas a pagar e a receber, comparando o Bling com o sistema em 2026.
   - Situação: conferir se o que está pago/recebido no Bling aparece como realizado no sistema, e se o que está em aberto aparece como previsto.
   - Procurar lançamentos duplicados, lançamentos que existem só de um lado e diferenças de valor ou data.
   - Por amostragem, conferir se a conta escolhida para cada lançamento corresponde à categoria dele no Bling.

## Entrega
- Um resumo no chat com os problemas encontrados e a sugestão de correção para cada um.
- Uma planilha Excel com abas: De/Para conferido, Categorias sem correspondência, Lançamentos em "A Classificar", Diferenças Bling x Sistema e Totais por mês.
- As correções só serão aplicadas depois que você aprovar.

## Detalhes técnicos
- Leitura de `account_mappings`, `accounts`, `account_groups` e `transactions` (com `external_source` do Bling) da Use Noronha.
- Script temporário que usa o token do Bling guardado no sistema para ler categorias, contas a pagar e contas a receber de 2026, com pausa e novas tentativas quando o Bling limitar as chamadas.
- O cruzamento é feito por `external_id`. A planilha é salva em /mnt/documents.
