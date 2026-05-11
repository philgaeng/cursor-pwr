# NexusLink Implementation Checklist

Execution checklist for turning `docs/feature.md` into a demo-ready MVP and production-hardening path.

## Working Rules

- Keep PRs small and scoped by area (`shared`, `api`, `web`, `integration`).
- Implement contracts first, then backend/frontend in parallel.
- Demo reliability beats breadth: preserve a controlled mock path.

## Phase 1 - Demo-Ready Core

### Shared Contracts (`packages/shared/`)

- [ ] Define `UserProfile` type with:
  - core fields (`id`, `name`, `role`, `company`)
  - intent tags (`offers[3]`, `seeks[3]`)
  - consent/deletion (`consentAccepted`, `deleteAfter24h`)
  - icebreaker responses (minimum 3 required)
- [ ] Define `MatchCandidate` type with:
  - identity summary
  - compatibility score + reasons
  - reveal status (`locked`/`unlocked`)
- [ ] Define `Wave` type with:
  - `waveId`, `eventId`, `createdAt`, `candidates[]`
- [ ] Define `LikeAction` type (`like`/`pass`) and `MutualMatch` result payload.
- [ ] Add runtime schema validation for all inbound/outbound API payloads.

### Backend/API (`api/handler.js` on Vercel)

- [ ] Add onboarding endpoint:
  - validates minimum offer/seek tags per organizer settings (default: at least 1 each; aligns with web)
  - validates consent accepted
  - validates at least 3 answered icebreaker questions
- [ ] Add Google OAuth session path (MVP default auth path).
- [ ] Add demo-mode mock login/profile seed path behind env flag.
- [ ] Add endpoint to fetch current match wave for user.
- [ ] Add endpoint for Like/Pass action recording.
- [ ] Add mutual match computation + WhatsApp reveal gating.
- [ ] Add manual wave trigger endpoint for operators.
- [ ] Add fixed global tag catalog endpoint (no organizer customization in MVP).
- [ ] Add privacy toggle persistence (`deleteAfter24h=true` by default).

### Frontend/Web (`apps/web/`)

- [ ] Build onboarding flow screens:
  - auth entry
  - tag selection
  - icebreaker questionnaire (13 questions, min 3 required)
  - privacy/consent confirmation
- [ ] Integrate Google OAuth entry UX and session handling.
- [ ] Add demo-mode fallback login toggle (non-production).
- [ ] Build match queue/list screen connected to wave endpoint.
- [ ] Wire Like/Pass buttons to API actions.
- [ ] Show mutual match state and unlock WhatsApp reveal only when allowed.
- [ ] Add operator control UI (or hidden admin action) to manually trigger waves for demos.
- [ ] Add user-facing validation/error states for every required field/path.

### Data and Prompt Assets

- [ ] Create JSON seed templates:
  - sample attendee profiles
  - sample event configuration
  - sample wave outputs
- [ ] Create versioned prompt file(s) for matchmaking scoring/reason generation.
- [ ] Create versioned prompt file(s) for candidate summary phrasing.
- [ ] Store prompt version in wave payload for traceability.

### QA and Demo Readiness

- [ ] Happy-path test: onboarding -> wave -> like/pass -> mutual unlock.
- [ ] Negative test: contact reveal blocked when not mutual.
- [ ] Validation test: fail when user answers <3 icebreaker questions.
- [ ] Validation test: fail when tags are not exactly 3+3.
- [ ] Privacy test: deletion toggle persists in profile.
- [ ] Prepare demo script with known test accounts and expected outcomes.

## Phase 2 - Smarter Matching + Automation

### Backend/API

- [ ] Add 15-minute scheduled wave job.
- [ ] Keep manual trigger as admin override.
- [ ] Add dedup logic to reduce repeated candidate delivery.
- [ ] Add prompt-driven scoring pipeline using:
  - role/company context
  - offer/seek tags
  - icebreaker responses
- [ ] Add configurable wave size + interval per event config.

### Frontend/Web

- [ ] Show next scheduled wave time.
- [ ] Add "new wave available" state and refresh action.
- [ ] Improve candidate cards with match rationale text.

### Quality

- [ ] Compare prompt-ranked suggestions vs baseline rules for match quality.
- [ ] Track mutual-like rate by wave ID.
- [ ] Add guardrails for low-confidence match output.

## Phase 3 - Production Hardening

### Security and Privacy

- [ ] Add consent audit log with timestamps and event context.
- [ ] Implement enforceable 24-hour deletion worker/job.
- [ ] Add protected secrets management for OpenAI and auth credentials.
- [ ] Add rate limits and abuse controls for interaction endpoints.

### Reliability and Operations

- [ ] Add retry/fallback behavior for AI provider failures.
- [ ] Add structured logging for onboarding, wave delivery, and match actions.
- [ ] Add basic metrics dashboard:
  - activation rate
  - mutual-like rate
  - reveal rate
- [ ] Add incident fallback mode (serve cached/mock wave if engine unavailable).

## Suggested Ticket Breakdown

### Wave 1 (can start immediately)

- [ ] `shared`: profile + wave + like contracts
- [ ] `api`: onboarding validation + mock path + like/pass endpoints
- [ ] `web`: onboarding + icebreaker flow + API wiring

### Wave 2

- [ ] `api`: mutual match + WhatsApp reveal + manual wave trigger
- [ ] `web`: mutual UI + reveal states + operator controls
- [ ] `integration`: end-to-end happy path and negative tests

### Wave 3

- [ ] `api`: scheduler + ranking improvements + observability basics
- [ ] `web`: scheduled wave UX polish + rationale display
- [ ] `ops`: deletion enforcement + fallback behavior

## MVP Definition of Done (Execution)

- [ ] Google auth path works end-to-end (with optional demo mock mode).
- [ ] User completes onboarding with all required constraints.
- [ ] User receives at least one match wave.
- [ ] Like/Pass actions persist and affect reveal eligibility.
- [ ] Mutual Like unlocks WhatsApp only for both users.
- [ ] 24-hour deletion preference is recorded and enforceable path is in place.
- [ ] Demo script runs without manual code changes.
