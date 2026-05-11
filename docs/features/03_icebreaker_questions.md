# 03_icebreaker_questions Specification

## Agent Execution

- Instruction reference: `docs/agent-instructions.md`
- Completion status: `pending`
- Test status: `not_run`
- Last updated by:
- Last updated at:

## Purpose

Collect concise conversation signals that improve match quality and post-match engagement.

## Scope

- Present the predefined icebreaker set during onboarding completion.
- **Mobile-first, playful UX**: each choice is a full-screen step—**step 1 shows four large picture tiles** (tier1 pick); **steps 2–4 show two tiles each** (one selection per step). No long forms or dropdowns.
- Require **all 3 assigned routes** to be completed before profile activation (each route = five steps as in **Mobile route flow**).
- Persist responses in profile payload for matchmaking input.

## Current Implementation Progress (`apps/web`)

Status legend: `Implemented` = working in current frontend, `Partial` = mock/local-only behavior, `Not Implemented` = not present yet.

- **Route-based icebreaker catalog** (`docs/resource/icebreaker-routes.v1.json`): `Defined`
- **Onboarding capture UI**: `Not Implemented`
- **Minimum completion validation (3 assigned routes)**: `Not Implemented`
- **Persistence in profile payload**: `Not Implemented`

## Quality Requirements

- Question prompts should be short, event-relevant, and non-repetitive.
- Skipped optional questions should not block completion after the minimum threshold.
- Captured answers should be usable by `04_matching_logic` as ranking signal input.
- **Per assigned route**, the ideal flow is **five screens**: **four** choice steps plus **one** screen for **optional free text**. **Step 1** uses **four** tappable image tiles (one tier1 selection). **Steps 2–4** use **two** tiles each. Tiles should be legible on small viewports (large tap targets, high contrast labels, meaningful imagery).
- Desktop may reuse the same step-by-step flow or provide an equivalent accessible layout; **mobile is the primary design target**.

## Mobile route flow (per assigned route)

For each route the participant completes:

| Step | Content |
|------|--------|
| 1 | Tier1 / first structured choice (**four** tiles + imagery) |
| 2 | Second structured choice (two tiles) |
| 3 | Third structured choice (two tiles) |
| 4 | Fourth structured choice (two tiles) |
| 5 | Free text (dedicated screen; optional per route catalog) |

This maps to the canonical answer shape (`tier1` → `tier2` → both tier3 binaries under `tier3Mode: branch_specific_dual`, then `freeText`). **Catalog alignment:** the mobile **first screen always shows exactly four** tier1 tiles. Routes in `icebreaker-routes.v1.json` should carry **four** `tier1Options` per route for MVP, or the client must define overflow (e.g., **pick 4 shown** from a larger set via rotation, event config, or “show more”) without breaking the four-tile layout. Steps 2–4 remain **binary** (two tiles) and match the JSON as today.

Progress within a route (step 1–5), across the **three assigned routes**, and any optional extra routes should be **resumable** per existing checkpoint rules.

## Acceptance Criteria

- **All 3 assigned icebreaker routes** must be completed for activation (one **four-tile** screen + three **two-tile** screens + free text per route, unless a route disables free text in catalog).
- Users may complete **additional optional routes** beyond the three assigned; those extra completions are optional.
- Answers are saved and available for downstream matching/ranking.
- **Assigned routes** use the **five-step** pattern above on primary mobile breakpoints: **step 1 = four tiles**, **steps 2–4 = two tiles each**, **step 5 = free text**.
- **Step 1** exposes **four** options as large visual tiles; **steps 2–4** expose **two**. Selection advances with clear back/restart affordances as needed.

## Resolved Decisions (May 2026)

