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
- [ ] Should desktop tabs support deep-link URLs (for example `?section=matching`)?
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
