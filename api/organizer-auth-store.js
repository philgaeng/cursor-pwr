/**
 * Spec 10: organizer accounts, event-scoped settings, bearer sessions.
 * Disk + JSON file when POSTGRES_URL unset; Postgres when POSTGRES_URL / POSTGRES_PRISMA_URL set.
 * @module
 */

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const db = require("./db");
const organizerPg = require("./organizer-pg");

const DEMO_MODE_ENABLED = process.env.DEMO_MODE_ENABLED !== "false";
const DEMO_ORGANIZER_PASSWORD = process.env.DEMO_ORGANIZER_PASSWORD || "changeme";

const STORE_VERSION = 1;

const usePg = () => db.usePersistence();

const defaultStorePaths = () => [
  path.join(process.cwd(), "data", "organizer-store.json"),
  path.join(__dirname, "..", "data", "organizer-store.json"),
];

const getStorePath = () => {
  const env = process.env.ORGANIZER_STORE_PATH;
  if (env && String(env).trim()) return String(env).trim();
  return defaultStorePaths()[0];
};

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

const scryptHashPassword = (password, saltBuf) => {
  const salt = saltBuf || crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(password), salt, 64, { N: 16384, r: 8, p: 1 });
  return {
    algo: "scrypt",
    saltB64: salt.toString("base64"),
    hashB64: hash.toString("base64"),
    N: 16384,
    r: 8,
    p: 1,
    dkLen: 64,
  };
};

const verifyPassword = (password, record) => {
  if (!record || record.algo !== "scrypt") return false;
  const salt = Buffer.from(record.saltB64, "base64");
  const expected = Buffer.from(record.hashB64, "base64");
  const hash = crypto.scryptSync(String(password), salt, expected.length, {
    N: record.N || 16384,
    r: record.r || 8,
    p: record.p || 1,
  });
  return crypto.timingSafeEqual(hash, expected);
};

if (!globalThis.__organizerSessions) {
  globalThis.__organizerSessions = new Map();
}

const sessions = globalThis.__organizerSessions;
const sessionTtlMs = 7 * 24 * 60 * 60 * 1000;

const pruneSessions = () => {
  const now = Date.now();
  for (const [token, meta] of sessions.entries()) {
    if (!meta || typeof meta.expiresAt !== "number" || meta.expiresAt < now) {
      sessions.delete(token);
    }
  }
};

const issueSessionDisk = (organizerKey) => {
  pruneSessions();
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, { organizerKey, expiresAt: Date.now() + sessionTtlMs });
  return token;
};

const resolveSessionDisk = (token) => {
  if (!token) return null;
  pruneSessions();
  const meta = sessions.get(token);
  if (!meta || meta.expiresAt < Date.now()) {
    sessions.delete(token);
    return null;
  }
  return meta.organizerKey;
};

const revokeSessionDisk = (token) => {
  if (token) sessions.delete(token);
};

let diskWriteOk = true;

const readDiskStore = () => {
  for (const candidate of defaultStorePaths()) {
    try {
      if (!fs.existsSync(candidate)) continue;
      const raw = fs.readFileSync(candidate, "utf8");
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && Array.isArray(parsed.organizers)) {
        return { path: candidate, data: parsed };
      }
    } catch (_e) {
      continue;
    }
  }
  return { path: getStorePath(), data: null };
};

const writeDiskStore = (data) => {
  const filePath = getStorePath();
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
    diskWriteOk = true;
  } catch (_e) {
    diskWriteOk = false;
  }
};

if (!globalThis.__organizerDiskStore) {
  globalThis.__organizerDiskStore = { version: STORE_VERSION, organizers: [] };
}

const getDiskStore = () => globalThis.__organizerDiskStore;

const setDiskStore = (next) => {
  globalThis.__organizerDiskStore = next;
  writeDiskStore(next);
};

const findOrganizerIndex = (emailNormalized) =>
  getDiskStore().organizers.findIndex((o) => o.emailNormalized === emailNormalized);

const findOrganizerByKeyDisk = (organizerKey) =>
  getDiskStore().organizers.find((o) => o.key === organizerKey) || null;

