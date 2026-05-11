# 07_physical_meetup Specification

## Agent Execution

- Instruction reference: `docs/agent-instructions.md`
- Completion status: `pending`
- Test status: `not_run`
- Last updated by:
- Last updated at:

## Purpose

Turn a mutual match into a real-world meetup with clear instructions that reduce confusion inside the venue.

## Scope

- After mutual Like, attendees receive a "how to meet" plan.
- Organizer configures meetup logistics in Event Settings:
  - Spaces (named physical spots inside the venue).
  - Signs (optional visual markers, such as flag colors).
- If signs are enabled, both attendees are instructed to look for the assigned sign in the assigned space.
- If signs are disabled, each attendee must provide a wearable marker (for example: "blue blazer", "red cap") so their match can spot them.

## Current Implementation Progress (`apps/web` + `api`)

Status legend: `Implemented` = working in current app, `Partial` = mock/local-only behavior, `Not Implemented` = not present yet.

- **Organizer-configured meetup spaces**: `Implemented`
- **Organizer-configured optional signs/flags**: `Implemented`
- **Mutual-match meetup plan generation**: `Implemented`
- **Wearable marker fallback when signs are disabled**: `Implemented`
- **Advanced crowd balancing / dynamic routing**: `Not Implemented`

## Flow

1. Organizer opens Event Settings and defines:
   - `physicalMeetup.spaces`: at least 1 named space.
   - `physicalMeetup.signs.enabled`: toggle.
   - `physicalMeetup.signs.options`: one or more sign labels when enabled.
2. Attendee gets a mutual Like in Vault.
3. App requests meetup instructions for the pair.
4. Backend returns:
   - Assigned meetup space.
   - Assigned sign (if enabled).
   - Whether wearable marker is required.
5. If wearable marker is required, attendee submits what they are wearing.
6. Vault displays meetup instructions and confirms what to look for.

## Data Model

- Organizer settings include:
  - `physicalMeetup.enabled: boolean`
  - `physicalMeetup.spaces: string[]`
  - `physicalMeetup.signs.enabled: boolean`
  - `physicalMeetup.signs.options: string[]`
  - `physicalMeetup.wearablePrompt: string`
- Pair meetup plan includes:
  - `space`
  - `sign` (nullable)
  - `requiresWearableMarker`
  - `instructionsForUser`
- Attendee meetup preference includes:
  - `wearableMarker` (required only when signs are disabled)

## Quality Requirements

- Instructions must be simple and immediately actionable.
- Organizer defaults should work out of the box (no empty unusable setup).
- Wearable fallback should avoid blocking users unnecessarily when signs are enabled.
- Inputs should be validated and trimmed to prevent blank markers/spaces/signs.

## Acceptance Criteria

- Organizer can configure one or more meetup spaces in Settings.
- Organizer can optionally enable signs and provide sign labels (for example color flags).
- On mutual Like, attendees see where to go and how to identify each other.
- If signs are disabled, attendees are prompted to provide a wearable marker before meetup instructions are complete.
- API and web behavior remain backward-compatible for existing onboarding and matching flow.

## Resolved Decisions (May 2026)

- Space assignment for MVP is deterministic per matched pair.
- Sign assignment is optional and deterministic per matched pair when enabled.
- Wearable marker fallback is only mandatory when signs are disabled.
- Default sign labels are simple color flags.

## Open Product Questions (To Answer In-File)

Use this section as a working questionnaire. Replace `[ ]` with `[x]` and add your answer under each item.

### A) Organizer Setup

- [x] Can organizer define multiple meetup spaces?
  - Answer: yes, one or more spaces.
- [x] Are signs optional?
  - Answer: yes.
- [x] Should signs be free text or fixed catalog?
  - Answer: free text list in MVP (with sensible defaults).

### B) User Experience

- [x] When do users see meetup instructions?
  - Answer: after mutual Like in Vault.
- [x] What happens when signs are disabled?
  - Answer: attendee is asked for a wearable marker.

### C) Operations

- [x] Do we require fairness optimization in assigning spaces/signs in MVP?
  - Answer: no, deterministic assignment is sufficient for MVP.
