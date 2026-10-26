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

## Architecture rules

- All site content (articles, projects, contributors, Brief issues, FAQs) lives in typed data in `src/data/site.ts`; pages read from it so a CMS/DB can replace it later without touching layouts.
- Shared site UI lives in `src/components/site/` (primitives, cards, header, footer, page header); reuse these instead of per-page variants.
- Brand colors are CSS tokens in `src/styles.css`; components use token utilities only, never raw hex.
