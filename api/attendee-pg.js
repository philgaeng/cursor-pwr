/**
 * Postgres persistence for attendee runtime (nl_* tables).
 * No-op when POSTGRES_URL is unset — caller keeps using in-memory Maps.
 * @module
 */

const db = require("./db");
const { query } = db;

const persist = () => db.usePersistence();

/** Insert or replace completed onboarding profile */
const upsertProfile = async (userId, eventId, profile) => {
  if (!persist()) return;
  await query(
    `INSERT INTO nl_profiles (user_id, event_id, profile, updated_at)
     VALUES ($1, $2, $3::jsonb, now())
     ON CONFLICT (user_id, event_id) DO UPDATE SET
       profile = EXCLUDED.profile,
       updated_at = now()`,
    [userId, eventId, profile]
  );
};

const profileExists = async (userId, eventId) => {
  if (!persist()) return false;
  const r = await query(
    `SELECT 1 FROM nl_profiles WHERE user_id = $1 AND event_id = $2 LIMIT 1`,
    [userId, eventId]
  );
  return r.rows.length > 0;
};

/** Single wave document per event */
const upsertWave = async (eventId, wave) => {
  if (!persist()) return;
  await query(
    `INSERT INTO nl_waves (event_id, wave, updated_at)
     VALUES ($1, $2::jsonb, now())
     ON CONFLICT (event_id) DO UPDATE SET
       wave = EXCLUDED.wave,
       updated_at = now()`,
    [eventId, wave]
  );
};

const getWave = async (eventId) => {
  if (!persist()) return null;
  const r = await query(`SELECT wave FROM nl_waves WHERE event_id = $1`, [eventId]);
  return r.rows[0]?.wave || null;
};

const upsertMatchAction = async (eventId, userId, targetUserId, waveId, action, actedAtIso) => {
  if (!persist()) return;
  await query(
    `INSERT INTO nl_match_actions (event_id, user_id, target_user_id, wave_id, action, acted_at)
     VALUES ($1, $2, $3, $4, $5, $6::timestamptz)
     ON CONFLICT (event_id, user_id, target_user_id) DO UPDATE SET
       wave_id = EXCLUDED.wave_id,
       action = EXCLUDED.action,
       acted_at = EXCLUDED.acted_at`,
    [eventId, userId, targetUserId, waveId, action, actedAtIso]
  );
};

const upsertMeetupPreferences = async (userId, eventId, prefs) => {
  if (!persist()) return;
  await query(
    `INSERT INTO nl_meetup_preferences (user_id, event_id, prefs, updated_at)
     VALUES ($1, $2, $3::jsonb, now())
     ON CONFLICT (user_id, event_id) DO UPDATE SET
       prefs = EXCLUDED.prefs,
       updated_at = now()`,
    [userId, eventId, prefs]
  );
};

const getMeetupPreferences = async (userId, eventId) => {
  if (!persist()) return null;
  const r = await query(`SELECT prefs FROM nl_meetup_preferences WHERE user_id = $1 AND event_id = $2`, [
    userId,
    eventId,
  ]);
  return r.rows[0]?.prefs || null;
};

module.exports = {
  upsertProfile,
  profileExists,
  upsertWave,
  getWave,
  upsertMatchAction,
  upsertMeetupPreferences,
  getMeetupPreferences,
};
