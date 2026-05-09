const http = require("node:http");
const { randomUUID } = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");

const HOST = process.env.API_HOST || "127.0.0.1";
const PORT = Number(process.env.API_PORT || 8787);
const DEMO_MODE_ENABLED = process.env.DEMO_MODE_ENABLED !== "false";
const LINKEDIN_AUTH_ENABLED = process.env.LINKEDIN_AUTH_ENABLED !== "false";
const GOOGLE_AUTH_ENABLED = process.env.GOOGLE_AUTH_ENABLED !== "false";

const GLOBAL_TAG_CATALOG = Object.freeze({
  offers: [
    "funding",
    "product-advice",
    "go-to-market",
    "engineering-leadership",
    "growth-marketing",
    "partnerships",
    "hiring",
    "mentorship",
  ],
  seeks: [
    "investors",
    "pilot-customers",
    "technical-cofounder",
    "distribution-partner",
    "enterprise-intros",
    "advisors",
    "hiring-talent",
    "community",
  ],
});

const EVENT_ID = "demo-event-2026";
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "store.json");
const SETTINGS_DIR = path.join(__dirname, "settings");
const SETTINGS_FILE = path.join(SETTINGS_DIR, "event-settings.json");
const ROUTES_FILE = path.join(__dirname, "..", "..", "docs", "resource", "icebreaker-routes.v1.json");

const store = {
  sessions: new Map(),
  profiles: new Map(),
  onboardingDrafts: new Map(),
  actions: new Map(),
  wavesByEvent: new Map(),
};

const buildDefaultOrganizerSettings = () => ({
  organizer: {
    creds: {
      email: "",
      google: {
        enabled: false,
        clientEmail: "",
        privateKey: "",
        spreadsheetId: "",
        folderPath: "",
      },
    },
    socialMedia: {
      instagram: "",
      whatsapp: "",
      linkedin: "",
    },
  },
  eventInfo: {
    id: EVENT_ID,
    name: "NexusLink Event",
    description: "",
    outroMessage: "",
  },
  freebies: {
    enabled: false,
    links: [],
  },
  attendance: {
    expectedSize: 80,
    crowdDescription: "",
  },
  questionRoutes: {
    suggestions: [
      "food",
      "sweets",
      "family_life",
      "travel",
      "entertainment",
      "work_style",
      "hobbies",
      "hot_takes",
    ],
    crowdCues: "",
  },
  parameters: {
    onboarding: {
      requiredOfferTags: 1,
      requiredSeekTags: 1,
      requiredIcebreakerAnswers: 3,
      requiredAssignedRoutesPerParticipant: 3,
      onboardingResumeTimeoutSeconds: 180,
    },
    matching: {
      roomSizeStrictModeThreshold: 100,
      strictCoverageTargetPercent: 100,
      relaxedCoverageTargetPercent: 92,
      waveIntervalMinutes: 15,
      waveSizeLimit: 5,
      targetSuggestionsPerUser: 5,
      diversity: {
        minDominantRoutes: 3,
        maxSuggestionsPerDominantRoute: 2,
      },
      repeatPolicy: {
        allowAcrossWaves: true,
        cooldownWaves: 2,
      },
      scoring: {
        weights: {
          tier1: 3,
          tier2: 2,
          tier3: 2,
          rarityBonus: 5,
          freeTextSemanticBonus: 5,
        },
        startScoringMinParticipants: 40,
        minMatchFloorStrategy:
          "distribution_floor_lowest_second_highest_score",
        lowConfidenceHandling: {
          showFewerByDefault: true,
          labelWhenShown: true,
        },
      },
    },
    privacy: {
      requireDoubleOptIn: true,
      primaryRevealChannel: "whatsapp",
      autoDeleteDefaultHoursAfterEvent: 24,
      requireConsentAuditTrail: true,
    },
  },
});

let organizerSettings = buildDefaultOrganizerSettings();
let routeCatalog = null;

