# cursor-pwr

MVP project setup for the `cursor-pwr` group repository.

## Team

- William
- Philippe
- Rojel

## MVP Goal

Build and ship a thin end-to-end MVP quickly: a usable vertical slice with clear ownership, working local setup, and documented decisions.

Product direction is now defined as **NexusLink**: high-value, intent-based networking at live events through AI matchmaking and privacy-safe introductions.

## Initial Folder Structure

```text
cursor-pwr/
├── AGENTS.md
├── README.md
├── apps/
│   ├── api/
│   └── web/
├── docs/
│   ├── MVP.md
│   └── decisions/
├── packages/
│   └── shared/
├── scripts/
└── tests/
```

## Work Split (MVP)

- **William (Frontend Lead)**: Owns `apps/web`, UI flows, client-side validation, and UI polish for MVP-critical screens.
- **Philippe (Backend Lead)**: Owns `apps/api`, data model contracts, endpoints, auth/session basics, and API reliability.
- **Rojel (Integration + Delivery Lead)**: Owns shared contracts in `packages/shared`, local dev workflow, CI scaffolding, integration testing, release readiness, and final QA pass.

## Current Implementation Snapshot

- `docs/MVP.md` now contains NexusLink scope, features, and acceptance criteria.
- `packages/shared/contracts.ts` defines shared product contracts for onboarding, match waves, and privacy states.
- `apps/web/` contains William's frontend starter slice (no-build prototype for onboarding, match actions, and privacy vault states).

## Run William's Web Starter

From `apps/web`, serve the files with any static server. Example:

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173`.

## Collaboration Rules

- Keep PRs small and reviewable.
- Align on API contracts before implementation drifts.
- Use `AGENTS.md` as the source of truth for agent behavior and coding workflow.
- Record important decisions in `docs/decisions/`.

## Recommended Next Steps

1. Choose and scaffold final app stack for `apps/web` and `apps/api`.
2. Implement backend endpoints against `packages/shared/contracts.ts`.
3. Replace web mock data with real API integration.

