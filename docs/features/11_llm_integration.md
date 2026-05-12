# Spec 11 — Organizer LLM integration (route generation)

## Goal

Use the organizer’s chosen LLM provider and stored API credentials to generate **icebreaker route catalog JSON** (`POST /api/organizer/routes/generate`), instead of relying only on server env (`OPENAI_API_KEY`) or the deterministic fallback.

Related: [09_route_generator.md](./09_route_generator.md), [10_organizer_auth_and_event_store.md](./10_organizer_auth_and_event_store.md).

## Settings contract (already in UI / JSON)

`organizer.llm`:

| Field | Type | Notes |
|-------|------|--------|
| `provider` | `"none"` \| `"openai"` \| `"anthropic"` \| `"gemini"` \| `"deepseek"` | `none` = do not use organizer keys; keep current server default / fallback behavior. |
| `apiKeys.openai` | string | e.g. `sk-…` |
| `apiKeys.anthropic` | string | e.g. `sk-ant-…` |
| `apiKeys.gemini` | string | Google AI Studio / Gemini API key |
| `apiKeys.deepseek` | string | DeepSeek API key |

Crowd context continues to come from `questionRoutes.crowdCues`, `questionRoutes.generationStyleNotes`, and `eventInfo.description` (already sent on generate).

## Implementation checklist (backend)

1. **Resolve key for a request**  
   If `organizer.llm.provider !== "none"`, read the matching entry from `organizer.llm.apiKeys.*`.  
   If missing or empty, fall back to existing env-based behavior (e.g. `OPENAI_API_KEY`) then deterministic catalog.

2. **Provider adapters** (minimal viable surface):  
   - **OpenAI**: reuse or generalize current HTTP call; model configurable later.  
   - **Anthropic (Claude)**: Messages API, JSON response mode or strict “return JSON only” instruction.  
   - **Gemini**: Google Generative Language API with JSON output constraints.  
   - **DeepSeek**: OpenAI-compatible chat completions if applicable; confirm base URL and auth header.

3. **Prompt assembly**  
   Single internal builder: inputs = selected topics, crowd cues, style notes, event description, **catalog JSON schema summary** (or a short schema excerpt).  
   Document the prompt template in this file when implemented.

4. **Response parsing**  
   - Parse JSON from model output (strip markdown fences if present).  
   - Run existing `validateIcebreakerRoutesCatalog`; on failure set `icebreakerRoutesDraft.validationWarning` and optionally keep raw text for debugging (avoid logging secrets).

5. **Security / ops**  
   - API keys in event JSON are **sensitive**; avoid logging bodies that contain keys.  
   - Long term: encrypt at rest, or store provider + reference to a secret manager instead of raw keys.  
   - Rate limits and timeouts per provider.

## Implementation checklist (frontend)

Done before spec 11: organizer **LLM provider** select, per-provider **credential** fields, and **Generate routes** CTA. No change required here unless the generate API gains new fields.

## Acceptance (spec 11 done when)

- With `provider: openai` and a valid key in settings, generate returns `source` indicating organizer LLM (not only `deterministic_fallback`).  
- Same for at least one non-OpenAI provider on the list.  
- Invalid key / provider error returns a clear **4xx** message without leaking the key.  
- `provider: none` preserves today’s behavior (env + deterministic).