const hydrateMap = (map, entries) => {
  map.clear();
  if (!Array.isArray(entries)) {
    return;
  }
  entries.forEach((entry) => {
    if (!entry || typeof entry !== "object") {
      return;
    }
    if (!Object.prototype.hasOwnProperty.call(entry, "key")) {
      return;
    }
    map.set(entry.key, entry.value);
  });
};

const loadStoreFromDisk = async () => {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw);
    hydrateMap(store.sessions, parsed.sessions);
    hydrateMap(store.profiles, parsed.profiles);
    hydrateMap(store.onboardingDrafts, parsed.onboardingDrafts);
    hydrateMap(store.actions, parsed.actions);
    hydrateMap(store.wavesByEvent, parsed.wavesByEvent);
  } catch (error) {
    if (error && error.code === "ENOENT") {
      await fs.mkdir(DATA_DIR, { recursive: true });
      await fs.writeFile(DATA_FILE, JSON.stringify({}, null, 2), "utf8");
      return;
    }
    throw error;
  }
};

const loadOrganizerSettingsFromDisk = async () => {
  const defaults = buildDefaultOrganizerSettings();
  try {
    const raw = await fs.readFile(SETTINGS_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      organizerSettings = defaults;
      return;
    }
    organizerSettings = mergeObjects(defaults, parsed);
  } catch (error) {
    if (error && error.code === "ENOENT") {
      organizerSettings = defaults;
      await persistOrganizerSettings();
      return;
    }
    throw error;
  }
};

const loadRouteCatalogFromDisk = async () => {
  try {
    const raw = await fs.readFile(ROUTES_FILE, "utf8");
    routeCatalog = JSON.parse(raw);
  } catch (error) {
    routeCatalog = null;
    throw error;
  }
};

const persistStoreToDisk = async () => {
  const snapshot = {
    sessions: Array.from(store.sessions.entries()).map(([key, value]) => ({ key, value })),
    profiles: Array.from(store.profiles.entries()).map(([key, value]) => ({ key, value })),
    onboardingDrafts: Array.from(store.onboardingDrafts.entries()).map(([key, value]) => ({
      key,
      value,
    })),
    actions: Array.from(store.actions.entries()).map(([key, value]) => ({ key, value })),
    wavesByEvent: Array.from(store.wavesByEvent.entries()).map(([key, value]) => ({ key, value })),
  };
  const tempFile = `${DATA_FILE}.tmp`;
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(tempFile, JSON.stringify(snapshot, null, 2), "utf8");
  await fs.rename(tempFile, DATA_FILE);
};

const persistOrganizerSettings = async () => {
  const tempFile = `${SETTINGS_FILE}.tmp`;
  await fs.mkdir(SETTINGS_DIR, { recursive: true });
  await fs.writeFile(tempFile, JSON.stringify(organizerSettings, null, 2), "utf8");
  await fs.rename(tempFile, SETTINGS_FILE);
};

const sendJson = (res, statusCode, payload) => {
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-User-Id",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  });
  res.end(JSON.stringify(payload));
};

