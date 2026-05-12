# 10_organizer_auth_and_event_store Specification

## Agent Execution

- Instruction reference: `docs/agent-instructions.md`
- Completion status: `in_progress`
- Test status: `not_run`
- Last updated by: product (spec 10 answers captured in-repo)
- Last updated at: 2026-05-11

## Purpose

Define organizer login and event-scoped storage so one organizer account can manage multiple events with separate settings and route catalogs.

## Scope

- Organizer login page and organizer session model.
- Organizer profile container with stable organizer key.
- Event-scoped storage model for details, settings, and icebreaker routes.
- Event selection/switching behavior in organizer portal.
- API contract changes required before implementation.

## Proposed Data Model

```json
{
  "organizer": {
    "key": "org_xxxx",
    "details": {
      "name": "Organizer display name",
      "email": "owner@example.com",
      "linkedin": "https://linkedin.com/in/owner"
    },
    "events": [
      {
        "event_key": "uuid-or-slug",
        "details": {},
        "settings": {},
        "icebreaker_routes": {},
        "route_catalog_history": []
      }
    ]
  }
}
```

- **Organizer-level** fields (one degree “above” event): stable `key`, `details`, and any future cross-event defaults (for example export credentials when added).
- **Event-level** fields: `details`, `settings` (today’s flat organizer settings shape moves here per event), `icebreaker_routes` (published catalog), and **one** prior snapshot for rollback (align with spec 09 single history).

## Organizer Flow (Target)

1. Organizer lands on login page.
2. Organizer authenticates and receives organizer session.
3. Organizer sees list of events (or creates first event).
4. Organizer selects event.
5. Organizer portal loads event-specific:
   - `details`
   - `settings`
   - `icebreaker_routes`
6. Save applies only to active `event_key`.

## API Surface (Pre-Implementation)

- `POST /api/organizer/login`
- `GET /api/organizer/me`
- `GET /api/organizer/events`
- `POST /api/organizer/events` (create event)
- `GET /api/organizer/events/:event_key`
- `PUT /api/organizer/events/:event_key` (update details/settings)
- `PUT /api/organizer/events/:event_key/routes` (update icebreaker_routes)

Final endpoint naming can change, but behavior and event scoping must stay explicit.

## Security and Privacy Constraints

- Organizer secrets should not be returned in plaintext after initial set, unless explicitly required.
- **MVP recommendation:** do **not** collect Google `privateKey` (or similar) in organizer signup UI; configure service credentials via environment / secret manager when that integration ships.
- Access control must ensure organizer only reads/writes their own events.

## Acceptance Criteria (Spec Gate Before Coding)

- Login requirements and auth mechanism are finalized. **Done (see Resolved).**
- Organizer-event data model is finalized and approved. **Done (see Resolved).**
- Event scoping rules are explicit for all save/update actions. **Done (see Resolved).**
- Route generator persistence behavior is aligned with event scoping. **Done (store catalogs per event; single rollback snapshot per event).**
- Migration path from current single-settings object is defined. **Done (lift current object into first default event + organizer shell).**

## Resolved decisions (from product answers + defaults)

