# MVP Scope

This file is the live source of truth for MVP scope.

## Problem Statement

Event attendees struggle to find high-intent connections quickly. Existing networking is noisy, random, and often fails to produce valuable follow-up conversations. NexusLink solves this by using AI-assisted matchmaking and privacy-safe introductions during live events.

## Target Users

- Event attendees (founders, investors, operators, developers) at conferences, demo days, and curated networking sessions.
- Event organizers who want to improve participant outcomes and increase event value.

## MVP Features (Must Have)

- **Seamless onboarding from entry QR**
  - User scans QR and opens a web portal (no app install).
  - User signs in with LinkedIn or Google.
  - User selects 3 tags for "What I Offer" and 3 tags for "What I'm Looking For".
- **AI matchmaking waves**
  - Semantic matching pairs users by intent (not exact keyword only).
  - Match suggestions are sent in periodic waves to avoid notification fatigue.
  - User can review suggested matches and like/pass each profile.
- **Privacy vault and double opt-in**
  - Contact details are hidden until both users like each other.
  - Mandatory privacy agreement before onboarding is completed.
  - Optional "delete my data 24h after event" toggle.

## Non-Goals (Out of Scope)

- Native iOS/Android app.
- Advanced analytics dashboard for organizers.
- Multi-event profile history and long-term CRM features.

## Acceptance Criteria

- [ ] User can complete onboarding via web QR flow and select offer/seek tags.
- [ ] User receives at least one AI match wave and can like/pass profiles.
- [ ] Mutual like unlocks contact reveal; non-mutual likes keep contacts private.
- [ ] User can opt into automatic data deletion after 24 hours.
- [ ] Frontend and backend contracts are aligned.
- [ ] Critical path errors are handled with clear messaging.
- [ ] MVP is demo-ready for the team.

## Milestones and Ownership

- **William (Frontend Lead)**
  - Build web onboarding flow (QR landing, auth entry, intent tag capture, privacy agreement).
  - Build match wave inbox and like/pass interaction screens.
  - Build privacy vault UI states (double opt-in pending/unlocked contacts, deletion toggle).
- **Philippe (Backend Lead)**
  - Implement auth/session and profile ingestion endpoints.
  - Implement matchmaking orchestration and wave delivery endpoints.
  - Implement mutual-like gating and contact reveal logic.
- **Rojel (Integration + Delivery Lead)**
  - Define shared contracts for profiles, matches, likes, and privacy settings.
  - Validate contract compatibility with frontend/backend integration tests.
  - Own release checks and demo readiness.

## Open Questions

- Should matchmaking waves be every fixed interval (for example, 15 minutes) or adaptive to user activity?
- Should organizers moderate allowed intent tags per event?
- What fallback is needed if LinkedIn auth is unavailable at runtime?

