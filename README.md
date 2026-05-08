# cursor-pwr

MVP project setup for the `cursor-pwr` group repository.

## Team

- William
- Philippe
- Rojel

## MVP Goal

Build and ship a thin end-to-end MVP quickly: a usable vertical slice with clear ownership, working local setup, and documented decisions.

> Note: This repository was initialized before full product details were finalized. Update `docs/MVP.md` with the final MVP scope and acceptance criteria as the team confirms them.

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

## Collaboration Rules

- Keep PRs small and reviewable.
- Align on API contracts before implementation drifts.
- Use `AGENTS.md` as the source of truth for agent behavior and coding workflow.
- Record important decisions in `docs/decisions/`.

## Recommended Next Steps

1. Finalize `docs/MVP.md` scope and acceptance criteria.
2. Choose stack details for `apps/web` and `apps/api`.
3. Create first implementation PRs by owner area.

