<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep stock totals (closing cash balances) separate from flow totals in the cashflow totals helper: summing monthly balances misstates the end-of-period cash position.
- Cashflow uses completed company/year snapshots of Bling cash movements plus open-balance forecasts; invoice realized amounts never substitute actual cash dates or duplicate settlements.
- Sync cash and forecast pages in resumable phases, publishing a snapshot only after all phases finish, so partial API failures preserve the last complete cashflow.
- Derive install icons and favicon from the existing `RenderMark` artwork; store install images as asset pointers and keep the favicon local so browser and installed app identities stay aligned.

## render.os

Este repositório está sendo remodelado no **render.os**, o sistema único do Grupo Render Hub.

- Operações e marcas: `src/os/companies.ts` é a fonte única. `GROUP_OPERATIONS` lista as operações e cada marca em `GROUP_COMPANIES` aponta a sua em `operation`; telas agrupam marcas por operação a partir daí, sem listas próprias, para o agrupamento nunca divergir. Ids e slugs das marcas são as chaves dos dados e não mudam. Nortrip é a antiga Use Noronha e mantém o slug `use-noronha` no banco por causa do Bling. A&F foi desativada.
- Módulos: `src/os/modules.ts` define o trilho de ícones e o menu de cada módulo. Módulo novo = entrada `status: "soon"` até ter rotas próprias.
- Workspace ativo (grupo ou empresa): `useHubStore` em `src/lib/hub-store.ts`; o shell (`src/components/AppShell.tsx`) sincroniza a empresa do financeiro a partir dele.
- Visual: referência de painel claro com trilho escuro, painel cinza e conteúdo em cartão branco; primitivas de página em `src/components/os/page.tsx`.

- Import Union exports through authenticated, accounting-admin-only server functions; sanitize fields and map source identities server-side to preserve ownership without copying credentials.
- Keep source records in protected accounting archive rows and project supported entities into the existing accounting tables; idempotent inserts preserve render.os edits on retries.
- Prepare imported email accounts unconfirmed, without bulk emails or passwords; first access requires email verification and new-password setup before using their mapped records.