const parseJsonBody = async (req) => {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  if (chunks.length === 0) {
    return {};
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  try {
    return JSON.parse(raw);
  } catch (_error) {
    throw new Error("Invalid JSON body.");
  }
};

const isNonEmptyString = (value) =>
  typeof value === "string" && value.trim().length > 0;

const hasMinimumTags = (value, minCount) =>
  Array.isArray(value) &&
  value.length >= minCount &&
  value.every((item) => isNonEmptyString(item));

const isIcebreakerResponses = (value) =>
  Array.isArray(value) &&
  value.length >= 3 &&
  value.every(
    (item) =>
      item &&
      typeof item === "object" &&
      isNonEmptyString(item.questionId) &&
      isNonEmptyString(item.answer)
  );

const normalizeAnswers = (answers) => {
  if (!Array.isArray(answers)) {
    return [];
  }
  return answers
    .filter((answer) => isNonEmptyString(answer))
    .map((answer, index) => ({
      questionId: `q${index + 1}`,
      answer: answer.trim(),
    }));
};

const getUserId = (req, body) =>
  req.headers["x-user-id"] || body.userId || body.id || null;

const isEmail = (value) =>
  isNonEmptyString(value) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

const mergeObjects = (base, override) => {
  if (Array.isArray(base) && Array.isArray(override)) {
    return override;
  }
  if (
    !base ||
    !override ||
    typeof base !== "object" ||
    typeof override !== "object" ||
    Array.isArray(base) ||
    Array.isArray(override)
  ) {
    return override;
  }

  const merged = { ...base };
  Object.keys(override).forEach((key) => {
    const baseValue = base[key];
    const overrideValue = override[key];
    if (overrideValue === undefined) {
      return;
    }
    if (
      baseValue &&
      overrideValue &&
      typeof baseValue === "object" &&
      typeof overrideValue === "object" &&
      !Array.isArray(baseValue) &&
      !Array.isArray(overrideValue)
    ) {
      merged[key] = mergeObjects(baseValue, overrideValue);
      return;
    }
    merged[key] = overrideValue;
  });
  return merged;
};

const isPositiveInteger = (value) => Number.isInteger(value) && value > 0;

const validateOrganizerSettings = (settings) => {
  if (!settings || typeof settings !== "object") {
    return "settings payload must be an object.";
  }

  if (!isEmail(settings.organizer?.creds?.email)) {
    return "organizer.creds.email must be a valid email.";
  }
  if (!isNonEmptyString(settings.eventInfo?.name)) {
    return "eventInfo.name is required.";
  }
  if (
    !Array.isArray(settings.questionRoutes?.suggestions) ||
    settings.questionRoutes.suggestions.length !== 8 ||
    !settings.questionRoutes.suggestions.every((entry) => isNonEmptyString(entry))
  ) {
    return "questionRoutes.suggestions must contain exactly 8 non-empty strings.";
  }
  if (
    !isPositiveInteger(settings.parameters?.matching?.waveIntervalMinutes) ||
    !isPositiveInteger(settings.parameters?.matching?.waveSizeLimit)
  ) {
    return "matching wave interval and wave size must be positive integers.";
  }
  if (!isPositiveInteger(settings.attendance?.expectedSize)) {
    return "attendance.expectedSize must be a positive integer.";
  }
  if (
    !Array.isArray(settings.freebies?.links) ||
    !settings.freebies.links.every((entry) => typeof entry === "string")
  ) {
    return "freebies.links must be an array of strings.";
  }
  return null;
};

const ensureDraft = (userId) => {
  const current = store.onboardingDrafts.get(userId) || {};
  store.onboardingDrafts.set(userId, current);
  return current;
};

const buildMockCandidates = () => [
  {
    id: "u2",
    name: "Elena Park",
    role: "Investor",
    company: "Green VC",
    whatsapp: "+65 8111 1111",
    icebreakerResponses: [
      { routeId: "food", tier1: "italian", tier2: "pizza", tier3: ["margherita", "mozza"], freeText: "Tiramisu" },
      { routeId: "travel", tier1: "city_break", tier2: "food_hunt", tier3: ["metro_manila", "packed"], freeText: "Weekend food crawl in Binondo" },
      { routeId: "work_style", tier1: "connector", tier2: "broad", tier3: ["community_meetups", "weekly"], freeText: "Founder dinners" },
    ],
  },
  {
    id: "u3",
    name: "Daniel Ng",
    role: "Frontend Engineer",
    company: "Flow Apps",
    whatsapp: "+65 8222 2222",
    icebreakerResponses: [
      { routeId: "food", tier1: "japanese", tier2: "ramen", tier3: ["tonkotsu", "egg"], freeText: "Late-night ramen" },
      { routeId: "hobbies", tier1: "gaming", tier2: "competitive", tier3: ["team", "pc_console"], freeText: "Valorant stack" },
      { routeId: "hot_takes", tier1: "tech_opinions", tier2: "early", tier3: ["weekend_hacks", "ai_first"], freeText: "Ship AI quickly" },
    ],
  },
  {
    id: "u4",
    name: "Sophia Tan",
    role: "Operator",
    company: "Scale Studio",
    whatsapp: "+65 8333 3333",
    icebreakerResponses: [
      { routeId: "work_style", tier1: "operator", tier2: "process", tier3: ["detailed", "structured"], freeText: "Ops playbooks" },
      { routeId: "travel", tier1: "road_trip", tier2: "friends", tier3: ["tagaytay", "throwbacks"], freeText: "Coffee road trips" },
      { routeId: "entertainment", tier1: "podcasts", tier2: "tech_business", tier3: ["startups", "1_5x"], freeText: "Startup stories" },
    ],
  },
  {
    id: "u5",
    name: "Miguel Reyes",
    role: "AI Engineer",
    company: "Prompt Forge",
    whatsapp: "+63 917 555 0101",
    icebreakerResponses: [
      { routeId: "hot_takes", tier1: "tech_opinions", tier2: "early", tier3: ["prod_trials", "ai_first"], freeText: "Agents everywhere" },
      { routeId: "work_style", tier1: "builder", tier2: "ship_fast", tier3: ["daily", "minimum_viable"], freeText: "Fast experiments" },
      { routeId: "entertainment", tier1: "music", tier2: "opm", tier3: ["upbeat", "commute"], freeText: "Cup of Joe playlist" },
    ],
  },
  {
    id: "u6",
    name: "Patricia Cruz",
    role: "Product Manager",
    company: "LaunchLayer",
    whatsapp: "+63 917 555 0202",
    icebreakerResponses: [
      { routeId: "food", tier1: "filipino_classics", tier2: "ulam_rice", tier3: ["adobo", "maanghang"], freeText: "Adobo sa gata" },
      { routeId: "hobbies", tier1: "fitness", tier2: "running", tier3: ["city_run", "night"], freeText: "BGC run club" },
      { routeId: "travel", tier1: "beach", tier2: "quiet", tier3: ["sunset_walk", "resort"], freeText: "Boracay sunsets" },
    ],
  },
  {
    id: "u7",
    name: "Carlo Dizon",
    role: "Startup Founder",
    company: "BuildSprint",
    whatsapp: "+63 917 555 0303",
    icebreakerResponses: [
      { routeId: "entertainment", tier1: "podcasts", tier2: "tech_business", tier3: ["ai_tools", "1_5x"], freeText: "Founder podcasts" },
      { routeId: "work_style", tier1: "strategist", tier2: "iterative", tier3: ["weekly", "experiment"], freeText: "Build-measure-learn" },
      { routeId: "sweets", tier1: "ice_cream", tier2: "local_flavors", tier3: ["ube", "smooth"], freeText: "Ube gelato" },
    ],
  },
];

const responseToSignal = (response) => {
  if (!response || !isNonEmptyString(response.routeId)) return null;
  return {
    routeId: response.routeId.trim(),
    tier1: isNonEmptyString(response.tier1) ? response.tier1.trim() : "",
    tier2: isNonEmptyString(response.tier2) ? response.tier2.trim() : "",
    tier3: Array.isArray(response.tier3)
      ? response.tier3.filter((x) => isNonEmptyString(x)).map((x) => x.trim())
      : [],
    freeText: isNonEmptyString(response.freeText) ? response.freeText.trim() : "",
  };
};

const buildSignalMap = (responses) => {
  const map = new Map();
  (responses || []).forEach((response) => {
    const signal = responseToSignal(response);
    if (signal) map.set(signal.routeId, signal);
  });
  return map;
};

const humanize = (token) => (token || "").replace(/_/g, " ");

const scoreCandidate = (userProfile, candidate) => {
  const userSignals = buildSignalMap(userProfile.icebreakerResponses);
  const candidateSignals = buildSignalMap(candidate.icebreakerResponses);
  let score = 0;
  const reasons = [];

  userSignals.forEach((userSignal, routeId) => {
    const candidateSignal = candidateSignals.get(routeId);
    if (!candidateSignal) return;
    if (userSignal.tier1 && userSignal.tier1 === candidateSignal.tier1) {
      score += organizerSettings.parameters.matching.scoring.weights.tier1;
      reasons.push(`You both: ${humanize(routeId)} -> ${humanize(userSignal.tier1)}`);
    }
    if (userSignal.tier2 && userSignal.tier2 === candidateSignal.tier2) {
      score += organizerSettings.parameters.matching.scoring.weights.tier2;
      reasons.push(`Shared preference: ${humanize(userSignal.tier2)}`);
    }
    const userTier3 = new Set(userSignal.tier3);
    candidateSignal.tier3.forEach((answer) => {
      if (userTier3.has(answer)) {
        score += organizerSettings.parameters.matching.scoring.weights.tier3;
        reasons.push(`Both chose: ${humanize(answer)}`);
      }
    });
    if (userSignal.tier1 === candidateSignal.tier1 && userSignal.tier2 === candidateSignal.tier2) {
      score += organizerSettings.parameters.matching.scoring.weights.rarityBonus;
    }
    if (userSignal.freeText && candidateSignal.freeText) {
      score += organizerSettings.parameters.matching.scoring.weights.freeTextSemanticBonus;
    }
  });

  return {
    id: candidate.id,
    name: candidate.name,
    role: candidate.role,
    company: candidate.company,
    compatibilityScore: Math.min(0.99, Math.max(0.45, score / 30)),
    reasons: reasons.slice(0, 3).length ? reasons.slice(0, 3) : ["Potential complementary match"],
    whatsapp: candidate.whatsapp,
  };
};

const createWave = (eventId, userProfile) => ({
  waveId: `wave-${Date.now()}`,
  eventId,
  createdAt: new Date().toISOString(),
  candidates: buildMockCandidates()
    .map((candidate) => scoreCandidate(userProfile, candidate))
    .sort((a, b) => b.compatibilityScore - a.compatibilityScore)
    .slice(0, organizerSettings.parameters.matching.targetSuggestionsPerUser),
});

const route = async (req, res) => {
  if (req.method === "OPTIONS") {
    sendJson(res, 200, { ok: true });
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;

  try {
    if (req.method === "GET" && path === "/api/health") {
      sendJson(res, 200, { ok: true, service: "apps/api", mode: "demo-ready" });
      return;
    }

    if (req.method === "GET" && path === "/api/tags/catalog") {
      sendJson(res, 200, { ok: true, eventId: EVENT_ID, tags: GLOBAL_TAG_CATALOG });
      return;
    }

    if (req.method === "GET" && path === "/api/routes/catalog") {
      if (!routeCatalog) {
        sendJson(res, 500, { ok: false, error: "Route catalog is unavailable." });
        return;
      }
      sendJson(res, 200, routeCatalog);
      return;
    }

    if (req.method === "GET" && path === "/api/organizer/settings") {
      sendJson(res, 200, {
        ok: true,
        eventId: EVENT_ID,
        settings: organizerSettings,
      });
      return;
    }

    if (req.method === "POST" && path === "/api/organizer/settings") {
      const body = await parseJsonBody(req);
      const incomingSettings =
        body && typeof body === "object" && body.settings ? body.settings : body;
      const nextSettings = mergeObjects(organizerSettings, incomingSettings);
      const validationError = validateOrganizerSettings(nextSettings);
      if (validationError) {
        sendJson(res, 400, { ok: false, error: validationError });
        return;
      }
      organizerSettings = nextSettings;
      await persistOrganizerSettings();
      sendJson(res, 200, { ok: true, eventId: EVENT_ID, settings: organizerSettings });
      return;
    }

    if (req.method === "POST" && path === "/api/auth/session") {
      const body = await parseJsonBody(req);
      const provider = body.provider;
      if (provider !== "google" && provider !== "linkedin") {
        sendJson(res, 400, { ok: false, error: "provider must be google or linkedin" });
        return;
      }
      if (provider === "linkedin" && !LINKEDIN_AUTH_ENABLED) {
        sendJson(res, 503, { ok: false, error: "LinkedIn sign-in is currently unavailable." });
        return;
      }
      if (provider === "google" && !GOOGLE_AUTH_ENABLED) {
        sendJson(res, 503, { ok: false, error: "Google sign-in is currently unavailable." });
        return;
      }
      const userId = body.userId || randomUUID();
      const profileName =
        provider === "linkedin" ? "LinkedIn Attendee" : "Google Attendee";
      store.sessions.set(userId, {
        provider,
        demoMode: Boolean(body.demoMode),
        createdAt: new Date().toISOString(),
      });
      await persistStoreToDisk();
      sendJson(res, 200, {
        ok: true,
        userId,
        provider,
        demoMode: Boolean(body.demoMode),
        profile: {
          name: profileName,
          email: `${provider}.${userId.slice(0, 8)}@nexuslink.local`,
          picture: `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(profileName)}`,
        },
      });
      return;
    }

    if (req.method === "POST" && path === "/api/auth/manual-bootstrap") {
      const body = await parseJsonBody(req);
      if (!isNonEmptyString(body.name)) {
        sendJson(res, 400, { ok: false, error: "Manual bootstrap requires name." });
        return;
      }
      if (!isNonEmptyString(body.company)) {
        sendJson(res, 400, { ok: false, error: "Manual bootstrap requires company." });
        return;
      }
      if (!isNonEmptyString(body.role)) {
        sendJson(res, 400, { ok: false, error: "Manual bootstrap requires role." });
        return;
      }
      if (!isEmail(body.email)) {
        sendJson(res, 400, { ok: false, error: "Manual bootstrap requires a valid email." });
        return;
      }
      if (!isNonEmptyString(body.phone)) {
        sendJson(res, 400, { ok: false, error: "Manual bootstrap requires phone." });
        return;
      }

      const userId = body.userId || randomUUID();
      const draft = ensureDraft(userId);
      draft.profile = {
        id: userId,
        name: body.name.trim(),
        role: body.role.trim(),
        company: body.company.trim(),
        email: body.email.trim(),
        whatsapp: body.phone.trim(),
      };
      store.sessions.set(userId, {
        provider: "manual",
        demoMode: true,
        createdAt: new Date().toISOString(),
      });
      await persistStoreToDisk();
      sendJson(res, 200, {
        ok: true,
        userId,
        provider: "manual",
        profile: {
          name: draft.profile.name,
          role: draft.profile.role,
          company: draft.profile.company,
          email: draft.profile.email,
          phone: draft.profile.whatsapp,
        },
      });
      return;
    }

    if (req.method === "POST" && path === "/api/auth/demo-login") {
      if (!DEMO_MODE_ENABLED) {
        sendJson(res, 403, { ok: false, error: "Demo mode is disabled." });
        return;
      }
      const body = await parseJsonBody(req);
      const userId = body.userId || randomUUID();
      store.sessions.set(userId, {
        provider: "google",
        demoMode: true,
        createdAt: new Date().toISOString(),
      });
      await persistStoreToDisk();
      sendJson(res, 200, {
        ok: true,
        userId,
        provider: "google",
        demoMode: true,
      });
      return;
    }

    if (req.method === "POST" && path === "/api/onboarding/profile") {
      const body = await parseJsonBody(req);
      const userId = getUserId(req, body);
      if (!isNonEmptyString(userId)) {
        sendJson(res, 400, { ok: false, error: "Missing userId (or X-User-Id)." });
        return;
      }

      const offers = body.offers || body.whatIOffer;
      const seeks = body.seeks || body.whatISeek;
      const minOfferTags = organizerSettings.parameters.onboarding.requiredOfferTags || 1;
      const minSeekTags = organizerSettings.parameters.onboarding.requiredSeekTags || 1;
      if (!hasMinimumTags(offers, minOfferTags) || !hasMinimumTags(seeks, minSeekTags)) {
        sendJson(res, 400, {
          ok: false,
          error: `Profile requires at least ${minOfferTags} offer tag(s) and at least ${minSeekTags} seek tag(s).`,
        });
        return;
      }
      if (!isNonEmptyString(body.role) || !isNonEmptyString(body.company)) {
        sendJson(res, 400, { ok: false, error: "Profile requires role and company." });
        return;
      }

      const draft = ensureDraft(userId);
      draft.profile = {
        id: userId,
        name: body.name || body.fullName || "Anonymous Attendee",
        role: body.role.trim(),
        company: body.company.trim(),
        offers: offers.map((x) => x.trim()),
        seeks: seeks.map((x) => x.trim()),
        whatsapp: isNonEmptyString(body.whatsapp) ? body.whatsapp.trim() : undefined,
      };
      await persistStoreToDisk();
      sendJson(res, 200, { ok: true, userId, profileSaved: true });
      return;
    }

    if (req.method === "POST" && path === "/api/onboarding/questions") {
      const body = await parseJsonBody(req);
      const userId = getUserId(req, body);
      if (!isNonEmptyString(userId)) {
        sendJson(res, 400, { ok: false, error: "Missing userId (or X-User-Id)." });
        return;
      }
      const draft = ensureDraft(userId);
      const responses = body.icebreakerResponses || normalizeAnswers(body.answers);
      if (!isIcebreakerResponses(responses)) {
        sendJson(res, 400, {
          ok: false,
          error:
            "At least 3 icebreaker responses are required. Each response needs questionId and answer.",
        });
        return;
      }
      draft.icebreakerResponses = responses;
      await persistStoreToDisk();
      sendJson(res, 200, { ok: true, userId, questionCount: responses.length });
      return;
    }

    if (req.method === "POST" && path === "/api/onboarding/complete") {
      const body = await parseJsonBody(req);
      const userId = getUserId(req, body);
      if (!isNonEmptyString(userId)) {
        sendJson(res, 400, { ok: false, error: "Missing userId (or X-User-Id)." });
        return;
      }

      const draft = ensureDraft(userId);
      const offers = body.offers || body.whatIOffer || draft.profile?.offers;
      const seeks = body.seeks || body.whatISeek || draft.profile?.seeks;
      const responsesCandidates = [
        body.icebreakerResponses,
        normalizeAnswers(body.answers),
        draft.icebreakerResponses,
      ];
      const responses =
        responsesCandidates.find(
          (candidate) => Array.isArray(candidate) && candidate.length > 0
        ) || [];
      const consentAccepted = body.consentAccepted;
      const deleteAfter24h =
        typeof body.deleteAfter24h === "boolean"
          ? body.deleteAfter24h
          : typeof body.autoDeleteAfter24h === "boolean"
          ? body.autoDeleteAfter24h
          : true;

      const minOfferTags = organizerSettings.parameters.onboarding.requiredOfferTags || 1;
      const minSeekTags = organizerSettings.parameters.onboarding.requiredSeekTags || 1;
      if (!hasMinimumTags(offers, minOfferTags) || !hasMinimumTags(seeks, minSeekTags)) {
        sendJson(res, 400, {
          ok: false,
          error: `Onboarding requires at least ${minOfferTags} offer tag(s) and at least ${minSeekTags} seek tag(s).`,
        });
        return;
      }
      if (!isIcebreakerResponses(responses)) {
        sendJson(res, 400, {
          ok: false,
          error: "Onboarding requires at least 3 icebreaker responses.",
        });
        return;
      }
      if (consentAccepted !== true) {
        sendJson(res, 400, {
          ok: false,
          error: "Onboarding requires consentAccepted=true.",
        });
        return;
      }

      const profile = {
        id: userId,
        name:
          body.name || body.fullName || draft.profile?.name || "Anonymous Attendee",
        role: body.role || draft.profile?.role || "Attendee",
        company: body.company || draft.profile?.company || "Unknown",
        offers,
        seeks,
        consentAccepted: true,
        deleteAfter24h,
        icebreakerResponses: responses,
        whatsapp: body.whatsapp || draft.profile?.whatsapp,
      };
      store.profiles.set(userId, profile);
      await persistStoreToDisk();
      sendJson(res, 200, { ok: true, userId, profile });
      return;
    }

    if (req.method === "GET" && path === "/api/waves/current") {
      const userId = req.headers["x-user-id"] || url.searchParams.get("userId");
      if (!isNonEmptyString(userId) || !store.profiles.has(userId)) {
        sendJson(res, 400, {
          ok: false,
          error: "Known userId with completed onboarding is required.",
        });
        return;
      }
      const existing = store.wavesByEvent.get(EVENT_ID);
      if (existing) {
        sendJson(res, 200, existing);
        return;
      }
      const userProfile = store.profiles.get(userId);
      const wave = createWave(EVENT_ID, userProfile);
      store.wavesByEvent.set(EVENT_ID, wave);
      await persistStoreToDisk();
      sendJson(res, 200, wave);
      return;
    }

    if (req.method === "POST" && path === "/api/waves/trigger") {
      const userId = req.headers["x-user-id"] || url.searchParams.get("userId");
      if (!isNonEmptyString(userId) || !store.profiles.has(userId)) {
        sendJson(res, 400, {
          ok: false,
          error: "Known userId with completed onboarding is required.",
        });
        return;
      }
      const userProfile = store.profiles.get(userId);
      const wave = createWave(EVENT_ID, userProfile);
      store.wavesByEvent.set(EVENT_ID, wave);
      await persistStoreToDisk();
      sendJson(res, 200, wave);
      return;
    }

    if (req.method === "POST" && path === "/api/matches/action") {
      const body = await parseJsonBody(req);
      const userId = getUserId(req, body);
      if (!isNonEmptyString(userId) || !store.profiles.has(userId)) {
        sendJson(res, 400, {
          ok: false,
          error: "Known userId with completed onboarding is required.",
        });
        return;
      }
      if (!isNonEmptyString(body.waveId) || !isNonEmptyString(body.targetUserId)) {
        sendJson(res, 400, {
          ok: false,
          error: "Like/Pass requires waveId and targetUserId.",
        });
        return;
      }
      if (body.action !== "like" && body.action !== "pass") {
        sendJson(res, 400, { ok: false, error: "action must be like or pass." });
        return;
      }

      const key = `${userId}::${body.targetUserId}`;
      store.actions.set(key, {
        waveId: body.waveId,
        targetUserId: body.targetUserId,
        action: body.action,
        actedAt: new Date().toISOString(),
      });
      await persistStoreToDisk();

      const isMutual = body.action === "like" && body.targetUserId === "u2";
      const mutualMatch = {
        userId,
        targetUserId: body.targetUserId,
        isMutual,
        revealStatus: isMutual ? "unlocked" : "locked",
        revealedChannels: isMutual ? ["whatsapp"] : [],
      };

      sendJson(res, 200, {
        ok: true,
        likeAction: {
          waveId: body.waveId,
          targetUserId: body.targetUserId,
          action: body.action,
        },
        mutualMatch,
      });
      return;
    }

    sendJson(res, 404, { ok: false, error: "Route not found." });
  } catch (error) {
    sendJson(res, 500, {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown server error.",
    });
  }
};

const server = http.createServer(route);

loadStoreFromDisk()
  .then(() => loadOrganizerSettingsFromDisk())
  .then(() => loadRouteCatalogFromDisk())
  .then(() => {
    server.listen(PORT, HOST, () => {
      process.stdout.write(
        `[apps/api] listening on http://${HOST}:${PORT} (demoMode=${DEMO_MODE_ENABLED})\n`
      );
    });
  })
  .catch((error) => {
    process.stderr.write(
      `[apps/api] failed to initialize persistent store: ${
        error instanceof Error ? error.message : "Unknown error"
      }\n`
    );
    process.exit(1);
  });
