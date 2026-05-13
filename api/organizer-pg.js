/**
 * Postgres implementation for nl_organizers, nl_events, nl_organizer_sessions.
 * @module
 */

const crypto = require("node:crypto");
const db = require("./db");
const { query } = db;

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const hashToken = (token) =>
  crypto.createHash("sha256").update(String(token), "utf8").digest("hex");

const mapRowToOrganizer = (row) => {
  if (!row) return null;
  const events = Array.isArray(row.events) ? row.events : JSON.parse(row.events || "[]");
  return {
    key: row.id,
    emailNormalized: row.email_normalized,
    details: row.details || {},
    passwordHash: row.password_hash,
    lastActiveEventKey: row.last_active_event_id,
    events: events.map((e) => ({
      event_key: e.event_key,
      details: e.details || {},
      settings: e.settings || {},
      icebreaker_routes: e.icebreaker_routes != null ? e.icebreaker_routes : e.settings?.icebreakerRoutes ?? null,
    })),
  };
};

const loadOrganizerWithEvents = async (whereSql, params) => {
  const r = await query(
    `SELECT o.id, o.email_normalized, o.details, o.password_hash, o.last_active_event_id,
            COALESCE(
              json_agg(
                jsonb_build_object(
                  'event_key', e.id,
                  'details', e.details,
                  'settings', e.settings,
                  'icebreaker_routes', e.icebreaker_routes
                ) ORDER BY e.created_at
              ) FILTER (WHERE e.id IS NOT NULL),
              '[]'::json
            ) AS events
     FROM nl_organizers o
     LEFT JOIN nl_events e ON e.organizer_id = o.id
     ${whereSql}
     GROUP BY o.id, o.email_normalized, o.details, o.password_hash, o.last_active_event_id`,
    params
  );
  if (!r.rows.length) return null;
  const row = r.rows[0];
  return mapRowToOrganizer({
    ...row,
    events: row.events,
  });
};

const findByKey = (organizerKey) =>
  loadOrganizerWithEvents("WHERE o.id = $1", [organizerKey]);

const findByEmail = (emailNormalized) =>
  loadOrganizerWithEvents("WHERE o.email_normalized = $1", [emailNormalized]);

const issueSession = async (organizerId) => {
  const token = crypto.randomBytes(32).toString("hex");
  const th = hashToken(token);
  const exp = new Date(Date.now() + SESSION_TTL_MS);
  await query(`INSERT INTO nl_organizer_sessions (token_hash, organizer_id, expires_at) VALUES ($1, $2, $3)`, [
    th,
    organizerId,
    exp,
  ]);
  return token;
};

const resolveSession = async (token) => {
  if (!token) return null;
  const th = hashToken(token);
  const r = await query(
    `SELECT organizer_id::text AS id
     FROM nl_organizer_sessions
     WHERE token_hash = $1 AND expires_at > now()`,
    [th]
  );
  return r.rows[0]?.id || null;
};

const revokeSession = async (token) => {
  if (!token) return;
  const th = hashToken(token);
  await query(`DELETE FROM nl_organizer_sessions WHERE token_hash = $1`, [th]);
};

const insertOrganizerAndEvent = async (org) => {
  const client = await require("./db").getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO nl_organizers (id, email_normalized, details, password_hash, last_active_event_id)
       VALUES ($1, $2, $3::jsonb, $4::jsonb, $5)`,
      [org.key, org.emailNormalized, org.details, org.passwordHash, org.lastActiveEventKey]
    );
    for (const ev of org.events || []) {
      await client.query(
        `INSERT INTO nl_events (id, organizer_id, details, settings, icebreaker_routes)
         VALUES ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb)`,
        [
          ev.event_key,
          org.key,
          ev.details || {},
          ev.settings || {},
          ev.icebreaker_routes != null ? ev.icebreaker_routes : null,
        ]
      );
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
};

const updateOrganizerLastActive = async (organizerKey, eventKey) => {
  await query(
    `UPDATE nl_organizers SET last_active_event_id = $2, updated_at = now() WHERE id = $1`,
    [organizerKey, eventKey]
  );
};

const updateEventRow = async (organizerKey, eventKey, settings, icebreakerRoutes) => {
  await query(
    `UPDATE nl_events
     SET settings = $1::jsonb,
         icebreaker_routes = $2::jsonb,
         updated_at = now()
     WHERE id = $3 AND organizer_id = $4`,
    [settings, icebreakerRoutes != null ? icebreakerRoutes : null, eventKey, organizerKey]
  );
};

const insertEventRow = async (organizerKey, ev) => {
  await query(
    `INSERT INTO nl_events (id, organizer_id, details, settings, icebreaker_routes)
     VALUES ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb)`,
    [
      ev.event_key,
      organizerKey,
      ev.details || {},
      ev.settings || {},
      ev.icebreaker_routes != null ? ev.icebreaker_routes : null,
    ]
  );
};

const listEvents = async (organizerKey) => {
  const org = await findByKey(organizerKey);
  const last = org?.lastActiveEventKey;
  const r = await query(
    `SELECT id, details, settings FROM nl_events WHERE organizer_id = $1 ORDER BY created_at ASC`,
    [organizerKey]
  );
  return r.rows.map((row) => ({
    event_key: row.id,
    name: row.details?.name || row.settings?.eventInfo?.name || "Event",
    active: row.id === last,
  }));
};

const firstOrganizerForProjection = async () => {
  const r = await query(`SELECT id FROM nl_organizers ORDER BY created_at ASC LIMIT 1`);
  const id = r.rows[0]?.id;
  if (!id) return null;
  return findByKey(id);
};

const seedDemoOrganizerIfEmpty = async (buildDefaultOrganizerSettings, scryptHashPassword, demoPassword, ensureShapeFn) => {
  const cnt = await query(`SELECT COUNT(*)::int AS n FROM nl_organizers`);
  if (cnt.rows[0].n > 0) return false;
  const crypto = require("node:crypto");
  const orgKey = crypto.randomUUID();
  const evtKey = crypto.randomUUID();
  const seedSettings = buildDefaultOrganizerSettings();
  if (typeof ensureShapeFn === "function") ensureShapeFn(seedSettings);
  const normalizeEmail = (e) => String(e || "").trim().toLowerCase();
  const emailNorm = normalizeEmail("organizer@example.com");
  const org = {
    key: orgKey,
    emailNormalized: emailNorm,
    details: { name: "Demo Organizer", email: "organizer@example.com" },
    passwordHash: scryptHashPassword(demoPassword),
    lastActiveEventKey: evtKey,
    events: [
      {
        event_key: evtKey,
        details: { name: seedSettings.eventInfo?.name || "NexusLink Event" },
        settings: seedSettings,
        icebreaker_routes: seedSettings.icebreakerRoutes || null,
      },
    ],
  };
  await insertOrganizerAndEvent(org);
  return true;
};

module.exports = {
  SESSION_TTL_MS,
  hashToken,
  findByKey,
  findByEmail,
  issueSession,
  resolveSession,
  revokeSession,
  insertOrganizerAndEvent,
  updateOrganizerLastActive,
  updateEventRow,
  insertEventRow,
  listEvents,
  firstOrganizerForProjection,
  seedDemoOrganizerIfEmpty,
};
