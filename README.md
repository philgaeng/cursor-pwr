# cursor-pwr

MVP project for **NexusLink**: intent-based networking at live events (onboarding, icebreakers, match waves, privacy-aware intros).

## Team

- William — frontend (`apps/web/`)
- Philippe — API (`api/handler.js`, Vercel serverless)
- Rojel — shared contracts, integration, QA (`packages/shared/`)

## Run and test the full stack

The web app calls **same-origin** `/api/...`. That works automatically on Vercel (see `vercel.json`).

**If you deploy with Git → Vercel (no CLI):** push your branch, open the **Preview** URL Vercel assigns to that commit (or your **Production** URL). That is the primary way to exercise onboarding + API together.

**Optional local full stack:** from the repo root, `npx vercel dev` serves the same URL layout as production when you want to iterate without pushing.

**Optional:** override the API base in the browser with `window.API_BASE_URL` before loading `main.js` (advanced debugging only).

## Deploy

Connect the repo to [Vercel](https://vercel.com) and use **Git integration** (push to trigger builds). `vercel.json` routes `/api/*` to `api/handler.js` and serves `apps/web` for page requests. The Vercel CLI is not required for deploy if you sync via Git.

## Docs

- `docs/MVP.md` — scope, Vercel-only runtime, acceptance criteria
- `docs/agent-instructions.md` — agent rules and ownership
- `docs/features/` — feature specs
- `AGENTS.md` — contributor workflow

## Collaboration

- Keep PRs small; align API behavior in `api/handler.js` with `apps/web/main.js`.
- Record architectural decisions in `docs/decisions/` when behavior changes materially.