const getEvent = (organizer, eventKey) =>
  (organizer.events || []).find((e) => e.event_key === eventKey) || null;

const ensureEventSettingsShape = (settings) => {
  if (!settings || typeof settings !== "object") return settings;
  if (!Array.isArray(settings.icebreakerRoutesHistory)) settings.icebreakerRoutesHistory = [];
  if (!("icebreakerRoutesDraft" in settings)) settings.icebreakerRoutesDraft = null;
  if (!("icebreakerRoutes" in settings)) settings.icebreakerRoutes = null;
  if (!settings.organizer || typeof settings.organizer !== "object") settings.organizer = {};
  if (!settings.organizer.llm || typeof settings.organizer.llm !== "object") {
    settings.organizer.llm = {
      provider: "none",
      apiKeys: { openai: "", anthropic: "", gemini: "", deepseek: "" },
    };
  } else {
    const k =
      settings.organizer.llm.apiKeys && typeof settings.organizer.llm.apiKeys === "object"
        ? settings.organizer.llm.apiKeys
        : {};
    settings.organizer.llm.apiKeys = {
      openai: typeof k.openai === "string" ? k.openai : "",
      anthropic: typeof k.anthropic === "string" ? k.anthropic : "",
      gemini: typeof k.gemini === "string" ? k.gemini : "",
      deepseek: typeof k.deepseek === "string" ? k.deepseek : "",
    };
    const allowed = new Set(["none", "openai", "anthropic", "gemini", "deepseek"]);
    if (!allowed.has(String(settings.organizer.llm.provider || ""))) {
      settings.organizer.llm.provider = "none";
    }
  }
  return settings;
};

const syncIcebreakerRoutesMirror = (eventObj) => {
  if (!eventObj || !eventObj.settings) return;
  eventObj.icebreaker_routes = eventObj.settings.icebreakerRoutes || null;
};

const cloneDeep = (value) => JSON.parse(JSON.stringify(value));

