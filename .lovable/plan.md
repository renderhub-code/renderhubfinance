# Conectar os dados da Use Noronha a todas as telas financeiras

## Objetivo
Substituir os conteúdos genéricos e placeholders por dados reais dos lançamentos importados do Bling, sempre respeitando a empresa selecionada no cabeçalho e o ano exibido.

## Implementação

1. **Filtro comum de empresa, ano e unidade**
   - Criar um estado compartilhado para o ano financeiro e usá-lo no Dashboard, Lançamentos, DRE, Fluxo de Caixa e Simulações.
   - Aplicar a empresa selecionada em todas as consultas; para a Use Noronha, exibir somente seus lançamentos importados e manuais.
   - Aplicar unidade de negócio quando houver seleção, sem ocultar lançamentos sem unidade indevidamente na visão consolidada.

2. **Dashboard real**
   - Manter os KPIs alimentados por `transactions`, mas separar claramente previsto, realizado e resultado.
   - Exibir os lançamentos recentes com conta, descrição, status e origem Bling.
   - Atualizar os números ao importar ou reclassificar.

3. **Lançamentos completos**
   - Remover as linhas fixas com traços e listar os lançamentos reais da empresa/ano.
   - Mostrar datas, descrição, conta classificada, tipo, status, valor previsto, valor realizado e origem.
   - Incluir estados de carregamento e lista vazia.

4. **DRE por classificação contábil**
   - Agregar os lançamentos por mês e pela seção DRE do grupo contábil vinculado à conta.
   - Exibir realizado, previsto e total por linha, incluindo receitas, deduções, custos, despesas operacionais/administrativas/comerciais, resultado operacional, financeiro e resultado líquido.
   - Eliminar as linhas estáticas que hoje exibem apenas traços.

5. **Fluxo de Caixa real**
   - Usar lançamentos realizados para o caixa realizado e lançamentos previstos para a projeção.
   - Calcular entradas, saídas, variação e saldo acumulado mês a mês.
   - Remover linhas cosméticas sem fonte de dados ou vinculá-las às seções contábeis correspondentes.

6. **Simulações com realizado como base**
   - Disponibilizar a simulação comercial também para a Use Noronha, não apenas para o hub Render.
   - Mostrar os valores realizados importados do Bling por conta e mês ao lado dos valores previstos da simulação.
   - Manter os dados reais somente como referência: editar/aplicar a simulação continuará criando ou alterando apenas lançamentos previstos, sem sobrescrever o realizado.

7. **Atualização e consistência**
   - Trocar a invalidação global por invalidação explícita das consultas financeiras afetadas após importar, reclassificar, aplicar ou reverter uma simulação.
   - Corrigir consultas que atualmente consideram somente `previsto` quando a tela também precisa refletir o realizado.
   - Preservar a vinculação exclusiva do Bling com a Use Noronha e sinalizar isso na tela Financeiro.

## Validação
- Comparar os totais exibidos com os 1.389 lançamentos Bling existentes da Use Noronha no ano de 2026.
- Conferir Dashboard, Lançamentos, DRE, Fluxo de Caixa e Simulações usando a empresa Use Noronha.
- Confirmar que trocar de empresa muda os dados e que voltar para Use Noronha restaura os mesmos totais.
- Confirmar que uma nova importação/reclassificação atualiza todas as telas sem recarregar a aplicação.

## Detalhes técnicos
- Fonte principal: `transactions`, associada a `accounts → account_subgroups → account_groups` para classificação da DRE.
- Caixa realizado: `status = realizado`, usando `amount_realized`; projeção: `status = previsto`, usando `amount_expected`.
- Simulações permanecem em `simulations` e `simulation_lines`; o realizado será lido de `transactions` e apresentado como comparação, sem duplicação de dados.
