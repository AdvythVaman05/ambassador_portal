# Rothenhall Campus Scouts website prototype

An independent public-facing prototype for Rothenhall Campus Scouts. It explains the proposed student initiative, communicates Rothenhall’s AI-era growth perspective, and gives illustrative examples of articles, projects, contributor profiles, and the proposed Rothenhall Brief publication.

## Objectives

The prototype explains Rothenhall Partners’ AI-era growth perspective, introduces Campus Scouts, showcases student-work formats, and explores the proposed Rothenhall Brief publication.

Campus Scouts is presented as flexible, part-time, and unpaid. All people, projects, articles, and Brief issues are demonstration content.

## Local setup

The project uses the existing `bun.lock` and `bunfig.toml` setup. Use Bun where available:

```sh
bun install
bun run dev
```

Available scripts are `build`, `build:dev`, `preview`, `lint`, `format`, `test`, and `test:watch`.

## Implemented routes

`/`, `/about`, `/insights`, `/insights/:slug`, `/scouts`, `/scouts/:slug`, `/projects`, `/projects/:slug`, `/brief`, `/brief/:slug`, `/apply`, and `/faq` are implemented. Unknown paths use the root not-found experience.

## Stack and design

React 19, TypeScript, TanStack Start/Router, Vite, Tailwind CSS 4, Radix UI primitives, Lucide icons, Vitest, and ESLint/Prettier. The site uses an ivory editorial canvas, cognac/brass accents, dark obsidian surfaces, Jost display type, and Instrument Sans body text. The supplied 1029×180 logo is stored at `public/rothenhall-partners-logo.png` and rendered without cropping or distortion.

## Verification

- Production build: passed.
- TypeScript: passed.
- ESLint: passed with seven existing Fast Refresh warnings and no errors.
- Vitest: passed, 1 test file and 1 test.
- Browser route smoke checks and representative article-search/application-validation checks: passed.
- Exact 375/768/1024/1440 viewport screenshots were not run because the browser session did not expose viewport resizing controls.

## Prototype limitations

Application and newsletter forms validate locally but do not transmit or persist information. No database, authentication, mailing service, analytics, CMS, or production editorial workflow is connected.

## Confirmation needed

Rothenhall must confirm selection criteria, program duration, expected workload, progression criteria, recognition, publication policy, and application-data handling. The site makes no promises of pay, merchandise, internships, employment, recommendations, client introductions, or guaranteed publication.

## Relationship and future work

This is a separate public-facing prototype, not a replacement for or merge target of the original [Rothenhall/ambassador_portal](https://github.com/Rothenhall/ambassador_portal). Next steps are approving policy/content, connecting reviewed submission services, adding viewport visual regression checks, and replacing demonstration data with approved records.

## Technology

- TanStack Start / Router
- TypeScript / React
- Tailwind CSS / Radix UI
- Vite / Vitest / ESLint / Prettier
