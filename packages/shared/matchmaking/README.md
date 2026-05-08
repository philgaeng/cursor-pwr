# Matchmaking Assets

Versioned JSON and prompt assets for deterministic, demo-safe matchmaking.

## Versioning Convention

- Seed data files: `<asset-name>.v<major>.json`
- Prompt templates: `<prompt-name>.v<major>.txt`
- Integration examples: `<example-name>.v<major>.json`
- Runtime payload fields must include:
  - `scoringPromptVersion`
  - `rationalePromptVersion`
  - `summaryPromptVersion`
  - `scoringRubricVersion`
  - `questionSetVersion`

Current baseline:

- `v1`: Phase 1 deterministic demo behavior.
- `v2` (planned): Phase 2 scheduled-wave and quality improvements.

## Scoring Rubric (v1)

Weighted score in range `[0, 1]`:

- `offersSeeksAlignment`: 0.55
- `roleCompanyContext`: 0.25
- `icebreakerAffinity`: 0.20

Determinism guidance:

- Keep temperature at 0.0.
- Require strict JSON output.
- Clamp score to `[0, 1]`.
- Always return exactly 3 concise rationale bullets.

## Risks and Guardrails

- Risk: generic match reasons reduce trust.
  - Guardrail: require reasons to cite concrete overlap (tags, role context, or answers).
- Risk: over-confident scores from weak data.
  - Guardrail: include confidence and low-confidence fallback messaging.
- Risk: repeated candidate quality drift.
  - Guardrail: include candidate dedup keys in wave output and cap per-wave size.
- Risk: unsafe or speculative profile claims.
  - Guardrail: enforce "no fabricated facts" in rationale and summary prompts.
