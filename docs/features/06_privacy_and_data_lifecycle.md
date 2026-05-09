# 06_privacy_and_data_lifecycle Specification

## Agent Execution

- Instruction reference: `docs/agent-instructions.md`
- Completion status: `pending`
- Test status: `not_run`
- Last updated by:
- Last updated at:

## Purpose

Protect attendee trust and enforce consent-first networking.

## Scope

- Double opt-in is mandatory before contact reveal.
- Contact fields (email, phone, LinkedIn, WhatsApp) remain hidden before mutual Like.
- Mandatory click-through agreement for privacy policy + attendee conduct.
- Optional user toggle: auto-delete account data 24 hours after event end.

## Current Implementation Progress (`apps/web`)

Status legend: `Implemented` = working in current frontend, `Partial` = mock/local-only behavior, `Not Implemented` = not present yet.

- **Double opt-in concept for reveal**: `Partial` (mocked locally in frontend state)
- **Contact hidden before mutual match**: `Partial` (UI behavior, not backend-enforced)
- **24-hour auto-delete toggle capture**: `Partial` (UI flag only, no deletion workflow)
- **Consent/audit trail persistence**: `Not Implemented`
- **GDPR/CCPA lifecycle handling**: `Not Implemented`

## Compliance and Data Handling Requirements

- Data storage must align with GDPR/CCPA principles.
- Event-scoped data lifecycle controls required (active, archived, deleted).
- Auditability for consent actions (agreement accepted timestamp, deletion preference).
- Deletion preference must map to enforceable retention jobs post-event.

## Acceptance Criteria

- Contact fields are not revealed prior to mutual opt-in.
- Consent acceptance and deletion preference are persisted with timestamps.
- 24-hour deletion policy is enforceable for opted-in users.
