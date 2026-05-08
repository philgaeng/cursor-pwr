# Phase 1 Integration and QA Report

Context references:
- `docs/feature.md`
- `docs/implementation-checklist.md`

Date: 2026-05-08

## Test Scope

- Onboarding completion path
- Tag/question/consent validation failures
- Wave retrieval
- Like/pass persistence and reveal gating
- Manual wave trigger behavior

## Findings by Severity

### Critical

- None found in the tested Phase 1 backend flow.

### High

- **Web client does not pass `userId` (or `X-User-Id`) from `/api/auth/session` into later requests.**
  - Impact: End-to-end flow against live backend can fail with `400` on onboarding/waves/actions.
  - Components: `apps/web`, `apps/api`.
  - Repro:
    1. Complete auth step in web UI.
    2. Submit profile/questions/complete onboarding.
    3. Observe backend requires identity header/body for subsequent endpoints.
  - Expected: Web persists session `userId` and includes it in all protected API calls.
  - Actual: Web fallback logic can hide missing identity integration.

### Medium

- **Wave/candidate payload remains dual-shape during transition.**
  - Impact: Integration fragility if only one contract variant is returned.
  - Components: `apps/web`, `packages/shared`, `apps/api`.
  - Repro:
    1. Return only canonical shared shape or only legacy shape.
    2. Confirm adapter behavior works now, but drift risk remains.
  - Expected: Single canonical payload shape shared by web and api.
  - Actual: Compatibility adapter currently handles mixed structures.

### Low

- **Manual wave trigger has no operator-role guard in frontend.**
  - Impact: Demo control is visible to all users in current web prototype.
  - Components: `apps/web`.
  - Repro:
    1. Open match queue screen.
    2. Trigger button is visible without role-based guard.
  - Expected: Operator-only control (or hidden admin path).
  - Actual: Public button for demo convenience.

## Executed Checks (API)

### Happy path (pass)

- `POST /api/auth/session` -> `200`
- `POST /api/onboarding/profile` with exact 3+3 tags -> `200`
- `POST /api/onboarding/questions` with 3 answers -> `200`
- `POST /api/onboarding/complete` with consent accepted -> `200`
- `GET /api/waves/current` -> `200`, 3 candidates returned
- `POST /api/matches/action` with `like` to `u2` -> `mutual=true`, `revealStatus=unlocked`

### Negative path (pass)

- `GET /api/waves/current` before onboarding -> `400`
- `POST /api/onboarding/profile` with invalid tag count -> `400`
- `POST /api/onboarding/questions` with fewer than 3 answers -> `400`
- `POST /api/matches/action` like to non-mutual candidate (`u3`) -> `mutual=false`, `revealStatus=locked`

## Phase 1 Exit Criteria Status

- New user can complete onboarding and reach candidate queue: **Pass (API), At Risk (web identity wiring)**
- Like/Pass flow works end-to-end with a mutual scenario: **Pass (API), At Risk (web identity wiring)**
- Mutual match reveals WhatsApp only after double opt-in: **Pass**
- Demo operator can trigger a wave on demand: **Pass (function), Low-risk UX guard gap**

## Recommendation

- **Go/No-Go: Conditional Go**
  - Go for backend demo script and API validation.
  - Web demo should be considered go only after persisting `userId` from auth and attaching it to subsequent API requests.
