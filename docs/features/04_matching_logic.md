# 04_matching_logic Specification

## Agent Execution

- Instruction reference: `docs/agent-instructions.md`
- Completion status: `pending`
- Test status: `not_run`
- Last updated by:
- Last updated at:

## Purpose

Surface high-intent, context-aware connections rather than simple keyword overlap.

## Scope

- Use semantic matching over structured profile + intent tags.
- Matching logic should infer related intent (example: Founder <-> Seed Investor).
- Agent sends proactive match suggestions during event runtime.
- Suggestions are grouped and released in periodic waves to reduce notification fatigue.
- User can open each wave, review profiles, and take Like/Pass action.

## Current Implementation Progress (`apps/web`)

Status legend: `Implemented` = working in current frontend, `Partial` = mock/local-only behavior, `Not Implemented` = not present yet.

- **Match wave UI and candidate rendering**: `Implemented`
- **Like/Pass actions on suggested profiles**: `Implemented`
- **Periodic wave orchestration (timed batches)**: `Not Implemented`
- **Semantic/context-aware ranking from embeddings**: `Not Implemented`
- **Proactive push notifications for new waves**: `Not Implemented`

## Wave Delivery Requirements

- Configurable wave interval (for example, every 10-20 minutes).
- Each wave contains a bounded number of suggestions (avoid overload).
- Do not resend already passed profiles unless explicitly reset by product policy.

## Quality Requirements

- Ranking emphasizes intent compatibility first, secondary profile fit second.
- Cold-start behavior uses available tags + role/company context.
- Icebreaker answers from `03_icebreaker_questions` are included in ranking input.

## Acceptance Criteria

- Users receive match suggestions in timed or manually triggered waves.
- Passed profiles are not re-sent unless policy override is active.
- Ranking quality outperforms random ordering in demo validation.

## Resolved Decisions (May 2026)

- Route definitions consumed by matching logic come from `docs/resource/icebreaker-routes.v1.json`.
- Route schema uses branch-specific dual Tier-3 questions for all route branches.
- Assignment model: each participant gets exactly 3 routes from the catalog in `03_icebreaker_questions`.
- Coverage objective accepted: stricter pairwise shared-route coverage for smaller rooms and relaxed target for larger rooms.
- Room-size threshold currently set to `100` participants for strict vs relaxed mode split.
- Route frequency should be globally balanced with large tolerance.
- Base overlap weights accepted: Tier-1 `+3`, Tier-2 `+2`, Tier-3 `+2`.
- Rarity bonus increased to `+5`.
- Free-text semantic similarity bonus increased to `+5`.
- Target suggestions per user set to `5`.
- Diversity targets accepted: at least `3` dominant routes with max `2` suggestions per dominant route.
- Explainability accepted: show route path and free-text overlap snippet when available.
- Both Tier-3 answers under the selected Tier-2 branch contribute independently to overlap scoring.
- Organizer controls accepted: backend configuration for room size, start threshold, and event-specific settings.
- MVP success threshold emphasizes coverage rate.

## Defaults Added By Spec Owner

- If repeat-policy answer is "ok" without cooldown value, default cooldown is 2 waves.
- If low-confidence handling is unspecified, default is: show fewer matches rather than force low-confidence matches.
- If low-confidence matches are shown, UI must include a low-confidence label.
- Telemetry baseline for MVP: coverage rate, route diversity score, suggestion acceptance rate, and pass-to-like ratio.

## Open Matching Questions (To Answer In-File)

Use this section as a working questionnaire. Replace `[ ]` with `[x]` and add your answer under each item.

### A) Route Assignment Constraints

- [x] Confirm assignment model: each participant gets exactly `3 routes` from the route catalog in `03_icebreaker_questions`.
  - Answer: yes
- [x] Confirm coverage objective: pairwise shared-route coverage target (for example 100% for small rooms, 90-95% for larger rooms).
  - Answer: accepted
- [x] Define room-size thresholds for strict vs relaxed coverage modes.
  - Answer: 100
- [x] Confirm if route frequency should be balanced globally across room (yes/no + tolerance).
  - Answer: yes, large tolerance

### B) Pair Scoring Formula

- [x] Confirm base score weights for route overlap (proposed): same Tier-1 `+3`, same Tier-2 `+2`, same Tier-3 `+2`.
  - Answer: accepted
- [x] Confirm rarity bonus for uncommon overlaps (proposed `+1 to +2`).
  - Answer: +5
- [x] Confirm free-text semantic similarity bonus range (proposed `0 to +3`).
  - Answer: +5
- [x] Confirm tie-break priority when scores match (for example route diversity, recency, intent-tag compatibility).
  - Answer: accepted

### C) Diversity Rules for Final Suggestions

- [x] Confirm target suggestions per user (proposed `6`).
  - Answer: 5
- [x] Confirm diversity rule: at least `3 distinct dominant routes` across the 6 suggestions.
  - Answer: 3
- [x] Confirm cap rule: maximum suggestions from same dominant route (proposed `2`).
  - Answer: 2
- [x] Confirm whether repeat suggestions across waves are allowed and under what cooldown.
  - Answer: allowed (default cooldown = 2 waves)

### D) Sparse Room and Failure Fallbacks

- [x] Define fallback when full coverage cannot be reached (proposed: bridge-route injection, then relaxed threshold).
  - Answer: accepted
- [x] Define minimum viable match score for inclusion in a wave.
  - Answer: enforce minimum quorum (~40) then set floor from score distribution to guarantee at least 2 matches per user (based on lowest second-highest score)
- [x] Define behavior when user has fewer than target suggestions (show fewer vs include lower-confidence matches).
  - Answer: show fewer by default
- [x] Confirm whether low-confidence matches must include a UI label/warning.
  - Answer: yes, required when shown
  - Note: send matching routes + profile context to AI for a 3-line personalized intro.

### E) Explainability and UX Output

- [x] Confirm user-facing explanation format (for example: "You both: Japanese -> Ramen -> Shoyu").
  - Answer: yes
- [x] Confirm if explanation should include free-text overlap snippet when available.
  - Answer: yes
- [x] Confirm whether to show one dominant shared route or top 2 routes per match card.
  - Answer: LLM can choose best presentation
- [x] Confirm if users can dismiss a route type preference to improve future diversity.
  - Answer: accepted

### F) Operational Controls

- [x] Confirm cadence controls: fixed interval vs hybrid (manual trigger + schedule).
  - Answer: accepted
- [x] Confirm if organizers can set per-event route weights.
  - Answer: yes, via backend controls (room size, threshold to start scoring, etc.)
- [x] Confirm required telemetry fields for offline evaluation (coverage rate, diversity score, acceptance rate).
  - Answer: spec-owner defaults accepted
- [x] Confirm success threshold for MVP launch vs post-MVP tuning.
  - Answer: coverage rate
