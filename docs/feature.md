# NexusLink Feature Specifications

This document expands the MVP into feature-level specifications for implementation and product validation.

## Product Objective

Enable high-value, intent-based networking at live events through AI-powered matchmaking, privacy-safe introductions, and low-friction onboarding.

## Core User Flow

1. Attendee scans event QR and enters the web portal.
2. Attendee signs in and completes profile + intent tags.
3. Matchmaking engine computes semantic fit and sends suggestions in waves.
4. Attendee reviews suggestions and likes/passes.
5. Mutual likes unlock private contact reveal and AI icebreakers.

## Feature Modules

- `01_auth`: identity provider sign-in and session bootstrap from QR entry.
- `02_details_gathering`: attendee profile enrichment, tags, and consent capture.
- `03_icebreaker_questions`: pre-match question set capture and quality signals.
- `04_matching_logic`: ranking, wave generation, and suggestion delivery cadence.
- `05_match_actions_and_reveal`: like/pass flow, mutual match handling, and contact unlock.
- `06_privacy_and_data_lifecycle`: consent auditability, retention policy, and deletion workflows.

## Module Spec Files

- [01_auth](./features/01_auth.md)
- [02_details_gathering](./features/02_details_gathering.md)
- [03_icebreaker_questions](./features/03_icebreaker_questions.md)
- [04_matching_logic](./features/04_matching_logic.md)
- [05_match_actions_and_reveal](./features/05_match_actions_and_reveal.md)
- [06_privacy_and_data_lifecycle](./features/06_privacy_and_data_lifecycle.md)

## Current Implementation Progress (`apps/web`)

Status legend: `Implemented` = working in current frontend, `Partial` = mock/local-only behavior, `Not Implemented` = not present yet.

### 01_auth (QR Entry + Provider Login)

- **Web onboarding form**: `Implemented`
- **3 tags for Offer + 3 tags for Looking For validation**: `Implemented`
- **Privacy agreement required before completion**: `Implemented`
- **Provider selection (LinkedIn-first, Google fallback)**: `Partial` (UI selector exists, no OAuth integration)
- **QR entry flow**: `Partial` (product copy implies it, no dedicated QR/event route logic)
- **MVP profile sync from provider (name/email/picture)**: `Not Implemented`
- **Fallback to manual profile entry (name/company/role/email/phone)**: `Not Implemented`
- **Post-MVP LinkedIn public profile enrichment (username/public URL/CV-like fields)**: `Not Implemented`
- **Manual profile edit after sync/fallback**: `Not Implemented`

### 04_matching_logic (AI Matchmaking Agent)

- **Match wave UI and candidate rendering**: `Implemented`
- **Like/Pass actions on suggested profiles**: `Implemented`
- **Periodic wave orchestration (timed batches)**: `Not Implemented`
- **Semantic/context-aware ranking from embeddings**: `Not Implemented`
- **Proactive push notifications for new waves**: `Not Implemented`

### 06_privacy_and_data_lifecycle (The Vault)

- **Double opt-in concept for reveal**: `Partial` (mocked locally in frontend state)
- **Contact hidden before mutual match**: `Partial` (UI behavior, not backend-enforced)
- **24-hour auto-delete toggle capture**: `Partial` (UI flag only, no deletion workflow)
- **Consent/audit trail persistence**: `Not Implemented`
- **GDPR/CCPA lifecycle handling**: `Not Implemented`

### 05_match_actions_and_reveal (Like Mechanic)

- **Queue/list style review of match candidates**: `Implemented`
- **Immediate feedback on Like/Pass actions**: `Implemented`
- **Mutual match state in near real-time**: `Not Implemented`
- **AI-generated icebreakers on mutual like**: `Not Implemented`
- **Secure digital business card reveal flow**: `Partial` (mock contact reveal only)

### Platform and Technical Readiness

- **PWA support (manifest/service worker/installability)**: `Not Implemented`
- **Realtime backend integration for match updates**: `Not Implemented`
- **Secure auth/session token handling**: `Not Implemented`
- **Backend-driven privacy and reveal rules**: `Not Implemented`

## Feature Specifications

### 01_auth (QR Entry + Provider Login)

**Purpose**
- Maximize activation by removing app install friction and minimizing input time.

**Functional Requirements**
- QR code opens a mobile-friendly web onboarding flow.
- Portal defaults to LinkedIn sign-in as the first option on mobile QR onboarding.
- If LinkedIn sign-in is unavailable or fails, user can continue with Google sign-in.
- If Google sign-in is unavailable or fails, user can continue with manual profile entry.
- MVP profile sync ingests identity baseline data available from provider login (name, email, picture) and allows manual completion for networking fields (company, role, phone, tags).
- Post-MVP profile enrichment may ingest LinkedIn public profile URL and richer professional fields only if restricted/partner API access is approved.
**UX Requirements**
- Time-to-complete onboarding target: under 2 minutes.
- Clear progress indicator (01_auth -> 02_details_gathering -> 03_icebreaker_questions -> done).
- Keep onboarding no-dead-end: user can always complete via fallback/manual path.
- Allow manual profile edits after sync or fallback entry.

