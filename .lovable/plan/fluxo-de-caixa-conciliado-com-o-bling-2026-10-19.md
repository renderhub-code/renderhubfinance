# Fluxo de Caixa conciliado com o Bling

## Antes da alteração: origem das datas

| Uso | Hoje | Após a correção |
|---|---|---|
| Realizado | A importação lê `GET /contas/receber` e `GET /contas/pagar`. A tela usa `dataEmissao`, com fallback para `vencimento`. O campo interno `settled_date` também recebe incorretamente `vencimento`. | Cada movimentação efetiva de Caixas e Bancos, consultada em `GET /caixas/{idCaixa}`, usa `data` e `valor`. Para movimentos cuja `origem.tipo` é `bordero`, a data de baixa também está em `GET /borderos/{idBordero}` → `data`. |
| Previsto | Valor integral agrupado por emissão ou vencimento, conforme preenchimento. | `vencimento` e `saldo` das contas abertas ou parcialmente pagas/recebidas. |

A documentação oficial confirma esses campos: [Referência da API v3 do Bling](https://developer.bling.com.br/referencia). A conferência dos dados reais vem antes da reimportação. Não será usado vencimento como substituto da data da baixa.

## O que será corrigido

1. **Caixa efetivo e pagamentos parciais**
   - Conferir amostras de contas, borderôs e movimentos de Caixas e Bancos antes de gravar mudanças.
   - Usar os movimentos de caixa registrados como fonte do Realizado, preservando data, valor, categoria e identificador de cada movimento. Não somar novamente o valor pago da conta a pagar/receber.
   - Consultar o período pela data da movimentação: incluir pagamentos de contas vencidas em outro ano e não incluir pagamentos feitos fora do período.
   - Manter a parte ainda em aberto de pagamentos parciais no Previsto, pelo vencimento.
   - Preservar lançamentos manuais e impedir duplicação nas próximas sincronizações diárias.

2. **Categorias e De/Para**
   - Conferir as contas de destino e corrigir Vendas de serviços, Vendas de produtos e Vendas de mercadorias para o grupo 1 – Receitas Operacionais.
   - Reaplicar essas correspondências aos movimentos já importados, inclusive setembro e outubro.
   - Renomear X5 para Sem categoria (classificar no Bling), com destaque quando houver valores.
   - Reaproveitar a tabela editável de De/Para que já existe em Plano de Contas, tornando a categoria do Bling e a conta de destino explícitas e acessíveis pelo Fluxo de Caixa.

3. **Operação e sócios**
   - Identificar ajustes e transferências por indicadores oficiais dos movimentos (`saldo` e `transferencia`) e categorias conferidas; não apenas por palavras na descrição.
   - Excluir ajustes de saldo e transferências próprias dos totais de Entradas/Saídas.
   - Separar aportes e retiradas em Aportes / Movimentações dos sócios. Eles afetam a variação do caixa, sem integrar receitas/despesas operacionais.

4. **Saldo inicial e final**
   - Disponibilizar saldo inicial por empresa e ano, informado manualmente. Não presumir que o saldo atual das contas seja o saldo de 01/01/2026.
   - Aproveitar um saldo histórico do Bling somente se a consulta comprovar que é referente à data solicitada.
   - Sem saldo inicial informado ou comprovado, indicar que o saldo absoluto está pendente, em vez de apresentar zero como saldo confirmado.
   - Calcular saldo mensal como saldo anterior + movimentações líquidas, incluindo sócios.
   - O Total do Saldo acumulado será apenas o último saldo do período, nunca a soma dos saldos mensais.

5. **Conciliação e validação**
   - Mostrar Bling × Plataforma × diferença mensal para entradas operacionais e saídas, com data da última sincronização e tolerância de R$ 1,00.
   - Manter os valores enviados como referências do relatório, identificadas como tal; não alterar os dados para forçar igualdade.
   - Conferir janeiro a setembro pelos valores do arquivo e outubro com R$ 52.310,93 operacionais e R$ 7.000,00 em aportes.
   - Se houver diferença, listar os movimentos que a explicam e indicar meses não conciliados. Valores de outubro representam a conferência enviada, não um limite para novas entradas.

## Detalhes técnicos

- Armazenar movimentos de caixa separadamente das contas a pagar/receber, com identificadores externos únicos e registros de sincronização; evitar que outras telas contem a mesma baixa duas vezes.
- Usar `GET /caixas` para listar o período e `GET /caixas/{idCaixa}` para categoria, origem e indicadores. O detalhe do borderô informa `pagamentos[].valorPago`, mas não apresenta um identificador da conta em cada item: não atribuir arbitrariamente a soma de um borderô compartilhado a uma única conta.
- Conferir o significado de débito/crédito em amostras reais antes de definir entrada/saída. Tratar limites da API, falhas e sincronizações incompletas sem substituir dados válidos por resultados incompletos.
- Manter as permissões existentes e proteger configurações e movimentações por empresa.
- Adicionar testes pequenos para datas de baixa, pagamentos parciais em meses distintos, saldo em aberto, transferências, ajustes, sócios e Total do saldo final; validar a tela com os dados da Use Noronha.

## Ponto de aprovação

Nenhum cálculo ou dado financeiro foi alterado nesta etapa. A aprovação autoriza implementar e reimportar as movimentações para fazer a conciliação; publicação não está incluída.