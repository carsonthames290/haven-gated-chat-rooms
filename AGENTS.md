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

- Room moderation uses a host-validated database RPC and message validation trigger; client controls are never the security boundary.
- Timed moderation expires by comparing stored deadlines with the current time, and room membership polling keeps moderation updates reliable without realtime delivery.
