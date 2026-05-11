# Agent Instructions and Boundaries

This document defines execution rules for agents working on NexusLink specs and implementation.
Feature behavior and requirements live in `docs/features/*.md`.

## Source of Truth

- Product/module requirements: `docs/features/*.md`
- Route/resource definitions: `docs/resource/*`
- MVP scope and acceptance criteria: `docs/MVP.md`
- Shared contracts/types: `packages/shared/*`
- **HTTP API implementation:** `api/handler.js` (Vercel serverless; exercised via **Git-built** Preview/Production URLs, or optionally `npx vercel dev` from repo root)

If there is a conflict, resolve in this order:
1. `docs/MVP.md`
2. Relevant `docs/features/<module>.md`
3. Implementation files

## Ownership Boundaries

- Frontend owner area: `apps/web/*`
- **Backend owner area: `api/*` (Vercel serverless — primary file `api/handler.js`)**
- Shared contracts/integration: `packages/shared/*`

The repository **does not** use `apps/api/server.js` as the canonical API. Production and Preview traffic go through **Vercel** (Git sync or CLI deploy) so `/api/*` hits `api/handler.js`. For local full-stack iteration you may use **`npx vercel dev`** or test against a **Preview URL** after push. The `apps/api/` folder is archival documentation only (see `apps/api/README.md`).

Agents should stay in their owner area unless explicitly asked to work cross-area.

## Mandatory Work Rules

1. Read target feature spec before coding.
2. Keep scope limited to one module per task unless explicitly requested.
3. Do not change unrelated files.
4. Keep changes small and reviewable.
5. Preserve backward compatibility for shared contracts when possible.
6. Add or update tests/checks for changed behavior.
7. Record unresolved assumptions in the feature spec under open questions.

## Feature Spec Execution Contract

Each feature spec in `docs/features/*.md` must contain:

- A reference to this file: `docs/agent-instructions.md`
- Completion status placeholder
- Test status placeholder

Use the following standard block in each feature file:

```md
## Agent Execution

- Instruction reference: `docs/agent-instructions.md`
- Completion status: `pending | in_progress | completed | blocked`
- Test status: `not_run | in_progress | passed | failed`
- Last updated by:
- Last updated at:
```

## Done Criteria (Per Feature Task)

A task is done only when:

1. Implementation matches the assigned feature spec.
2. Tests/checks were run and status is recorded in spec metadata.
3. Completion status is updated in spec metadata.
4. Integration impact is validated or explicitly noted.
5. Any follow-up work is documented as open items.

## Safety and Non-Goals

- Do not invent requirements outside the assigned feature spec.
- Do not silently change product logic across other feature modules.
- Do not block MVP delivery for post-MVP enhancements.
- Do not rely on restricted third-party APIs unless spec explicitly allows it.

## Escalation Rules

Raise blockers immediately when:

- Required API contract is missing or ambiguous.
- Owner-boundary work is required but not requested.
- Security/privacy requirement is unclear.
- Acceptance criteria cannot be validated with available environment (remember: validate on a **Vercel Preview/Production** URL from Git, or optionally **`npx vercel dev`** — not a bare static server plus a separate API port).

When escalating, provide:
- blocker summary
- impacted files/modules
- two options with trade-offs
- recommended path
# Agent Instructions for `01_auth` (Copy/Paste Ready)

Use these prompts to delegate `@docs/features/01_auth.md` implementation in parallel.
These instructions align with owner boundaries (`apps/web` first), keep fallback behavior explicit, and optimize for MVP demo reliability.

---

## 1) Frontend Web Agent (Primary Owner)

```text
You are the Frontend Web Agent for `01_auth`.

Context (source of truth):
- @docs/features/01_auth.md
- @docs/MVP.md

Goal:
Implement the full mobile-first `01_auth` onboarding flow in `apps/web`:
LinkedIn-first entry -> Google fallback -> manual profile fallback -> handoff to `02_details_gathering`.

Scope (strict):
- Work only in `apps/web`.
- Do not implement backend API handlers (backend is `api/handler.js`, owned separately).
- If an endpoint is missing from `api/handler.js`, add a mock-safe UI fallback and document the contract gap for the API owner.

Required behavior:
1) QR/mobile landing entry clearly presents LinkedIn as first/default auth option.
2) If LinkedIn auth is unavailable/fails, user can continue with Google.
3) If Google auth is unavailable/fails, user can continue via manual profile bootstrap.
4) Manual bootstrap must include required fields with validation:
   - name
   - company
   - role
   - email
   - phone
5) User can always proceed (no dead-end) when required fallback data is valid.
6) On successful provider or manual bootstrap, route user to `02_details_gathering`.
7) Add a visible progress indicator:
   `01_auth -> 02_details_gathering -> 03_icebreaker_questions -> done`.
8) Allow profile edits after provider sync or manual entry.

MVP constraints:
- Use LinkedIn OIDC mindset/scopes from spec (`openid profile email`) in integration points.
- Do not promise/require LinkedIn vanity username/public profile URL in MVP UX.
- Keep copy and behavior clear about fallback paths.

Deliverables:
1) Code changes in `apps/web`.
2) Route/screen flow summary.
3) Validation and failure-state summary (LinkedIn fail, Google fail, manual validation fail).
4) Manual test checklist with expected results for acceptance criteria in `01_auth.md`.
5) Any backend contract gaps discovered (concise, actionable).
```