**Edge Cases**
- If LinkedIn is unavailable, fallback to Google and then manual profile completion.
- If user skips required fields/tags, prevent completion with clear prompts.

**LinkedIn Integration Constraints**
- MVP uses LinkedIn OIDC scopes (`openid profile email`) for fast mobile-web auth.
- OIDC reliably provides member identity claims (member ID, name, picture, email when present), but does not guarantee LinkedIn vanity username/public profile URL.
- Retrieving vanity username/public profile URL and richer profile fields depends on restricted/partner-level LinkedIn API access and approval timelines.

### 02_details_gathering (Profile, Tags, and Consent)

**Purpose**
- Capture high-signal attendee details quickly while keeping onboarding completion high.

**Functional Requirements**
- User completes networking profile fields (company, role, phone) if provider data is incomplete.
- User selects exactly 3 tags for:
  - What I Offer
  - What I am Looking For
- User must accept a privacy and conduct agreement before profile is active.
- User can edit synced/manual profile fields before entering the matching queue.

**Validation Requirements**
- Required fields block progression with specific inline guidance.
- Tag count must be exactly 3 per category before completion.

### 03_icebreaker_questions (Pre-Match Signal Capture)

**Purpose**
- Collect concise conversation signals that improve match quality and post-match engagement.

**Functional Requirements**
- Present the predefined icebreaker set during onboarding completion.
- Require minimum 3 answered questions before profile activation.
- Persist responses in profile payload for matchmaking input.

**Quality Requirements**
- Question prompts should be short, event-relevant, and non-repetitive.
- Skipped optional questions should not block completion after the minimum threshold.

### 04_matching_logic (AI Matchmaking Agent)

**Purpose**
- Surface high-intent, context-aware connections rather than simple keyword overlap.

**Functional Requirements**
- Use semantic matching over structured profile + intent tags.
- Matching logic should infer related intent (example: Founder <-> Seed Investor).
- Agent sends proactive match suggestions during event runtime.
- Suggestions are grouped and released in periodic waves to reduce notification fatigue.
- User can open each wave, review profiles, and take Like/Pass action.

**Wave Delivery Requirements**
- Configurable wave interval (for example, every 10-20 minutes).
- Each wave contains a bounded number of suggestions (avoid overload).
- Do not resend already passed profiles unless explicitly reset by product policy.

**Quality Requirements**
- Ranking emphasizes intent compatibility first, secondary profile fit second.
- Cold-start behavior uses available tags + role/company context.

### 06_privacy_and_data_lifecycle (Privacy and Safety / The Vault)

**Purpose**
- Protect attendee trust and enforce consent-first networking.

**Functional Requirements**
- Double opt-in is mandatory: no contact reveal unless both users Like each other.
- Contact fields (email, phone, LinkedIn, WhatsApp) remain hidden before mutual Like.
- Mandatory click-through agreement for privacy policy + attendee conduct.
- Optional user toggle: auto-delete account data 24 hours after event end.

**Compliance and Data Handling**
- Data storage must align with GDPR/CCPA principles.
- Event-scoped data lifecycle controls required (active, archived, deleted).
- Auditability for consent actions (agreement accepted timestamp, deletion preference).

### 05_match_actions_and_reveal (High-Stakes Interaction / Like Mechanic)

**Purpose**
- Convert matchmaking quality into meaningful introductions and real follow-up.

**Functional Requirements**
- Present candidates in either:
  - Swipe-style queue, or
  - Curated ranked list
- On mutual Like, generate 3 AI icebreakers based on shared interests/context.
- Reveal control shows contact channel(s) only after match is mutual.
- Support quick actions: Like, Pass, View Profile, Reveal (when eligible).

**Interaction Requirements**
- Feedback should be immediate for user actions.
- Mutual match state must update in near real-time.
- Icebreakers should avoid generic templates and reference overlap when possible.

## Technical Requirements

### Frontend
- Progressive Web App (PWA) for cross-platform event usage.
- Mobile-first onboarding and match review experience.
- Real-time UI updates for incoming waves and mutual matches.

### Logic Layer
- AI matchmaking engine using embeddings/similarity scoring.
- Wave orchestration service for periodic suggestion batches.
- Like/Pass + mutual unlock rules in a deterministic workflow.