function isEmailShape(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

/** Normalize loaded organizer events from Postgres or disk */
const normalizeOrganizerShape = (org) => {
  if (!org) return null;
  if (!Array.isArray(org.events)) org.events = [];
  for (const ev of org.events) {
    if (ev.settings) ensureEventSettingsShape(ev.settings);
    syncIcebreakerRoutesMirror(ev);
  }
  return org;
};

async function findOrganizerByKey(organizerKey) {
  if (usePg()) {
    const o = await organizerPg.findByKey(organizerKey);
    return normalizeOrganizerShape(o);
  }
  return findOrganizerByKeyDisk(organizerKey);
}

async function findOrganizerByEmail(emailNormalized) {
  if (usePg()) {
    const o = await organizerPg.findByEmail(emailNormalized);
    return normalizeOrganizerShape(o);
  }
  const idx = findOrganizerIndex(emailNormalized);
  if (idx === -1) return null;
  return getDiskStore().organizers[idx];
}

async function issueSessionImpl(organizerKey) {
  if (usePg()) {
    try {
      diskWriteOk = true;
      return await organizerPg.issueSession(organizerKey);
    } catch (_e) {
      diskWriteOk = false;
      throw _e;
    }
  }
  return issueSessionDisk(organizerKey);
}

async function resolveSessionImpl(token) {
  if (usePg()) return organizerPg.resolveSession(token);
  return resolveSessionDisk(token);
}

async function revokeSessionImpl(token) {
  if (usePg()) return organizerPg.revokeSession(token);
  revokeSessionDisk(token);
}

module.exports = {
  normalizeEmail,
  scryptHashPassword,
  verifyPassword,

  async issueSession(organizerKey) {
    return issueSessionImpl(organizerKey);
  },

  async resolveSession(token) {
    return resolveSessionImpl(token);
  },

  async revokeSession(token) {
    return revokeSessionImpl(token);
  },

  getStorePath,
  diskWriteSucceeded: () => diskWriteOk,

  async loadOrganizerStoreFromDisk(buildDefaultOrganizerSettings) {
    if (usePg()) {
      diskWriteOk = true;
      if (DEMO_MODE_ENABLED) {
        await organizerPg.seedDemoOrganizerIfEmpty(
          buildDefaultOrganizerSettings,
          scryptHashPassword,
          DEMO_ORGANIZER_PASSWORD,
          ensureEventSettingsShape
        );
      }
      return { usedPath: "(postgres)", store: null };
    }

    const { path: usedPath, data } = readDiskStore();
    let store = data;
    if (!store || !Array.isArray(store.organizers)) {
      store = { version: STORE_VERSION, organizers: [] };
    }
    store.version = STORE_VERSION;
    globalThis.__organizerDiskStore = store;

    if (store.organizers.length === 0 && DEMO_MODE_ENABLED) {
      const orgKey = crypto.randomUUID();
      const evtKey = crypto.randomUUID();
      const seedSettings = buildDefaultOrganizerSettings();
      ensureEventSettingsShape(seedSettings);
      const organizer = {
        key: orgKey,
        emailNormalized: normalizeEmail("organizer@example.com"),
        details: {
          name: "Demo Organizer",
          email: "organizer@example.com",
        },
        passwordHash: scryptHashPassword(DEMO_ORGANIZER_PASSWORD),
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
      syncIcebreakerRoutesMirror(organizer.events[0]);
      store.organizers = [organizer];
      writeDiskStore(store);
    }

    for (const org of store.organizers) {
      if (!org.key) org.key = crypto.randomUUID();
      if (!Array.isArray(org.events)) org.events = [];
      if (org.events.length === 0) {
        const evtKey = crypto.randomUUID();
        const seedSettings = buildDefaultOrganizerSettings();
        ensureEventSettingsShape(seedSettings);
        org.events.push({
          event_key: evtKey,
          details: { name: seedSettings.eventInfo?.name || "Event" },
          settings: seedSettings,
          icebreaker_routes: seedSettings.icebreakerRoutes || null,
        });
        org.lastActiveEventKey = evtKey;
      }
      if (!org.lastActiveEventKey || !getEvent(org, org.lastActiveEventKey)) {
        org.lastActiveEventKey = org.events[0].event_key;
      }
      for (const ev of org.events) {
        ensureEventSettingsShape(ev.settings);
        syncIcebreakerRoutesMirror(ev);
      }
    }

    return { usedPath: usedPath || getStorePath(), store: getDiskStore() };
  },

  async syncGlobalOrganizerSettingsFromEvent(organizerKey, eventKey, assignGlobal) {
    const org = await findOrganizerByKey(organizerKey);
    if (!org) return null;
    const ev = getEvent(org, eventKey || org.lastActiveEventKey);
    if (!ev || !ev.settings) return null;
    ensureEventSettingsShape(ev.settings);
    syncIcebreakerRoutesMirror(ev);
    if (typeof assignGlobal === "function") {
      assignGlobal(cloneDeep(ev.settings));
    }
    return ev.settings;
  },

  async getDefaultPublicOrganizerProjection(buildDefaultOrganizerSettings, assignGlobal) {
    if (usePg()) {
      const org = await organizerPg.firstOrganizerForProjection();
      if (!org) {
        const fallback = buildDefaultOrganizerSettings();
        if (typeof assignGlobal === "function") assignGlobal(fallback);
        return { organizerKey: null, eventKey: null, settings: fallback };
      }
      const eventKey = org.lastActiveEventKey || org.events[0]?.event_key;
      const settings = await module.exports.syncGlobalOrganizerSettingsFromEvent(org.key, eventKey, assignGlobal);
      return { organizerKey: org.key, eventKey, settings };
    }

    const store = getDiskStore();
    const org = store.organizers[0];
    if (!org) {
      const fallback = buildDefaultOrganizerSettings();
      if (typeof assignGlobal === "function") assignGlobal(fallback);
      return { organizerKey: null, eventKey: null, settings: fallback };
    }
    const eventKey = org.lastActiveEventKey || org.events[0]?.event_key;
    const settings = await module.exports.syncGlobalOrganizerSettingsFromEvent(org.key, eventKey, assignGlobal);
    return { organizerKey: org.key, eventKey, settings };
  },

  async createOrganizer(name, email, password, buildDefaultOrganizerSettings) {
    const emailNorm = normalizeEmail(email);
    if (!emailNorm || !isEmailShape(emailNorm)) {
      return { ok: false, error: "Valid email is required." };
    }
    if (!String(name || "").trim()) {
      return { ok: false, error: "Name is required." };
    }
    if (!String(password || "") || String(password).length < 8) {
      return { ok: false, error: "Password must be at least 8 characters." };
    }

    const orgKey = crypto.randomUUID();
    const evtKey = crypto.randomUUID();
    const seedSettings = buildDefaultOrganizerSettings();
    seedSettings.organizer.creds.email = emailNorm;
    seedSettings.eventInfo.name = `${String(name).trim()}'s event`;
    ensureEventSettingsShape(seedSettings);
    const organizer = {
      key: orgKey,
      emailNormalized: emailNorm,
      details: { name: String(name).trim(), email: email.trim() },
      passwordHash: scryptHashPassword(password),
      lastActiveEventKey: evtKey,
      events: [
        {
          event_key: evtKey,
          details: { name: seedSettings.eventInfo.name },
          settings: seedSettings,
          icebreaker_routes: seedSettings.icebreakerRoutes || null,
        },
      ],
    };
    syncIcebreakerRoutesMirror(organizer.events[0]);

    if (usePg()) {
      try {
        await organizerPg.insertOrganizerAndEvent(organizer);
        diskWriteOk = true;
      } catch (err) {
        diskWriteOk = false;
        if (err && err.code === "23505") {
          return { ok: false, error: "An organizer with this email already exists." };
        }
        throw err;
      }
      return { ok: true, organizer };
    }

    if (findOrganizerIndex(emailNorm) !== -1) {
      return { ok: false, error: "An organizer with this email already exists." };
    }
    const store = getDiskStore();
    store.organizers.push(organizer);
    setDiskStore(store);
    return { ok: true, organizer };
  },

  async loginOrganizer(email, password) {
    const emailNorm = normalizeEmail(email);
    const organizer = await findOrganizerByEmail(emailNorm);
    if (!organizer) return { ok: false, error: "Invalid email or password." };
    if (!verifyPassword(password, organizer.passwordHash)) {
      return { ok: false, error: "Invalid email or password." };
    }
    const token = await issueSessionImpl(organizer.key);
    return { ok: true, token, organizer };
  },

  async getOrganizerForSession(token) {
    const organizerKey = await resolveSessionImpl(token);
    if (!organizerKey) return null;
    return findOrganizerByKey(organizerKey);
  },

  async setLastActiveEvent(organizerKey, eventKey) {
    const org = await findOrganizerByKey(organizerKey);
    if (!org || !getEvent(org, eventKey)) return { ok: false, error: "Event not found." };
    org.lastActiveEventKey = eventKey;
    if (usePg()) {
      try {
        await organizerPg.updateOrganizerLastActive(organizerKey, eventKey);
        diskWriteOk = true;
      } catch (_e) {
        diskWriteOk = false;
        throw _e;
      }
    } else {
      setDiskStore(getDiskStore());
    }
    return { ok: true };
  },

  async updateOrganizerActiveEventSettings(organizerKey, incomingSettings, mergeObjects, buildDefaultOrganizerSettings) {
    const org = await findOrganizerByKey(organizerKey);
    if (!org) return { ok: false, error: "Organizer not found." };
    const eventKey = org.lastActiveEventKey;
    const ev = getEvent(org, eventKey);
    if (!ev) return { ok: false, error: "Active event missing." };
    const base = mergeObjects(buildDefaultOrganizerSettings(), ev.settings || {});
    ev.settings = mergeObjects(base, incomingSettings);
    ensureEventSettingsShape(ev.settings);
    syncIcebreakerRoutesMirror(ev);
    if (usePg()) {
      try {
        await organizerPg.updateEventRow(organizerKey, eventKey, ev.settings, ev.icebreaker_routes);
        diskWriteOk = true;
      } catch (_e) {
        diskWriteOk = false;
        throw _e;
      }
    } else {
      setDiskStore(getDiskStore());
    }
    return { ok: true, settings: ev.settings, eventKey };
  },

  async applyFullActiveEventSettings(organizerKey, nextSettings) {
    const org = await findOrganizerByKey(organizerKey);
    if (!org) return { ok: false, error: "Organizer not found." };
    const ev = getEvent(org, org.lastActiveEventKey);
    if (!ev) return { ok: false, error: "Active event missing." };
    ev.settings = cloneDeep(nextSettings);
    ensureEventSettingsShape(ev.settings);
    syncIcebreakerRoutesMirror(ev);
    if (usePg()) {
      try {
        await organizerPg.updateEventRow(organizerKey, ev.event_key, ev.settings, ev.icebreaker_routes);
        diskWriteOk = true;
      } catch (_e) {
        diskWriteOk = false;
        throw _e;
      }
    } else {
      setDiskStore(getDiskStore());
    }
    return { ok: true, settings: ev.settings };
  },

  async createEvent(organizerKey, name, buildDefaultOrganizerSettings) {
    const org = await findOrganizerByKey(organizerKey);
    if (!org) return { ok: false, error: "Organizer not found." };
    const evtKey = crypto.randomUUID();
    const seed = buildDefaultOrganizerSettings();
    seed.eventInfo.name = String(name || "New event").trim() || "New event";
    ensureEventSettingsShape(seed);
    const eventObj = {
      event_key: evtKey,
      details: { name: seed.eventInfo.name },
      settings: seed,
      icebreaker_routes: seed.icebreakerRoutes || null,
    };
    syncIcebreakerRoutesMirror(eventObj);
    org.events.push(eventObj);
    org.lastActiveEventKey = evtKey;
    if (usePg()) {
      try {
        await organizerPg.insertEventRow(organizerKey, eventObj);
        await organizerPg.updateOrganizerLastActive(organizerKey, evtKey);
        diskWriteOk = true;
      } catch (_e) {
        diskWriteOk = false;
        throw _e;
      }
    } else {
      setDiskStore(getDiskStore());
    }
    return { ok: true, eventKey: evtKey };
  },

  async cloneEvent(organizerKey, fromEventKey, buildDefaultOrganizerSettings) {
    const org = await findOrganizerByKey(organizerKey);
    if (!org) return { ok: false, error: "Organizer not found." };
    const src = getEvent(org, fromEventKey || org.lastActiveEventKey);
    if (!src || !src.settings) return { ok: false, error: "Source event not found." };
    const evtKey = crypto.randomUUID();
    const copy = cloneDeep(src.settings);
    copy.eventInfo = copy.eventInfo || {};
    copy.eventInfo.id = evtKey;
    copy.eventInfo.name = `${copy.eventInfo.name || "Event"} (copy)`;
    ensureEventSettingsShape(copy);
    const eventObj = {
      event_key: evtKey,
      details: { name: copy.eventInfo.name },
      settings: copy,
      icebreaker_routes: copy.icebreakerRoutes || null,
    };
    syncIcebreakerRoutesMirror(eventObj);
    org.events.push(eventObj);
    org.lastActiveEventKey = evtKey;
    if (usePg()) {
      try {
        await organizerPg.insertEventRow(organizerKey, eventObj);
        await organizerPg.updateOrganizerLastActive(organizerKey, evtKey);
        diskWriteOk = true;
      } catch (_e) {
        diskWriteOk = false;
        throw _e;
      }
    } else {
      setDiskStore(getDiskStore());
    }
    return { ok: true, eventKey: evtKey };
  },

  async listEvents(organizerKey) {
    if (usePg()) return organizerPg.listEvents(organizerKey);
    const org = findOrganizerByKeyDisk(organizerKey);
    if (!org) return [];
    return (org.events || []).map((e) => ({
      event_key: e.event_key,
      name: e.details?.name || e.settings?.eventInfo?.name || "Event",
      active: e.event_key === org.lastActiveEventKey,
    }));
  },

  async revokeOrganizerSession(token) {
    await revokeSessionImpl(token);
  },
};
