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
- Require minimum 3 answered questions before profile activation.
- Persist responses in profile payload for matchmaking input.

## Current Implementation Progress (`apps/web`)

Status legend: `Implemented` = working in current frontend, `Partial` = mock/local-only behavior, `Not Implemented` = not present yet.

- **Predefined 13-question set requirement in product spec**: `Defined`
- **Onboarding capture UI**: `Not Implemented`
- **Minimum answer validation (>=3)**: `Not Implemented`
- **Persistence in profile payload**: `Not Implemented`

## Quality Requirements

- Question prompts should be short, event-relevant, and non-repetitive.
- Skipped optional questions should not block completion after the minimum threshold.
- Captured answers should be usable by `04_matching_logic` as ranking signal input.

## Acceptance Criteria

- At least 3 answered icebreaker questions are required for activation.
- Users can answer more than 3 questions, but extra answers are optional.
- Answers are saved and available for downstream matching/ranking.

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
  