### Database and Realtime Infrastructure
- Realtime-capable backend/data store (example: Firebase stack).
- Low-latency notification and state synchronization for match updates.
- Event-scoped data partitioning recommended.

### Security and Privacy
- End-to-end encryption for private chat/messages (if chat is enabled in MVP+).
- Secure token/session handling for identity providers.
- GDPR/CCPA-compliant retention and deletion operations.

## Success Metrics

- **Activation Rate**: percentage of attendees who scan QR and complete onboarding.
- **Match Quality**: percentage of mutual Likes over total profile views.
- **Connection Rate**: number of contact reveals/business-card exchanges per user.

## Locked MVP Decisions (May 2026)

- **Auth mode**: LinkedIn-first OAuth (OIDC) with Google fallback and manual-entry backup.
- **Demo data strategy**: mock profile/match data is allowed for demo reliability.
- **Wave cadence**: hybrid model (manual trigger + fixed 15-minute schedule).
- **Primary reveal channel**: WhatsApp.
- **Backend preference**: Node.js services, deployable on Vercel.
- **Matchmaking approach**: JSON-based profile signals + prompt-driven scoring/generation using OpenAI credentials.
- **Data deletion policy**: 24-hour auto-delete enabled.
- **Icebreakers model**: pre-generated set of 13 questions; attendee must answer at least 3 (can answer more) to improve match quality.
- **Organizer tag controls**: not required in MVP; use fixed global tag list.

## Prioritized Implementation Plan

### Phase 1 - Demo-Ready Core (ship first)

**Goal**: Deliver a stable end-to-end demo with controlled data and clear user value.

- Add LinkedIn OIDC entry path as default in web onboarding.
- Add Google OAuth fallback path and manual-entry backup path.
- Keep a demo-safe mock data path for events where live integrations are risky.
- Finalize onboarding completion rules:
  - 3 Offer tags
  - 3 Looking For tags
  - mandatory privacy agreement
  - 24-hour deletion toggle default enabled
- Define MVP profile-data contract:
  - LinkedIn/Google sync: name, email, picture
  - required manual completion: company, role, phone
  - document post-MVP LinkedIn enrichment risk (public profile URL/richer CV fields depend on partner access)
- Implement icebreaker questionnaire capture:
  - 13 predefined questions
  - require minimum 3 answered
  - save answers in profile payload
- Implement candidate queue + Like/Pass interactions with deterministic local/backend state.
- Unlock WhatsApp reveal only on mutual Like.
- Provide manual "send next wave" control for demo operators.

**Exit Criteria**
- New user can complete onboarding and reach candidate queue.
- LinkedIn is the default auth option on QR mobile onboarding.
- If LinkedIn auth fails, user can continue with Google; if Google fails, user can continue with manual entry.
- Like/Pass flow works end-to-end with at least one mutual match scenario.
- Mutual match reveals WhatsApp contact only after double opt-in.
- Demo operator can trigger a wave on demand.

### Phase 2 - Smarter Matching + Automation

**Goal**: Improve match quality and reduce manual operations.

- Add fixed 15-minute automated wave scheduler (while retaining manual override).
- Build prompt-driven matchmaking pipeline using:
  - tags,
  - role/context fields,
  - icebreaker responses.
- Store profile and matchmaking payloads in structured JSON documents.
- Add ranking rules to avoid repetitive or low-quality re-suggestions.
- Add basic event-level configuration (wave size, interval, question set version).

**Exit Criteria**
- Users receive scheduled waves automatically during event runtime.
- Match ranking quality is measurably better than random/manual baseline.
- Operator can still override by manually triggering waves.

### Phase 3 - Production Hardening

**Goal**: move from demo-friendly MVP to reliable production behavior.

- Replace remaining mock paths with fully live data services.
- Add auditability for consent + deletion actions (timestamps, actor/event context).
- Add privacy lifecycle jobs to enforce 24-hour deletion guarantees.
- Add resilience controls (retry, fallback, graceful degraded mode if AI provider fails).
- Add observability dashboards for activation, mutual-like rate, and reveal rate.

**Exit Criteria**
- Privacy lifecycle is enforceable and auditable.
- System can run a live event without manual data patching.
- Success metrics are trackable per event.

## Suggested MVP Release Scope Mapping

**Must-Have in MVP**
- QR onboarding web flow.
- OAuth sign-in (LinkedIn or Google).
- Offer/Looking-For tagging.
- Semantic match waves.
- Like/Pass + mutual unlock.
- Mandatory privacy agreement.
- Optional 24-hour deletion toggle.

**Post-MVP Candidates**
- Organizer analytics dashboard.
- Adaptive wave timing using activity signals.
- Expanded profile enrichment and intent taxonomy tooling.
