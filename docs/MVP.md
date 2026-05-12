# MVP Scope (NexusLink)

This file is the live source of truth for MVP scope for **NexusLink**: intent-based networking at live events (onboarding, icebreakers, match waves, privacy-safe intros).

Module-level behavior and acceptance criteria live in `docs/features/*.md` and `docs/resource/*`.

PR/integration gate checklist: `docs/ACCEPTANCE_CRITERIA.md` (when present).

## Runtime and deployment (single path)

The MVP ships as a **Vercel** project. Do **not** maintain a second local-only API server as the primary backend.

| Layer | Location | Notes |
|--------|-----------|--------|
| Static UI | `apps/web/*` | Served via `vercel.json` rewrites to the site root and asset paths. |
| HTTP API | `api/handler.js` | Single serverless entry; routes are invoked as `/api/...` per `vercel.json`. |
| Durable data | **Supabase (Postgres)** | Schema migrations live under `supabase/migrations/`. The API uses server-side connection env vars from Vercel (see integration); in-memory / JSON-on-disk remain acceptable only for narrow local/dev fallbacks until routes are wired to SQL. |
| Icebreaker catalog | `docs/resource/icebreaker-routes.v1.json` | Bundled with the deployment; read by the handler at runtime. |

**Deployment (typical):** connect the Git repo to Vercel and **push branches**; Vercel builds and deploys **Preview** (per branch/PR) and **Production** (your production branch). No Vercel CLI is required for deploy if you use Git sync.

**Full-stack local behavior:** the browser must load the app from an origin that serves **`/api/*`** and static pages together (same origin, as in production). Practical options:

1. **Use a Vercel Preview or Production URL** after your changes are pushed (matches Git-only workflow).
2. **Optional:** from the repo root, `npx vercel dev` reproduces routing locally without relying on Git deploy for every edit.

Serving only `apps/web` with a plain static file server **without** one of the above will break API calls, because `main.js` calls relative `/api/...` paths.

**Optional override:** set `window.API_BASE_URL` before `main.js` loads only for advanced debugging (e.g. pointing at another deployment). The default is same-origin (empty base).

## Product goals (MVP)

1. Event attendee can complete onboarding: auth (or manual bootstrap) → profile (offers/seeks) → icebreaker routes (mobile tile flow per `docs/features/03_icebreaker_questions.md`) → consent → match wave → like/pass → vault state.
2. Organizer can load/save event settings used by the demo API.
3. API returns predictable JSON; errors use an `error` string (and `ok: false` where applicable) for client display.

## Non-goals (MVP)

- Multi-region HA database topology (a single Supabase Postgres project is sufficient for MVP scale).
- Separate long-lived Node process as the canonical API (`apps/api/server.js` removed; see `apps/api/README.md`).
- Full LinkedIn/Google OAuth production hardening (demo/session stubs only unless spec says otherwise).

## Acceptance criteria (high level)

- [ ] Deployed Vercel preview or production loads the web shell and successfully calls `/api/routes/catalog` and other onboarding endpoints on the **same origin**.
- [ ] Full happy path is reproducible on a **Git-built** Preview or Production deployment (or optionally via `npx vercel dev`); no separate ad-hoc API port.
- [ ] Feature specs in `docs/features/` remain aligned with implemented behavior (update specs first on conflict).
- [ ] Agents and contributors follow `docs/agent-instructions.md` for ownership and runtime assumptions.

## API surface (reference)

All paths are relative to the deployment origin (e.g. `POST /api/auth/session`). Canonical list and payloads should stay aligned with `apps/web/main.js` and `api/handler.js`.

Minimum routes used by the current web app:

- `POST /api/auth/session`, `POST /api/auth/manual-bootstrap`, `POST /api/auth/demo-login`
- `GET /api/routes/catalog`, `GET /api/tags/catalog`
- `GET /api/organizer/settings`, `POST /api/organizer/settings`
- `POST /api/onboarding/profile`, `POST /api/onboarding/questions`, `POST /api/onboarding/complete`
- `GET /api/waves/current`, `POST /api/waves/trigger`, `POST /api/matches/action`
- `GET /api/health` (via rewrite to handler; health path inside handler is `/health` after strip)

## Ownership (see also `AGENTS.md`)

- **William:** `apps/web/`
- **Philippe:** `api/` (Vercel serverless handler and API behavior)
- **Rojel:** `packages/shared/`, integration, QA, delivery

## Open questions

- **Auth beyond MVP:** whether attendee flows move to Supabase Auth (or another IdP) vs. keeping stub/demo auth on the handler while Postgres stores state.
- Contract formalization: whether to regenerate `packages/shared` types from a single OpenAPI/schema for the handler.

## Resilience and persistence roadmap

Engineering backlog for serverless + Postgres hardening (sessions, DB wiring, env parity): [`docs/features/12_runtime_resilience.md`](features/12_runtime_resilience.md).
