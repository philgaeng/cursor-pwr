# apps/api (archived)

This directory is **not** the runtime API for NexusLink.

## Canonical API

- **Implementation:** `api/handler.js` (root of the repo)
- **How to exercise the API:** open a **Vercel Preview or Production** URL after Git push, or optionally run `npx vercel dev` from the repo root for same-origin `/api/*` + static files
- **Spec:** `docs/MVP.md`, `docs/agent-instructions.md`

The previous `server.js` HTTP process on port 8787 was removed to avoid two competing backends. JSON under `data/` and `settings/` was only used by that demo server and is no longer referenced by the Vercel handler (which uses in-memory state).
