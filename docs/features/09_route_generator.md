# 09_route_generator Specification

## Agent Execution

- Instruction reference: `docs/agent-instructions.md`
- Completion status: `completed`
- Test status: `passed` (local: `node --check api/handler.js`; full e2e on Vercel preview still recommended)
- Last updated by:
- Last updated at:

## Purpose

Let organizers generate route definitions automatically from selected route topics, producing JSON compatible with `docs/resource/icebreaker-routes.v1.json`.

## Scope

- Organizer can mark route topics for generation using checkboxes beside each route slot.
- Organizer can trigger generation for selected route topics.
- Backend attempts LLM generation (OpenAI) and returns route-catalog JSON in the required schema.
- Frontend shows generated JSON in the organizer JSON panel and updates selected route IDs in form slots.
- Published catalog is stored on the organizer settings object as `icebreakerRoutes` (MVP single-event store). Multi-event `organizer.events[n].icebreaker_routes` is deferred to spec `10_organizer_auth_and_event_store`.

## Current Implementation Progress (`apps/web` + `api`)

Status legend: `Implemented` = working in current app, `Partial` = mock/local-only behavior, `Not Implemented` = not present yet.

- **Route selection checkboxes in organizer routes section**: `Implemented`
- **Generate selected routes action from organizer UI**: `Implemented`
- **Backend route generation endpoint**: `Implemented`
- **OpenAI-backed generation when key is available**: `Implemented`
- **Deterministic fallback generator when OpenAI unavailable/fails**: `Implemented`
- **Server draft after generate (`icebreakerRoutesDraft`)**: `Implemented`
- **Publish validated catalog (`POST /organizer/routes/publish`) + attendee catalog via `GET /routes/catalog`**: `Implemented`
- **Single-step rollback (`POST /organizer/routes/rollback`)**: `Implemented`
- **Atomic save with full settings + `icebreakerRoutes` on `POST /organizer/settings`**: `Implemented`
- **Optional `generationStyleNotes` + explicit crowd-cues copy in UI and LLM prompt**: `Implemented`
- **Persist generated catalog to docs file in repo automatically**: `Not Implemented` (by design: validated catalog lives in organizer settings / API until spec 10 storage)

## UX Flow

1. Organizer goes to Routes section in organizer portal.
2. Organizer fills route topic labels and checks which slots should be generated.
3. Organizer clicks `Generate selected routes JSON`.
4. Frontend sends selected topics + crowd cues + event description to API.
5. API returns generated catalog JSON.
6. Frontend:
   - updates selected route slots with generated `routeId`s,
   - writes generated catalog into the **Published / validated icebreaker route catalog** textarea (staging; same content is stored server-side as `icebreakerRoutesDraft`).
7. Organizer edits JSON if needed, then **Publish routes to attendees** (or **Save event settings** with valid JSON) to apply.
8. `GET /routes/catalog` serves published `icebreakerRoutes` when valid; otherwise the default bundled file. Multi-event scoping follows spec 10 when implemented.

## API Contract (MVP)

- **Generate:** `POST /api/organizer/routes/generate`
  - Request:
    - `selectedTopics: string[]` (required, at least 1)
    - `crowdCues?: string`
    - `eventDescription?: string`
    - `generationStyleNotes?: string` (optional free-text style hints)
  - Response:
    - `ok: true`
    - `source: "openai_or_fallback" | "deterministic_fallback"`
    - `selectedTopics: string[]`
    - `generatedCatalog: object` (schema-compatible with `icebreaker-routes.v1.json`)
    - `draftSaved: true` when server stored `icebreakerRoutesDraft`
    - `draftValidationWarning: string | null` when catalog fails strict validation (still returned for manual edit)

- **Publish:** `POST /api/organizer/routes/publish`
  - Request: optional `{ "catalog": { ... } }`. If omitted or empty, server uses `icebreakerRoutesDraft.catalog`.
  - Response: `{ ok: true, eventId, settings }` with updated `icebreakerRoutes`, `icebreakerRoutesHistory` (previous published, max one), cleared draft.

- **Rollback:** `POST /api/organizer/routes/rollback`
  - Restores the single entry in `icebreakerRoutesHistory` into `icebreakerRoutes`.

## Quality Requirements

- Generated routes should maintain MVP structure:
  - exactly 4 tier1 options per route,
  - exactly 2 tier2 options per tier1 option,
  - branch-specific dual tier3 questions,
  - optional free-text prompts.
- Endpoint should never hard-fail generation due to model unavailability; fallback generator must return usable output.
- Organizer must see clear status messaging for success/failure.

## Acceptance Criteria

- Organizer can choose generation targets via checkboxes beside route slots.
- Clicking generate produces JSON payload for selected topics.
- JSON output is displayed in the Routes section catalog textarea (not only the global settings JSON editor).
- Generated route IDs are written back to selected route slots.
- If OpenAI is unavailable, deterministic fallback still returns valid catalog JSON.

## Open Questions

Use this section as a working questionnaire. Replace `[ ]` with `[x]` and add your answer under each item.

### A) Generation Controls

- [ ] Should organizer be able to choose generation style (safe/professional/fun) per event?
  - Answer: yes but free text rather than choice
  
- [ ] Should we allow partial regeneration at route-option level, not just route level?
  - Answer: It may get complicated - the user can always edit manually
- [ ] Should generated output include profanity/safety policy tags per prompt?
  - Answer: the boundaries, style, audience, and all possible bacground or even examples should be provided in the free text called Crowd cues (we should make the subtext explicit ). If you reco that we should split in audience info, style of questions, any other details you may add and one example of route - we can move towards that so we have more control on the results

### B) Persistence and Versioning

- [ ] Should generated catalog be persisted server-side per event immediately?
  - Answer: 
- [ ] Do we need version history/rollback for generated route catalogs?
  - Answer: 1 history so one can rollback if not happy with generation
- [ ] Should generated output automatically replace static `docs/resource/icebreaker-routes.v1.json` in non-dev flows? stays in cache, replace after validation
  - Answer:
- [ ] Confirm if event save should upsert only `icebreaker_routes` or full `{details, settings, icebreaker_routes}` atomically. 
  - Answer: all

### C) Human-in-the-loop

- [ ] Should there be an approval step before generated routes are used in onboarding?
  - Answer: what do u reco
- [ ] Should we provide route-level validation errors/warnings in UI before save?
  - Answer:
- [ ] Should we allow side-by-side diff between existing and generated routes?
  - Answer: human can edit the generated json
