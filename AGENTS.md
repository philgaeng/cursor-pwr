# AGENTS.md

Global guidance for all human contributors and AI agents working in `cursor-pwr`.

## 1) Mission

Deliver an MVP fast with quality, clear ownership, and low rework. Optimize for a working end-to-end slice over broad but incomplete features.

## 2) Source of Truth

- MVP scope and acceptance criteria: `docs/MVP.md`
- Architectural and product decisions: `docs/decisions/`
- Shared contracts and types: `packages/shared/`

If requirements conflict, update `docs/MVP.md` first, then implement.

## 3) Team Ownership

- **William**: `apps/web/` (frontend implementation)
- **Philippe**: `apps/api/` (backend implementation)
- **Rojel**: cross-cutting integration, shared contracts, QA, and delivery flow

Agents should prefer tasks within owner boundaries unless explicitly asked to assist across boundaries.

## 4) Branch + PR Strategy

- Branch naming:
  - `feat/web-<short-topic>`
  - `feat/api-<short-topic>`
  - `feat/integration-<short-topic>`
  - `fix/<short-topic>`
- Keep PRs focused and small.
- Every PR should include:
  - what changed
  - why it changed
  - how to test

## 5) Implementation Standards

- Start with shared contracts when frontend/backend interfaces are involved.
- Avoid hidden assumptions; encode constraints in code and docs.
- Prefer explicit errors and predictable behavior.
- Do not introduce breaking contract changes without coordinated updates.

## 6) Definition of Done (MVP tasks)

A task is done only when:

1. Code is implemented in the owner area.
2. Minimal tests or verifiable checks are included.
3. Docs are updated (`README.md`, `docs/MVP.md`, or decision log if needed).
4. Integration impact is validated (frontend + backend contract compatibility).

## 7) Agent Workflow

When any agent picks up work:

1. Read `README.md`, `docs/MVP.md`, and this file.
2. Confirm task scope and owner area.
3. Implement smallest shippable slice.
4. Run relevant checks/tests.
5. Update docs if behavior or scope changes.

## 8) Communication Protocol

- Raise blockers early (missing requirements, contract ambiguity, env issues).
- If unsure, propose two options with trade-offs and a recommendation.
- Keep handoffs concise and actionable.

## 9) Priority Order

1. End-to-end MVP functionality
2. Reliability and correctness
3. Developer ergonomics
4. Nice-to-have polish

## 10) Anti-Patterns to Avoid

- Building large features without agreed acceptance criteria.
- Diverging frontend/backend contracts.
- Mixing unrelated changes in one PR.
- Skipping docs for behavior changes.

