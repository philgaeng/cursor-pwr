# 02_details_gathering Specification

## Agent Execution

- Instruction reference: `docs/agent-instructions.md`
- Completion status: `pending`
- Test status: `not_run`
- Last updated by:
- Last updated at:

## Purpose

Capture high-signal attendee details quickly while keeping onboarding completion high.

## Scope

- User completes networking profile fields (company, role, phone) if provider data is incomplete.
- User selects exactly 3 tags for:
  - What I Offer
  - What I am Looking For
- User must accept a privacy and conduct agreement before profile is active.
- User can edit synced/manual profile fields before entering the matching queue.

## Current Implementation Progress (`apps/web`)

Status legend: `Implemented` = working in current frontend, `Partial` = mock/local-only behavior, `Not Implemented` = not present yet.

- **3 tags for Offer + 3 tags for Looking For validation**: `Implemented`
- **Privacy agreement required before completion**: `Implemented`
- **Provider-synced + manual field merge flow**: `Not Implemented`
- **Manual profile edit after sync/fallback**: `Not Implemented`

## Validation Requirements

- Required fields block progression with specific inline guidance.
- Tag count must be exactly 3 per category before completion.
- Consent agreement must be accepted before profile activation.

## Data Requirements

- MVP synced fields: name, email, picture.
- Required manual completion fields: company, role, phone.
- Persist tags and consent timestamp as profile-completion artifacts.

## Acceptance Criteria

- User cannot proceed without exact tag counts (3 + 3).
- User cannot activate profile without accepting privacy/conduct agreement.
- User can finish profile completion even when provider data is partial.
