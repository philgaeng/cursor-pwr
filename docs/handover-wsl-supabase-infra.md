# Handover: WSL move, Supabase setup, and infra decisions

**Date:** 2026-05-12  
**Audience:** You (or anyone) continuing this repo from **WSL** in a new Cursor window opened **from Git**.

## Why this file exists

Development hit practical limits on **Windows (PowerShell)** versus your **WSL** environment. The next step is to open a **new Cursor project from the same Git remote** under WSL and continue there. This document captures **decisions** and **in-flight Supabase wiring** so nothing lives only in chat.

---

## Repo and product context

- **Product:** NexusLink (see [`MVP.md`](./MVP.md)).
- **Runtime target:** Vercel (web + `api/handler.js`); same-origin `/api/*` as documented in `MVP.md`.
- **Database (product):** MVP still allows a demo store; [`MVP.md`](./MVP.md) open questions include *when to introduce a real database and auth provider*. Introducing Supabase is a **platform choice** ahead of or alongside that product decision.

---

## Infra and platform decisions (conversation summary)

These are **defaults for your future projects**, not all mandatory for this repo today.

| Topic | Decision / direction |
|--------|----------------------|
| **Primary proto stack** | **Vercel** for shareable deploys; **managed Postgres** instead of DB on instance disk. |
| **DB + files default** | **Supabase** as default for solo MVPs that always need **attachments** (Postgres + Storage + dashboard), to minimize vendors and AWS IAM surface. |
| **Alternative when a small team needs DB isolation per PR** | **Neon** (branching) + separate object storage (e.g. S3-compatible); use when that workflow dominates. |
| **RDS** | Not the default for low-devops MVPs; revisit with a partner or strict AWS needs. |
| **Auth** | **Keycloak** for mature, portable, OSS-friendly deployments; reuse across projects. **Supabase Auth** optional for early velocity; avoid two IdPs long-term without a migration plan. |
| **AWS** | Not required for “Vercel + Supabase only” apps; **egress** if app stays on AWS while DB is remote. Prefer non-root IAM when you touch AWS. |
| **Client production** | Deployment on **client infra** may be handled by a **third party**; ship portable artifacts (containers, env contract, migrations). |

---

## Supabase: status for *this* repository

### Done / decided

- **GitHub:** Repository linked to Supabase (per your setup).
- **Working directory (Git integration):** Use **`.`** (repo root) **after** the `supabase/` directory exists at the **root** of the default branch. That path is the directory that **contains** `supabase/`, not the `supabase` folder itself.

### Not done yet

- **`supabase/` tree:** Not present in the workspace snapshot at handover time. Run **`supabase init`** from the **repository root** so `supabase/config.toml` (and related files) are created, then **commit and push**.
- **Windows CLI:** `supabase` was **not on PATH** in PowerShell (`CommandNotFoundException` on `supabase init`). Fix by using **WSL**, or `npx supabase@latest init`, or a global install (`npm i -g supabase` / Scoop per Supabase docs).

### Recommended next steps (WSL)

1. Clone or open the **same Git remote** in WSL (path of your choice, e.g. `~/src/cursor-pwr`).
2. Install **Supabase CLI** in WSL (official method for Linux).
3. From repo root: `supabase init` → review generated files → commit.
4. In Supabase dashboard: confirm Git link **working directory** = **`.`** (if `supabase/` is at root).
5. Add **server-side** env vars to Vercel when you wire the API: `SUPABASE_URL`, service role / anon keys as appropriate—**never** expose service role to the browser.
6. Align with [`MVP.md`](./MVP.md) and feature specs before replacing the demo store.

---

## Windows vs WSL note

You may have worked in more than one folder name for the same project (e.g. `cursor-pwr` vs a Cursor-managed path). **Git remote `philgaeng/cursor-pwr`** is the source of truth; WSL should track **one** clone tied to that remote.

---

## Related docs

- [`MVP.md`](./MVP.md) — scope, deployment path, open questions.
- [`AGENTS.md`](../AGENTS.md) — ownership and integration protocol.
- Feature specs under [`docs/features/`](./features/) (e.g. organizer auth / event store) when persistence lands.

---

## Session closeout

- **Blocked on Windows:** Supabase CLI availability in PowerShell.
- **Unblocked in WSL:** Standard Linux CLI install path for Supabase; continue Git-linked project configuration there.
