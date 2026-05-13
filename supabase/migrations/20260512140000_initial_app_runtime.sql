-- NexusLink durable runtime tables (public schema).
-- Mirrors current api/handler.js maps and api/organizer-auth-store.js disk shape.
-- Serverless API should connect with a server-side role (e.g. pooler URL from Vercel);
-- RLS policies can be added later if clients use Supabase Auth + PostgREST directly.

-- Organizer accounts (spec 10)
CREATE TABLE IF NOT EXISTS nl_organizers (
  id uuid PRIMARY KEY,
  email_normalized text NOT NULL UNIQUE,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  password_hash jsonb NOT NULL,
  last_active_event_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nl_events (
  id text PRIMARY KEY,
  organizer_id uuid NOT NULL REFERENCES nl_organizers (id) ON DELETE CASCADE,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  icebreaker_routes jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS nl_events_organizer_id_idx ON nl_events (organizer_id);

-- Opaque organizer bearer sessions (replace in-memory Map for multi-instance)
CREATE TABLE IF NOT EXISTS nl_organizer_sessions (
  token_hash text PRIMARY KEY,
  organizer_id uuid NOT NULL REFERENCES nl_organizers (id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS nl_organizer_sessions_expires_at_idx ON nl_organizer_sessions (expires_at);

-- Attendee auth stub sessions (handler store.sessions)
CREATE TABLE IF NOT EXISTS nl_attendee_sessions (
  user_id text NOT NULL,
  event_id text NOT NULL,
  session jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, event_id)
);

-- Onboarding draft payload per user+event (handler store.onboardingDrafts)
CREATE TABLE IF NOT EXISTS nl_onboarding_drafts (
  user_id text NOT NULL,
  event_id text NOT NULL,
  draft jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, event_id)
);

-- Completed attendee profiles
CREATE TABLE IF NOT EXISTS nl_profiles (
  user_id text NOT NULL,
  event_id text NOT NULL,
  profile jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, event_id)
);

CREATE INDEX IF NOT EXISTS nl_profiles_event_id_idx ON nl_profiles (event_id);

-- One active wave document per event (handler store.wavesByEvent)
CREATE TABLE IF NOT EXISTS nl_waves (
  event_id text PRIMARY KEY,
  wave jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Like/pass per actor/target per event (natural key matches handler Map)
CREATE TABLE IF NOT EXISTS nl_match_actions (
  event_id text NOT NULL,
  user_id text NOT NULL,
  target_user_id text NOT NULL,
  wave_id text,
  action text NOT NULL CHECK (action IN ('like', 'pass')),
  acted_at timestamptz NOT NULL,
  PRIMARY KEY (event_id, user_id, target_user_id)
);

CREATE INDEX IF NOT EXISTS nl_match_actions_user_idx ON nl_match_actions (event_id, user_id);

-- Meetup wearable marker (handler store.meetupPreferences)
CREATE TABLE IF NOT EXISTS nl_meetup_preferences (
  user_id text NOT NULL,
  event_id text NOT NULL,
  prefs jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, event_id)
);
