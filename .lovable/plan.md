# Agenda de reuniões com clientes no Contábil

## O que será entregue

Uma agenda de reuniões dentro do Contábil, com um link público que a equipe envia aos clientes. O cliente abre o link, vê os horários livres do Caio Oliveira, escolhe um e confirma. O horário escolhido passa a aparecer como esgotado para todos os outros clientes.

A agenda fica só no sistema por enquanto, sem ligação com o Google Agenda.

## Como o Caio usa (dentro do Contábil)

Novo item no menu do Contábil: **Agenda de reuniões**.

- Calendário mensal, no estilo do Google Agenda, com os horários abertos e as reuniões marcadas de cada dia.
- Abrir horários: escolhe o dia, a hora de início e a duração de cada horário (ele define caso a caso). Também pode abrir vários de uma vez, por exemplo "terças e quintas, das 9h às 12h, a cada 45 minutos, pelas próximas 4 semanas".
- Editar ou remover um horário ainda livre.
- Ver cada reunião marcada: nome do cliente, empresa, e-mail, telefone, assunto e se será online ou presencial.
- Cancelar uma reunião, o que libera o horário de novo no link.
- Configurar os dados usados no link: endereço do escritório (para reuniões presenciais) e o link da videochamada (para reuniões online).
- Botão **Copiar link** para enviar ao cliente.

Quem pode editar: o Caio e os administradores do Contábil. Os demais membros da equipe apenas visualizam.

## Como o cliente usa (link público, sem login)

1. Abre o link e vê o nome do Caio e um calendário com os dias que têm horário livre.
2. Escolhe o dia e depois um dos horários. Horários já escolhidos por outro cliente aparecem como **Esgotado**.
3. Preenche nome, empresa, e-mail, telefone e assunto, e escolhe **online** ou **presencial**.
4. Confirma e vê a tela de confirmação com data, hora e o link da videochamada ou o endereço.

Se dois clientes tentarem o mesmo horário ao mesmo tempo, só o primeiro consegue; o segundo é avisado e escolhe outro.

Horários que já passaram não aparecem. Todos os horários são exibidos no horário de Recife.

## Fora deste plano

- Ligação com o Google Agenda (pode ser adicionada depois).
- Envio de e-mail de confirmação ao cliente ou aviso ao Caio. A confirmação aparece na tela e a reunião aparece na agenda do Caio no sistema.
- Agenda para outras pessoas da equipe. A estrutura já permite, mas a tela começa só com a do Caio.

## Detalhes técnicos

Dados (Lovable Cloud, com permissões e regras de acesso por linha):

- `contabil_agendas`: uma agenda por membro (dono = `contabil_membros.user_id` do Caio Oliveira), com código do link, endereço presencial, link de videochamada e situação ativa.
- `contabil_agenda_horarios`: início, fim, agenda. Sem sobreposição dentro da mesma agenda.
- `contabil_agenda_reservas`: horário, nome, empresa, e-mail, telefone, assunto, modalidade (`online`/`presencial`), situação (`confirmada`/`cancelada`). Índice único parcial em `horario_id` para reservas confirmadas, garantindo um cliente por horário.
- Leitura e edição pelo app: apenas membros do Contábil autenticados; escrita restrita ao dono da agenda e a `contabil_is_admin`. Nenhum acesso direto para visitantes anônimos.

Link público:

- Rota `src/routes/agendar.$codigo.tsx`, fora de `_authenticated`.
- Server functions públicas: uma lista os horários futuros e se estão livres (sem expor dados de outros clientes), outra faz a reserva. Ambas validam a entrada com Zod, usam o cliente de servidor e nunca devolvem dados pessoais das reservas.
- A reserva depende do índice único; conflito vira a mensagem "horário acabou de ser escolhido".

Telas internas:

- Rota `src/routes/_authenticated/contabil.agenda.tsx` com `ContabilGate` e `contabilHead`.
- Item em `src/os/modules.ts` (`con.agenda`, escopo `union`).
- Hooks em `src/os/contabil/`, seguindo o padrão de `hooks.ts`.

Testes:

- Geração de horários em lote (intervalo, duração, dias da semana).
- Regra de horário esgotado e de liberação após cancelamento.

Validação no app: abrir horários como o Caio, reservar pelo link sem login, conferir que o horário fica esgotado e que a reunião aparece na agenda interna; repetir em tela de celular.

## Ideias opcionais

- Lembrete por e-mail ao cliente na véspera.
- Vincular a reserva a uma empresa já cadastrada em Empresas clientes.
- Antecedência mínima para agendar (por exemplo, 24 horas).