| Topic | Decision |
|-------|-----------|
| Auth (MVP) | Email + password |
| MFA (MVP) | Not required |
| Session transport | **Recommendation:** `Authorization: Bearer <opaque_session_id>` plus client storage (`sessionStorage`), issued by `POST /organizer/login`, validated on each organizer API. Fits serverless handlers and matches existing header-based patterns. **Alternative** (later): HttpOnly cookie + CSRF token if we need cookie-only policy. |
| `organizer.key` | System-generated (UUID) |
| Signup required fields | `name`, `email` |
| Google private key in UI | **Recommendation:** not in MVP signup/settings UI; env/secret manager only when Sheets export is implemented. |
| `event_key` uniqueness | Unique **per organizer**; value can be UUID |
| Archive/delete events (MVP) | No |
| Clone event (MVP) | Yes (duplicate `settings` + `icebreaker_routes` + `details` into new `event_key`) |
| Persistence (MVP) | JSON file on disk (implementation: single-writer path, e.g. repo `data/` gitignored — **note:** Vercel serverless has no durable local disk across invocations; treat “JSON file” as **local/dev** or move to Vercel Blob / KV / DB for Preview/Production in a follow-up). |
| Migration from `__organizerSettings` | Keep organizer-level shell; move today’s flat settings payload into **first default event**’s `settings` / routes fields. |
| Route catalog history | **One** prior version per event for restore (same spirit as spec 09). |
| After login | Auto-open **last active** `event_key` (persist client-side + optionally server-side on organizer record). |
| Event switcher | **Recommendation:** yes — compact control in organizer header (all sections), same pattern as tabs (always visible on desktop; on mobile, show current event + link to switcher). |
| Unauthorized `organizer.html` | Redirect to organizer login |

## Open Questions (Must Answer Before Implementation)

### A) Authentication

- [x] Which auth method do we use for organizer MVP: email+password, magic link, Google, or hybrid?
  - Answer: email + password
- [x] Do we require MFA for organizer accounts in MVP?
  - Answer: no
- [x] Session strategy: cookie session vs bearer token?
  - Answer: use **Bearer opaque session id** (see Resolved decisions). Cookie session remains an acceptable later swap if security review prefers it.

### B) Organizer Profile

- [x] Is `organizer.key` system-generated UUID/slug, or user-provided key?
  - Answer: system-generated
- [x] Which `organizer.details` fields are mandatory at signup?
  - Answer: name, email
- [x] Should `privateKey` be accepted in app UI at all, or only configured via environment/secret manager?
  - Answer: **Recommendation recorded** — not in MVP UI; env/secret manager when needed.

### C) Event Model

- [x] Is `event_key` globally unique or unique only under an organizer?
  - Answer: unique per organizer (UUID acceptable)
- [x] Can organizer archive/delete events in MVP?
  - Answer: no
- [x] Do we need event cloning (duplicate config/routes) in MVP?
  - Answer: yes

### D) Storage and Migration

- [x] Where is organizer/event data persisted for MVP (in-memory, file, DB)?
  - Answer: JSON file (see Resolved decisions for production caveat)
- [x] How do we migrate existing `globalThis.__organizerSettings` into event-scoped records?
  - Answer: organizer remains one level up; current flat settings become the first event’s payload
- [x] Should each event keep route generation history/versioning?
  - Answer: only one history step for restore

### E) UX

- [x] Should organizer auto-open last active event after login?
  - Answer: yes
- [x] Do we need an event switcher visible in all organizer sections?
  - Answer: **Recommendation recorded** — yes, header switcher
- [x] Should unauthorized access redirect to organizer login from `organizer.html` automatically?
  - Answer: yes

## Implementation notes (non-normative)

- **Password storage:** hash with a slow KDF (for example Argon2id or bcrypt) before writing to the JSON store; never store plaintext passwords.
- **Session store:** in-memory map keyed by session id is OK for `vercel dev`; for production with multiple instances, persist sessions in the same store as organizer data or use a managed session store.
- **Clone event:** new `event_key`, deep copy `details`, `settings`, `icebreaker_routes`, reset event-level history for the new copy unless product wants to copy history too (default: empty history on clone).
- **Route LLM settings:** Event `settings.organizer.llm` stores `provider` (`none` \| `openai` \| `anthropic` \| `gemini` \| `deepseek`) and per-provider `apiKeys`. The organizer UI collects these; `POST /api/organizer/routes/generate` still uses server env / deterministic fallback until [11_llm_integration.md](./11_llm_integration.md). The old Google Sheets PEM block was removed from the organizer form in favor of this section (Sheets export, if needed later, should follow the “no private key in UI” recommendation above).
