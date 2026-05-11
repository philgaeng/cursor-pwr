# Organizer Event Settings

This folder is a **reference copy** of organizer settings shape. The live MVP API is **`api/handler.js`** on Vercel (in-memory defaults + `POST /api/organizer/settings`); there is no separate long-lived server reading this file.

- Reference file: `apps/api/settings/event-settings.json`
- Read API: `GET /api/organizer/settings`
- Update API: `POST /api/organizer/settings`

## How to edit

1. Prefer `POST /api/organizer/settings` (e.g. from the organizer page on your **Vercel Preview or Production** URL, or optionally while running `npx vercel dev`).
2. Keep required fields valid:
   - `organizer.creds.email` must be a valid email.
   - `questionRoutes.suggestions` must have exactly 8 non-empty strings.
   - `attendance.expectedSize`, `parameters.matching.waveIntervalMinutes`, and `parameters.matching.waveSizeLimit` must be positive integers.

## Structure summary

- `organizer`
  - `creds.email`: organizer email for attendance export notifications.
  - `creds.google`: Google integration settings for optional Sheets export (`clientEmail`, `privateKey`, `spreadsheetId`, `folderPath`).
  - `socialMedia`: organizer links/channels (`instagram`, `whatsapp`, `linkedin`).
- `eventInfo`
  - `name`, `description`, `outroMessage`.
- `freebies`
  - Optional links shown after intake completion.
- `attendance`
  - Expected room size and organizer notes about crowd profile.
- `questionRoutes`
  - `suggestions`: 8 organizer text route suggestions.
  - `crowdCues`: prompt-like cues for assisted route generation.
- `parameters`
  - `onboarding`: required tags/answers/routes and resume timeout.
  - `matching`: thresholds and scoring controls from `docs/features/04_matching_logic.md`.
  - `privacy`: double opt-in and retention defaults from `docs/features/06_privacy_and_data_lifecycle.md`.

## Suggested additional tunables

These are not yet enforced by runtime logic, but should be considered next:

- `matching.lowConfidenceRevealEnabled`: allow/disallow low-confidence cards.
- `matching.maxPassesBeforeRefresh`: cap for stale suggestion loops.
- `operations.manualWaveTriggerEnabled`: allow organizer-only manual triggers.
- `safety.profanityFilterLevel`: strictness for free-text answers.
