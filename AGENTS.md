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
