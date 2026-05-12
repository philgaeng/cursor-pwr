# 08_observer Specification

## Agent Execution

- Instruction reference: `docs/agent-instructions.md`
- Completion status: `in_progress`
- Test status: `not_run`
- Last updated by:
- Last updated at:

## Purpose

Define the organizer-facing operating flow for configuring, monitoring, and steering the event experience.

## Scope

- Organizer portal information architecture and navigation behavior.
- Organizer authentication entry (login page) before organizer settings access.
- Multi-event management for one organizer account.
- Organizer settings lifecycle: load, edit by forms, edit by raw JSON, validate, save.
- Runtime observer actions (waves, meetup logistics visibility, QA checkpoints).
- Documentation source for organizer-specific behavior across specs `03`, `04`, `05`, and `07`.

## Current Organizer Flow (Implemented)

- Organizer opens `organizer.html` and loads settings from `/api/organizer/settings`.
- Navigation:
  - Desktop uses tab shortcuts for each major section.
  - Mobile uses a hamburger menu shortcut list.
- Editing modes:
  - Form mode (section by section).
  - Raw JSON mode (power-user edit + apply back to form).
- Save action persists payload to `/api/organizer/settings` with API-side validation.

## Section Map (Organizer Portal)

- Organizer login and organizer home/event switcher.
- Organizer credentials and social links.
- Event details.
- Freebies.
- Attendance.
- Question routes and crowd cues.
- Physical meetup routing/signs/wearable fallback.
- Onboarding thresholds.
- Matching controls and scoring.
- Privacy defaults.
- Raw settings JSON editor.

## JSON Editing Contract

- JSON editor mirrors the same settings shape as the form.
- "Refresh JSON from form" serializes current form state.
- "Apply JSON to form" parses JSON and rehydrates fields.
- Final persisted payload is still validated on save by backend.

## Organizer Data Container (Proposed)

Organizer data should become organizer-centric with event-scoped settings and routes:

```json
{
  "organizer": {
    "key": "org_xxxx",
    "details": {
      "email": "owner@example.com",
      "linkedin": "https://linkedin.com/in/owner",
      "privateKey": "..."
    },
    "events": [
      {
        "event_key": "xx1",
        "details": {},
        "settings": {},
        "icebreaker_routes": {}
      },
      {
        "event_key": "xx2",
        "details": {},
        "settings": {},
        "icebreaker_routes": {}
      }
    ]
  }
}
```

This structure is a proposal for pre-implementation alignment and should be finalized in `10_organizer_auth_and_event_store`.

## Observer Responsibilities

- Confirm section defaults before event opens.
- Validate route suggestions and matching thresholds.
- Confirm physical meetup spaces/sign availability before wave release.
- Monitor user feedback and adjust settings between waves when needed.

## Acceptance Criteria

- Organizer can reach all configuration sections via desktop tabs.
- Organizer can reach all configuration sections via mobile hamburger shortcuts.
- Organizer can edit settings via JSON and apply those values to form fields.
- Invalid JSON is blocked client-side with clear error feedback.
- Saved settings remain compatible with existing API validation.

## Open Product Questions (Organizer/Observer)

Use this section as a working questionnaire. Replace `[ ]` with `[x]` and add your answer under each item.

### A) Navigation and Access

- [ ] Should some organizer sections be role-restricted (for example, only owner can edit privacy/scoring)?
  - Answer:
- [x] Should desktop tabs support deep-link URLs (for example `?section=matching`)?
  - Answer: yes
- [ ] Should organizer always hit login page first before opening organizer settings?
  - Answer:
- [ ] Should organizer support passwordless magic-link, password login, or both for MVP?
  - Answer:
- [ ] Should mobile menu stay open after selection, or auto-close (currently auto-close)?
  - Answer:

### B) JSON Editing Safety

- [ ] Should we add "diff preview" before applying JSON to form?
  - Answer:
- [ ] Should we support importing/exporting JSON files in MVP?
  - Answer:
- [ ] Should routes-only quick JSON editor be separated from full settings JSON?
  - Answer:

### C) Runtime Observer Controls

- [ ] Which live actions should observer have during event runtime (trigger wave, pause wave, lock settings)?
  - Answer:
- [ ] Should changes apply immediately or only at next wave boundary?
  - Answer:
- [ ] Do we need audit logs for setting changes (who changed what, when)?
  - Answer:

### D) Cross-Spec Ownership

- [ ] Confirm which spec is source of truth for organizer defaults (this file vs each feature spec).
  - Answer:
- [ ] Confirm mandatory pre-event checklist for organizer before attendees onboard.
  - Answer:

### E) Organizer Event Storage

- [ ] Confirm `organizer.key` format and generation strategy.
  - Answer:
- [ ] Confirm if `organizer.details.privateKey` is required in DB/config, or should be stored separately in secret manager only.
  - Answer:
- [ ] Confirm max number of events per organizer in MVP and whether event archiving is required.
  - Answer:
