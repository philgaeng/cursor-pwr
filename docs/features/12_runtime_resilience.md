# 12_runtime_resilience Specification

## Agent Execution

- Instruction reference: `docs/agent-instructions.md`
- Completion status: `in_progress` (organizer + attendee Postgres wired when `POSTGRES_URL` set; see `api/organizer-pg.js`, `api/attendee-pg.js`)
- Test status: `not_run`
- Last updated by: engineering (initial backlog)
- Last updated at: 2026-05-12

## Purpose

Define **what to build next** so NexusLink behaves reliably on **Vercel serverless** + **Supabase Postgres**: durable state, consistent auth, predictable failures, and operable deployments. This spec consolidates gaps discovered while wiring infra (in-memory APIs, missing DB writes, preview env parity).

## Scope

In scope:

- Persistence strategy for organizer and attendee runtime state (replacing `globalThis` maps and optional JSON-on-disk where inappropriate for production).
- Organizer opaque sessions compatible with **multi-instance** serverless.
- Environment configuration (Production vs Preview), secrets, and connection pooling.
- Client resilience (timeouts, stale local state, safe retries) at a **minimum** bar for MVP hardening.
- Observability hooks sufficient to debug production (`/api/health`, structured errors).

Out of scope (later):

- Multi-region active/active databases.
- Full SOC2 audit logging.
- Rate limiting / WAF (unless required by launch).

## Related documents

| Doc | Relevance |
|-----|-----------|
| [`docs/db/organizer.md`](../db/organizer.md) | Organizer tables and JSON shapes |
| [`docs/features/10_organizer_auth_and_event_store.md`](./10_organizer_auth_and_event_store.md) | Product model for organizer + events |
| [`supabase/migrations/`](../../supabase/migrations/) | Canonical DDL (`nl_*` tables) |
| [`docs/MVP.md`](../MVP.md) | MVP boundaries |

---

## Current resilience gaps (baseline)

| Area | Symptom | Root cause |
|------|---------|------------|
| Organizer API | `401` on `/api/organizer/*` after login | Sessions live in **`globalThis.__organizerSessions`** only; new serverless instance has empty map |
| Attendee data | Empty **`nl_*`** tables despite flows working | Handler uses **`store.*` Maps** in memory; SQL migration not wired in `api/handler.js` |
| Organizer data | Disk JSON works locally only | **`data/organizer-store.json`** not durable on Vercel; must align with Postgres |
| Preview deploys | Missing Supabase env vars | Integration often scopes vars to **Production** only |
| Client | Stuck “Loading route choices…” | **`localStorage`** can hold stale icebreaker state; mitigations partially implemented in `apps/web/main.js` |
| Dependencies | `url.parse()` deprecation noise in logs | Transitive dependency; track upgrades; low severity |

---

## Phased work items

Priorities: **P0** = blocks trustworthy production behavior; **P1** = strong MVP quality; **P2** = polish.

### Phase A — Organizer persistence and sessions (P0)

**Goal:** Organizer login and settings work on **any** Vercel instance.

1. **Persist organizer sessions** in **`nl_organizer_sessions`** (see [`docs/db/organizer.md`](../db/organizer.md)): on login, insert row with **`token_hash`** (hash of opaque token), **`organizer_id`**, **`expires_at`**; on each organizer API call, resolve by hash + expiry; delete or ignore expired rows.
2. **Stop relying on in-memory session map** for production paths (keep optional in-memory fallback behind `DEMO_MODE` or `VERCEL_ENV === 'development'` only if needed).
3. **Read/write `nl_organizers` and `nl_events`** from the API for signup, login, event CRUD, and settings saves — migrate shapes from `api/organizer-auth-store.js` / file store.
4. **One-time or scripted migration** from `data/organizer-store.json` (dev) into Postgres for testers who already have seed data.

**Acceptance:**

- After **login**, `GET/POST /api/organizer/settings` returns **200** on repeated requests and cold starts (simulate via redeploy or multiple concurrent requests).
- No plaintext session tokens stored in DB.

**Owner:** `api/` (Philippe per `AGENTS.md`).

---

### Phase B — Attendee runtime persistence (P0/P1)

**Goal:** Completed onboarding and match flows survive cold starts and appear in Supabase.

