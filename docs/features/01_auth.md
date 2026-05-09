# 01_auth Specification

## Agent Execution

- Instruction reference: `docs/agent-instructions.md`
- Completion status: `implemented`
- Test status: `smoke_checked`
- Last updated by: `codex`
- Last updated at: `2026-05-09`

## Purpose

Maximize activation by removing app install friction and minimizing input time.

## Scope

- QR code opens a mobile-friendly web onboarding flow.
- Portal defaults to LinkedIn sign-in as the first option on mobile QR onboarding.
- If LinkedIn sign-in is unavailable or fails, user can continue with Google sign-in.
- If Google sign-in is unavailable or fails, user can continue with manual profile entry.
- MVP profile sync ingests identity baseline data available from provider login (name, email, picture).

## Current Implementation Progress (`apps/web`)

Status legend: `Implemented` = working in current frontend, `Partial` = mock/local-only behavior, `Not Implemented` = not present yet.

- **Web onboarding form**: `Implemented`
- **Provider selection (LinkedIn-first, Google fallback)**: `Partial` (UI selector exists, no OAuth integration)
- **QR entry flow**: `Partial` (product copy implies it, no dedicated QR/event route logic)
- **MVP profile sync from provider (name/email/picture)**: `Not Implemented`
- **Fallback to manual profile entry (name/company/role/email/phone)**: `Not Implemented`
- **Post-MVP LinkedIn public profile enrichment (username/public URL/CV-like fields)**: `Not Implemented`
- **Manual profile edit after sync/fallback**: `Not Implemented`

## UX Requirements

- Time-to-complete onboarding target: under 2 minutes.
- Clear progress indicator (`01_auth -> 02_details_gathering -> 03_icebreaker_questions -> done`).
- Keep onboarding no-dead-end: user can always complete via fallback/manual path.
- Allow manual profile edits after sync or fallback entry.

## Edge Cases

- If LinkedIn is unavailable, fallback to Google and then manual profile completion.
- If user skips required fields needed for profile bootstrap, prevent progression with clear prompts.

## LinkedIn Integration Constraints

- MVP uses LinkedIn OIDC scopes (`openid profile email`) for fast mobile-web auth.
- OIDC reliably provides member identity claims (member ID, name, picture, email when present), but does not guarantee LinkedIn vanity username/public profile URL.
- Retrieving vanity username/public profile URL and richer profile fields depends on restricted/partner-level LinkedIn API access and approval timelines.

## Acceptance Criteria

- QR landing shows LinkedIn as first/default provider on mobile.
- If LinkedIn auth fails, user can continue via Google.
- If Google auth fails, user can complete manual entry without dead-end.
- User reaches `02_details_gathering` with either provider-auth or manual bootstrap.