- Route catalog source of truth is externalized to `docs/resource/icebreaker-routes.v1.json`.
- Participants are assigned 3 routes and must answer all 3 assigned routes to complete this step.
- Users may answer extra optional routes beyond the 3 assigned routes.
- Canonical answer schema uses: `routeId`, `tier1`, `tier2`, `tier3` (with branch-specific dual answers), `freeText`, `answeredAt`.
- Free text is English-only in MVP and stored as raw text.
- Profanity filtering is required for free-text answers.
- Organizer-defined route sets are allowed through backend configuration.
- If a user skips a route, the system auto-reassigns another route.
- If onboarding stalls for around 3 minutes, partial answers are retained and the user resumes from last progress.
- Manual review/edit after initial submission is not required in MVP.
- Safety boundaries and off-limits themes are defined in `docs/resource/icebreaker-routes.md`.
- **Mobile icebreaker UX** is **step-based and fun**: full-screen prompts, **four picture tiles on the first question** and **two tiles on questions 2–4**, then a dedicated free-text screen per route (see **Mobile route flow**).

## Defaults Added By Spec Owner

- Normalized labels are required for analytics (`tier1Code` + `tier1Label`, same for tier2/tier3).
- Suggested target time budget for this step: 60-90 seconds.

## Open Product Questions (To Answer In-File)

Use this section as a working questionnaire. Replace `[ ]` with `[x]` and add your answer under each item.

### A) Route Catalog Design

- [x] Confirm the 8 base routes (proposed: `food`, `sweets`, `family_life`, `travel`, `entertainment`, `work_style`, `hobbies`, `hot_takes`).
  - Answer: defined in `docs/resource/icebreaker-routes.v1.json`
- [x] For each route, define Tier-1 choices (4-8 options each).
  - Answer: defined in `docs/resource/icebreaker-routes.v1.json`
- [x] For each Tier-1 choice, define Tier-2 binary choice (A/B).
  - Answer: defined in `docs/resource/icebreaker-routes.v1.json`
- [x] For each Tier-1 choice, define Tier-3 binary choice (A/B).
  - Answer: defined in `docs/resource/icebreaker-routes.v1.json`
- [x] Confirm if Tier-4 free text is optional for all routes.
  - Answer: yes, enabled by default in `docs/resource/icebreaker-routes.v1.json`

### B) User Load and Onboarding UX

- [x] Confirm `3 routes per participant` (fixed) or make configurable.
  - Answer: fixed at 3 in MVP
- [x] Confirm minimum completion rule: all 3 assigned routes must be answered.
  - Answer: yes
- [x] Confirm whether users can answer extra optional routes beyond the 3 assigned.
  - Answer: yes
- [x] Confirm time budget target for this step (for example, 60-90 seconds).
  - Answer: yes (target 60-90 seconds)
- [x] Confirm mobile presentation: one full-screen choice at a time, **four image tiles on step 1** and **two tiles on steps 2–4**, **five screens per route** (four choices + free text).
  - Answer: yes (see **Mobile route flow**; tier1 catalog should expose four options per route for MVP or define overflow—see alignment note in that section)

### C) Data Schema and Storage

- [x] Confirm canonical answer schema fields (proposed): `routeId`, `tier1`, `tier2`, `tier3`, `freeText`, `answeredAt`.
  - Answer: yes (`tier3` stores two branch-specific answers)
- [x] Confirm if normalized labels are required for analytics (for example `tier1Code` + `tier1Label`).
  - Answer: yes (recommended default accepted)
- [x] Confirm language handling for free text (single language vs multilingual).
  - Answer: English
- [x] Confirm whether raw free text should be stored, redacted, or both.
  - Answer: stored (with profanity filtering)

### D) Content Quality and Safety

- [x] Define banned/off-limits prompt themes for event safety.
  - Answer: defined in `docs/resource/icebreaker-routes.md`
- [x] Confirm if profanity filtering is required on free-text answers.
  - Answer: yes
- [x] Confirm if political/religious prompts are allowed, optional, or blocked by default.
  - Answer: religion allowed in PH setting
- [x] Confirm if organizers can customize route sets per event (MVP vs post-MVP).
  - Answer: yes, in backend

### E) Completion and Fallback Behavior

- [x] Define behavior when user skips a route (block, remind, or auto-reassign route).
  - Answer: auto-reassign
- [x] Define behavior when user abandons onboarding mid-route.
  - Answer: retain partial data after ~3 minutes stalled; allow resume from checkpoint
- [x] Confirm if manual review/edit is allowed after initial submission.
  - Answer: not needed for MVP
  