---

## 2) Backend API Agent (Support for Auth Bootstrap)

```text
You are the Backend API Agent supporting `01_auth`.

Context (source of truth):
- @docs/features/01_auth.md
- @docs/MVP.md

Goal:
Implement or adapt minimal backend support for provider-auth bootstrap and manual profile bootstrap needed by web flow.

Scope (strict):
- Work only in `api/` (primarily `api/handler.js`) and `packages/shared` only when unavoidable for contract alignment.
- Do not implement frontend UI.

Required backend capabilities:
1) Accept provider-auth identity baseline payload (name/email/picture + provider/member identifier when present).
2) Accept manual bootstrap payload (name/company/role/email/phone) with explicit validation errors.
3) Return normalized profile bootstrap response used by web to proceed to `02_details_gathering`.
4) Ensure deterministic error shapes for:
   - provider unavailable/failure
   - invalid manual payload
   - missing required fields
5) Keep logic MVP-simple and testable.

MVP constraints:
- LinkedIn OIDC only for MVP path assumptions.
- Do not block MVP on restricted LinkedIn enrichment APIs.
- Keep contract explicit about optional vs required fields.

Deliverables:
1) `api/handler.js` routes changed or added (Vercel serverless).
2) Request/response contract summary (including validation errors).
3) Env/config requirements for Vercel.
4) How you tested (Vercel Preview URL after Git push, and/or `npx vercel dev`) and results.
5) Follow-up list for post-MVP enrichment APIs.
```

---

## 3) Integration + QA Agent (Acceptance Gate)

```text
You are the Integration and QA Agent for `01_auth`.

Context (source of truth):
- @docs/features/01_auth.md
- @docs/MVP.md

Goal:
Validate that `01_auth` meets acceptance criteria end-to-end and is demo-safe on mobile.

Scope:
- Validate integrated behavior across `apps/web` and `api/handler.js` (via **Git-built** Vercel Preview/Production, and/or `npx vercel dev`).
- Prioritize user-visible failures and dead-end risks.

Test matrix (minimum):
1) QR landing on mobile shows LinkedIn as first/default provider.
2) LinkedIn failure path correctly offers Google continuation.
3) Google failure path correctly offers manual entry continuation.
4) Manual entry enforces required fields and shows clear errors.
5) Successful provider bootstrap reaches `02_details_gathering`.
6) Successful manual bootstrap reaches `02_details_gathering`.
7) Profile edit is possible after bootstrap.
8) Progress indicator appears and reflects current step.

Deliverables:
1) Pass/fail report per acceptance criterion in `01_auth.md`.
2) Bugs grouped by severity with repro steps and expected vs actual.
3) Demo readiness verdict (go/no-go) for `01_auth`.
4) Top 3 must-fix items before merge/demo.
```

---

## 4) Tech Lead Review Agent (Merge Order + Risks)

```text
You are the Tech Lead Review Agent for `01_auth`.

Context (source of truth):
- @docs/features/01_auth.md
- @docs/MVP.md
- Outputs from Frontend, Backend, and QA agents

Goal:
Review implementation completeness, integration risk, and produce merge-ready sequencing.

Review checklist:
1) Acceptance criteria coverage from `01_auth.md` is complete.
2) No dead-end onboarding paths remain.
3) Owner boundaries were respected (web in `apps/web`, API in `api/handler.js`).
4) Contract mismatches are resolved or clearly called out.
5) MVP constraints on LinkedIn enrichment were respected.

Deliverables:
1) Final merge order (smallest safe increments).
2) Must-fix issues before merge.
3) Safe deferrals (post-MVP).
4) Final risk summary and recommendation.
```

