# Trazer do hub-finance-master a estrutura das outras empresas

Objetivo: copiar do repositório `hub-finance-master` como funcionam as empresas que não são a Use Noronha (Union Contadores, Render Comex, Dom Pablyto, ERKS, A&F): dashboard, simulações, plano de contas e De/Para. A Use Noronha fica exatamente como está hoje.

## Bloqueio atual

O link do GitHub é privado, e por isso não consegui abrir o código. Antes de começar, preciso de uma destas opções:
- deixar o repositório público por alguns minutos, ou
- anexar o ZIP do código aqui (no GitHub: Code → Download ZIP).

## Etapas (depois do acesso)

1. **Comparar**: levantar o que o repositório tem por empresa (telas, plano de contas, De/Para, simulações, indicadores do dashboard) e o que muda em relação a este projeto.
2. **Plano de contas e De/Para**: cadastrar o plano e as regras de cada empresa que não seja a Use Noronha. Contas que já existem serão desativadas, sem apagar nada.
3. **Dashboard**: aplicar os indicadores e cartões de cada empresa que existirem no repositório.
4. **Simulações**: trazer os modelos de simulação de cada empresa. A simulação comercial hoje só aparece para Render Comex e Use Noronha; isso será liberado conforme o repositório.
5. **Outras telas**: aplicar as diferenças encontradas em Lançamentos, Centros de Custo e Fluxo de Caixa, sem mexer na sincronização com o Bling nem na conciliação da Use Noronha.
6. **Validar**: entrar como Controller, alternar entre os hubs e confirmar que cada empresa abre a sua própria estrutura sem erros.

## Detalhes técnicos

- Somente o código e o schema vêm do repositório. Os lançamentos reais de outras empresas não vêm junto; se existirem, precisam ser enviados em CSV.
- Regras exclusivas da Use Noronha (o Bling, as fotos do caixa, o saldo inicial) continuam presas à empresa `use-noronha`.
- O que for diferente para cada empresa vai seguir o slug da empresa (já existe em `hub-store.ts`), sem duplicar telas.
