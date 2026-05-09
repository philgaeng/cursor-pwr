# 05_match_actions_and_reveal Specification

## Agent Execution

- Instruction reference: `docs/agent-instructions.md`
- Completion status: `pending`
- Test status: `not_run`
- Last updated by:
- Last updated at:

## Purpose

Convert matchmaking quality into meaningful introductions and real follow-up.

## Scope

- Present candidates in either:
  - Swipe-style queue, or
  - Curated ranked list
- Support quick actions: Like, Pass, View Profile, Reveal (when eligible).
- On mutual Like, generate 3 AI icebreakers based on shared interests/context.
- Reveal control shows contact channel(s) only after match is mutual.

## Current Implementation Progress (`apps/web`)

Status legend: `Implemented` = working in current frontend, `Partial` = mock/local-only behavior, `Not Implemented` = not present yet.

- **Queue/list style review of match candidates**: `Implemented`
- **Immediate feedback on Like/Pass actions**: `Implemented`
- **Mutual match state in near real-time**: `Not Implemented`
- **AI-generated icebreakers on mutual like**: `Not Implemented`
- **Secure digital business card reveal flow**: `Partial` (mock contact reveal only)

## Interaction Requirements

- Feedback should be immediate for user actions.
- Mutual match state must update in near real-time.
- Icebreakers should avoid generic templates and reference overlap when possible.

## Reveal Rules

- Double opt-in is mandatory: no contact reveal unless both users Like each other.
- Reveal channels are policy-controlled; current MVP primary channel is WhatsApp.

## Acceptance Criteria

- User can perform Like/Pass on each candidate without page break.
- Mutual Like unlocks reveal and icebreaker generation.
- Contact details remain hidden until mutual state is confirmed.
