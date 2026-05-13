# Database documentation (NexusLink)

Schema is defined in SQL migrations under [`supabase/migrations/`](../../supabase/migrations/) and applied to **Supabase (Postgres)**. The Vercel API continues to use in-memory and JSON-on-disk stores until each area is explicitly wired to these tables.

| Document | Scope |
|----------|--------|
| [Organizer](organizer.md) | `nl_organizers`, `nl_events`, `nl_organizer_sessions` — accounts, per-event settings, bearer sessions |
| *Attendee (TBD)* | `nl_attendee_sessions`, `nl_onboarding_drafts`, `nl_profiles`, `nl_waves`, `nl_match_actions`, `nl_meetup_preferences` |

**Related:** feature spec [`10_organizer_auth_and_event_store.md`](../features/10_organizer_auth_and_event_store.md), migration [`20260512140000_initial_app_runtime.sql`](../../supabase/migrations/20260512140000_initial_app_runtime.sql).
