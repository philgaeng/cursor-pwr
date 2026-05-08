# apps/api

Minimal Node.js HTTP API for NexusLink Phase 1 demo flow.

## Run

```bash
node apps/api/server.js
```

Optional environment variables:

- `API_HOST` (default: `127.0.0.1`)
- `API_PORT` (default: `8787`)
- `DEMO_MODE_ENABLED` (default: `true`)

## Phase 1 Routes

- `POST /api/auth/session`
  - MVP session path (Google by default, LinkedIn only when `demoMode=true`).
- `POST /api/auth/demo-login`
  - Mock/demo login path behind `DEMO_MODE_ENABLED`.
- `GET /api/tags/catalog`
  - Fixed global tag catalog.
- `POST /api/onboarding/profile`
  - Saves profile draft; validates exact `offers[3]` and `seeks[3]`.
- `POST /api/onboarding/questions`
  - Saves icebreaker responses; validates minimum 3 answers.
- `POST /api/onboarding/complete`
  - Enforces full onboarding constraints:
    - exactly 3 offers
    - exactly 3 seeks
    - consent accepted
    - at least 3 icebreaker responses
    - deletion preference persisted (defaults to true)
- `GET /api/waves/current`
  - Fetches current wave for onboarded user.
- `POST /api/waves/trigger`
  - Manual wave trigger for demo operators.
- `POST /api/matches/action`
  - Records like/pass and returns mutual match + WhatsApp reveal gating result.
- `GET /api/health`
  - Simple health check.

## Notes

- Data store is in-memory for demo reliability.
- Payload shapes follow canonical contracts in `packages/shared/contracts.ts`.