1. **Wire `POST /api/onboarding/*`, waves, matches, meetup** to **`nl_profiles`**, **`nl_onboarding_drafts`**, **`nl_waves`**, **`nl_match_actions`**, **`nl_meetup_preferences`**, **`nl_attendee_sessions`** as appropriate (see migration DDL).
2. **Choose DB access pattern:** `@supabase/supabase-js` with **service role** from server env only, or **`pg`** + **`POSTGRES_URL`** pooler — single approach per codebase; document in [`README.md`](../../README.md) or `docs/db/`.
3. **Event scoping:** align `event_id` with product (`demo-event-2026` today vs future `event_key` from URL/session).

**Acceptance:**

- After onboarding complete, **`nl_profiles`** has a row for `(user_id, event_id)` on Production when tested against wired deployment.
- Wave refresh does not “reset” candidates purely due to new lambda instance.

**Owner:** `api/`; contracts in `packages/shared/` if payloads change.

---

### Phase C — Configuration and deployments (P1)

**Goal:** Preview and local mirror Production capabilities where safe.

1. **Vercel Environment Variables:** replicate Supabase-related vars to **Preview** (and Development if using `vercel dev`) or document intentional isolation (e.g. separate Supabase project for previews — optional).
2. **Secrets:** confirm **`SUPABASE_SERVICE_ROLE`** / DB URLs never exposed to browser; anon key only if client talks to Supabase directly (not required if API-only).
3. **`vercel.json` / function bundle:** ensure server-only JSON (`api/icebreaker-routes.v1.json`) remains included for catalog reads.

**Acceptance:**

- PR Preview URL runs organizer + attendee happy path against configured backend without manual env hacks.

**Owner:** integration / whoever owns Vercel project settings.

---

### Phase D — Client hardening (P1)

**Goal:** Reduce support burden from stale browser state and ambiguous errors.

1. **Document** reset paths: “Clear saved route progress” (icebreakers), clearing **`nexuslink-web-state-v2`** for full reset — optional in-app “Reset demo progress” on settings/debug page.
2. **Idempotent saves** where cheap (e.g. organizer settings PUT semantics) — avoid duplicate rows from double-submit.
3. **Keep `apiFetch` timeout** behavior; surface **actionable** messages when `GET /api/routes/catalog` fails.

**Acceptance:**

- Documented recovery steps in [`README.md`](../../README.md) or user-facing FAQ snippet.

**Owner:** `apps/web/` (William).

---

### Phase E — Security and database hardening (P2)

**Goal:** Safe defaults before exposing Supabase to end users beyond the API.

1. **RLS:** enable Row Level Security on **`nl_*`** tables once access patterns are clear; policies for “organizer owns rows” vs “service role only.” Until then, **no direct browser queries** with anon key against sensitive tables.
2. **Session cleanup:** periodic delete of **`nl_organizer_sessions`** where **`expires_at < now()`** (cron, Edge Function, or Supabase scheduled job).
3. **Connection pooling:** use **pooler** URI for serverless handlers; direct URI for migrations only.

**Acceptance:**

- Threat model note in `docs/decisions/` if RLS deferred.

---

### Phase F — Observability (P2)

**Goal:** Enough signal to debug production without raw log dumps.

1. Ensure **`GET /api/health`** (or `/health` after rewrite strip) reports dependency readiness when DB is wired (optional lightweight DB ping).
2. Standardize JSON error shape already used (`ok`, `error`) — avoid leaking stack traces in production responses.

**Owner:** `api/`.

---

## Definition of done (this spec as a roadmap)

Treat each **phase** as shippable slices with their own PR:

- Phase A done → organizer portal trustworthy on Vercel.
- Phase B done → attendee data durable and visible in Supabase.
- Phases C–F → incremental; order can parallelize where ownership allows.

Update **`completion status`** at top of this file when phases complete; reference **`docs/MVP.md`** if MVP acceptance criteria need adjustment.

## Open questions

- **Single vs dual Supabase projects** for Preview vs Production (cost vs isolation).
- **JWT vs opaque DB sessions** for organizers if session table becomes a bottleneck (unlikely at MVP scale).
- Whether **`event_id`** for attendees becomes strictly **`nl_events.id`** once multi-event attendee flows exist.
