# Replicar o Hub Financial Command neste projeto

O arquivo enviado é o código-fonte completo de uma plataforma financeira (Union Contadores / Hub Financial Command), construída na mesma stack deste projeto. O plano é recriá-la aqui, funcionando de ponta a ponta.

## O que a plataforma faz

- Landing pública + tela de login/cadastro
- Área autenticada com troca entre 6 hubs/empresas (Union Contadores, Render Comex, Use Noronha, Dom Pablyto, ERKS, A&F)
- Dashboard financeiro
- Plano de contas hierárquico (editor, importação por Excel, tabela De/Para)
- Lançamentos (lista + importação de planilha)
- Fluxo de caixa (realizado x previsto, mês a mês)
- DRE mensal com acumulado
- Centros de custo
- Simulações comerciais (cenários aplicados ao previsto)

## Etapas

1. **Ativar o Lovable Cloud** (banco, autenticação, funções de servidor) — a plataforma depende disso para tudo.
2. **Aplicar o banco de dados**: recriar as 11 migrações do pacote (empresas, unidades de negócio, perfis, papéis de usuário, plano de contas, lançamentos, centros de custo, simulações), com RLS, GRANTs e as funções de segurança já definidas no original, além das empresas iniciais.
3. **Copiar o código-fonte da aplicação**: rotas, componentes, hooks e libs de cálculo (DRE, previsão, formatação), incluindo os componentes de UI usados.
4. **Instalar as dependências extras** que o projeto atual ainda não tem (xlsx, zustand, recharts, react-hook-form etc.).
5. **Religar as integrações**: os clientes de banco/autenticação e o middleware de sessão serão regerados pelo Cloud deste projeto, não copiados do pacote (as chaves antigas não valem aqui).
6. **Validar**: criar conta, entrar, navegar por todas as telas e confirmar que os dados carregam sem erro.

## Detalhes técnicos

- Stack idêntica (TanStack Start + React 19 + Tailwind v4 + shadcn), então o código entra praticamente sem adaptação.
- `.env`, `bun.lock`, `package-lock.json` e o histórico de planos do pacote não serão copiados.
- `src/integrations/supabase/*` e `src/start.ts` serão os gerados por este projeto; apenas `types.ts` será regerado a partir do novo schema.
- Os dados de negócio (lançamentos reais, plano de contas preenchido) não vêm no pacote — só o schema. A base começa vazia, com as empresas cadastradas; o conteúdo entra pela importação de Excel já existente na plataforma.

## Pergunta em aberto

Se você tiver os dados reais (export do banco ou planilhas), pode enviar depois que a base estiver de pé e eu importo.
