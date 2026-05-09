# Icebreaker Route Catalog

This folder is the source of truth for route definitions used by:

- `docs/features/03_icebreaker_questions.md`
- `docs/features/04_matching_logic.md`

## Canonical File

- `icebreaker-routes.v1.json`

## Why JSON First

- Three-tier route structures are easier to validate and consume from code.
- Organizers can edit route content without touching matching logic text.
- Versioned JSON supports safe iteration (`v1`, `v2`, ...).

## Editing Rules

- Keep `routeId` stable once used in production data.
- Keep each route with:
  - `tier1Prompt`
  - 4+ `tier1Options`
  - `tier2Prompt` + 2 options
  - either:
    - `tier3Prompt` + 2 options (simple mode), or
    - `tier3Mode: "branch_specific_dual"` + `tier3ByTier2` with 2 tier-3 questions per tier-2 branch
- Keep `freeTextPrompt` optional but enabled by default for richer matching.
- Use `freeTextPromptOverride` at tier1 option level when a branch-specific prompt is needed (example: Italian dessert).
- Use lowercase snake_case for option codes.
- Keep wording English-first with optional Taglish-flavored labels where natural for PH audience.
- Prefer durable categories with optional current examples (avoid overfitting to short-lived memes).

## Scoring Intent (For Matching)

- Tier-1 overlap = broad common ground.
- Tier-2 overlap = stronger route affinity.
- Branch-specific dual Tier-3 answers = high-confidence specificity.
- Both Tier-3 answers under the selected Tier-2 branch should contribute independently to match scoring.
- Free text adds optional semantic signal, not a hard requirement.

## Safety Boundaries

- Keep prompts low-stakes and conversation-friendly.
- Off-limits themes in route prompts:
  - hate or protected-class attacks
  - explicit sexual content
  - self-harm encouragement
  - doxxing, exact private addresses, or sensitive personal identifiers
  - illegal activity planning
- Avoid prompts that directly ask for political persuasion targeting.
- Religion can appear only as optional personal context in a respectful tone (no antagonistic framing).
- Apply profanity filtering to free-text answers before storage/display.

## Next Updates

- Add PH-localized variants if needed (`icebreaker-routes.ph.v1.json`).
