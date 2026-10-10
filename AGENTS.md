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

# AGENTS.md

- Physics/rheology formulas live only in `src/lib/rheology.ts`; the assistant's knowledge prompt (`src/lib/ai/knowledge.ts`) must be updated whenever they change. Why: the guide must describe the exact math the dashboard uses.
- The guide chat streams through the server route `src/routes/api/chat.ts` (Lovable AI Gateway, Responses API); the client sends a live dashboard snapshot in the request body. Why: keys stay server-side and answers can reference current readings.
- Never use `ref` as a data key in Recharts data. Why: Recharts spreads data fields onto elements, and a numeric `ref` crashes React.
- Leaflet is loaded via dynamic import inside a lazy, ClientOnly component. Why: Leaflet touches `window` at import time and breaks SSR.
