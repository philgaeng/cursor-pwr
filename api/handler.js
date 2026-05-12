const { randomUUID } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const organizerAuth = require("./organizer-auth-store");

const DEMO_MODE_ENABLED = process.env.DEMO_MODE_ENABLED !== "false";
const EVENT_ID = "demo-event-2026";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";

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

if (!globalThis.__nexusStore) {
  globalThis.__nexusStore = {
    sessions: new Map(),
    profiles: new Map(),
    onboardingDrafts: new Map(),
    actions: new Map(),
    wavesByEvent: new Map(),
    meetupPreferences: new Map(),
  };
}

const store = globalThis.__nexusStore;

const buildDefaultOrganizerSettings = () => ({
  organizer: {
    creds: {
      email: "organizer@example.com",
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
    /** Route catalog LLM (spec 11 reads this; until then server env / deterministic fallback). */
    llm: {
      provider: "none",
      apiKeys: {
        openai: "",
        anthropic: "",
        gemini: "",
        deepseek: "",
      },
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
    generationStyleNotes: "",
  },
  physicalMeetup: {
    enabled: true,
    spaces: ["Main Hall North", "Coffee Bar", "Side Lounge"],
    signs: {
      enabled: true,
      options: ["Red flag", "Blue flag", "Yellow flag"],
    },
    wearablePrompt: "What are you wearing so your match can spot you quickly?",
  },
  /** Published override served by GET /routes/catalog when valid. Null = use bundled JSON file. */
  icebreakerRoutes: null,
  /** Last generation result (staging); replaced on each generate. Not served to attendees until published. */
  icebreakerRoutesDraft: null,
  /** Single previous published catalog for rollback (spec 09). */
  icebreakerRoutesHistory: [],
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
        minMatchFloorStrategy: "distribution_floor_lowest_second_highest_score",
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

organizerAuth.loadOrganizerStoreFromDisk(buildDefaultOrganizerSettings);
organizerAuth.getDefaultPublicOrganizerProjection(buildDefaultOrganizerSettings, (projection) => {
  globalThis.__organizerSettings = projection;
});

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

const isEmail = (value) =>
  typeof value === "string" && value.trim().length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

const validateTier3Branch = (branch) => {
  if (!Array.isArray(branch) || branch.length !== 2) return false;
  return branch.every(
    (q) =>
      q &&
      typeof q === "object" &&
      isNonEmptyString(q.prompt) &&
      Array.isArray(q.options) &&
      q.options.length === 2 &&
      q.options.every((o) => isNonEmptyString(o))
  );
};

const validateIcebreakerRoutesCatalog = (catalog) => {
  if (catalog === null || catalog === undefined) return null;
  if (typeof catalog !== "object") {
    return "icebreakerRoutes must be an object or null.";
  }
  if (!Array.isArray(catalog.routes) || catalog.routes.length < 1) {
    return "icebreakerRoutes.routes must be a non-empty array.";
  }
  for (let r = 0; r < catalog.routes.length; r += 1) {
    const route = catalog.routes[r];
    if (!route || typeof route !== "object") {
      return `icebreakerRoutes.routes[${r}] must be an object.`;
    }
    if (!isNonEmptyString(route.routeId) || !isNonEmptyString(route.title) || !isNonEmptyString(route.tier1Prompt)) {
      return `icebreakerRoutes.routes[${r}] requires routeId, title, and tier1Prompt.`;
    }
    if (!Array.isArray(route.tier1Options) || route.tier1Options.length !== 4) {
      return `icebreakerRoutes.routes[${r}] must have exactly 4 tier1Options.`;
    }
    for (let t = 0; t < route.tier1Options.length; t += 1) {
      const opt = route.tier1Options[t];
      if (!opt || typeof opt !== "object") {
        return `icebreakerRoutes.routes[${r}].tier1Options[${t}] invalid.`;
      }
      if (!isNonEmptyString(opt.code) || !isNonEmptyString(opt.label) || !isNonEmptyString(opt.tier2Prompt)) {
        return `icebreakerRoutes.routes[${r}].tier1Options[${t}] requires code, label, tier2Prompt.`;
      }
      if (!Array.isArray(opt.tier2Options) || opt.tier2Options.length !== 2) {
        return `icebreakerRoutes.routes[${r}].tier1Options[${t}] must have exactly 2 tier2Options.`;
      }
      if (opt.tier3Mode !== "branch_specific_dual") {
        return `icebreakerRoutes.routes[${r}].tier1Options[${t}] must use tier3Mode branch_specific_dual.`;
      }
      const map = opt.tier3ByTier2;
      if (!map || typeof map !== "object") {
        return `icebreakerRoutes.routes[${r}].tier1Options[${t}] requires tier3ByTier2.`;
      }
      const [a, b] = opt.tier2Options.map((x) => String(x));
      if (!validateTier3Branch(map[a]) || !validateTier3Branch(map[b])) {
        return `icebreakerRoutes.routes[${r}].tier1Options[${t}] tier3ByTier2 must match tier2Options with two dual questions each.`;
      }
    }
  }
  return null;
};

const getPublishedOrganizerRouteCatalog = () => {
  const cat = globalThis.__organizerSettings?.icebreakerRoutes;
  if (!cat || typeof cat !== "object") return null;
  return validateIcebreakerRoutesCatalog(cat) === null ? cat : null;
};

const validateOrganizerSettings = (settings) => {
  if (!settings || typeof settings !== "object") {
    return "settings payload must be an object.";
  }

  if (!isEmail(settings.organizer?.creds?.email)) {
    return "organizer.creds.email must be a valid email.";
  }
  if (!(typeof settings.eventInfo?.name === "string" && settings.eventInfo.name.trim().length > 0)) {
    return "eventInfo.name is required.";
  }
  if (
    !Array.isArray(settings.questionRoutes?.suggestions) ||
    settings.questionRoutes.suggestions.length !== 8 ||
    !settings.questionRoutes.suggestions.every((entry) => typeof entry === "string" && entry.trim().length > 0)
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
  const meetup = settings.physicalMeetup || {};
  if (!Array.isArray(meetup.spaces) || meetup.spaces.length < 1) {
    return "physicalMeetup.spaces must include at least one space.";
  }
  if (!meetup.spaces.every((entry) => typeof entry === "string" && entry.trim().length > 0)) {
    return "physicalMeetup.spaces must contain non-empty strings.";
  }
  if (meetup.signs?.enabled) {
    if (!Array.isArray(meetup.signs.options) || meetup.signs.options.length < 1) {
      return "physicalMeetup.signs.options must include at least one sign when signs are enabled.";
    }
    if (!meetup.signs.options.every((entry) => typeof entry === "string" && entry.trim().length > 0)) {
      return "physicalMeetup.signs.options must contain non-empty strings when signs are enabled.";
    }
  }
  const routeErr = validateIcebreakerRoutesCatalog(settings.icebreakerRoutes);
  if (routeErr) {
    return routeErr;
  }
  if (
    settings.icebreakerRoutesHistory != null &&
    (!Array.isArray(settings.icebreakerRoutesHistory) || settings.icebreakerRoutesHistory.length > 1)
  ) {
    return "icebreakerRoutesHistory must be an array with at most one rollback entry.";
  }
  return null;
};

const getRouteCatalog = () => {
  const published = getPublishedOrganizerRouteCatalog();
  if (published) {
    return published;
  }
  if (globalThis.__routeCatalog) {
    return globalThis.__routeCatalog;
  }
  const candidates = [
    path.join(__dirname, "icebreaker-routes.v1.json"),
    path.join(__dirname, "..", "docs", "resource", "icebreaker-routes.v1.json"),
    path.join(process.cwd(), "docs", "resource", "icebreaker-routes.v1.json"),
  ];
  for (const filePath of candidates) {
    try {
      if (!fs.existsSync(filePath)) {
        continue;
      }
      const raw = fs.readFileSync(filePath, "utf8");
      globalThis.__routeCatalog = JSON.parse(raw);
      return globalThis.__routeCatalog;
    } catch (_error) {
      continue;
    }
  }
  return null;
};

const sendJson = (res, statusCode, payload) => {
  res.status(statusCode).json(payload);
};

const isNonEmptyString = (value) =>
  typeof value === "string" && value.trim().length > 0;

const hasMinimumTags = (value, min) =>
  Array.isArray(value) &&
  value.filter((item) => isNonEmptyString(item)).length >= min;

const getRequiredTagMinimums = () => {
  const onb = globalThis.__organizerSettings?.parameters?.onboarding || {};
  const offers = isPositiveInteger(onb.requiredOfferTags) ? onb.requiredOfferTags : 1;
  const seeks = isPositiveInteger(onb.requiredSeekTags) ? onb.requiredSeekTags : 1;
  return { offers, seeks };
};

const parseLinkedInPublicUrl = (rawUrl) => {
  if (!isNonEmptyString(rawUrl)) return null;
  let urlObj;
  try {
    urlObj = new URL(rawUrl.trim());
  } catch (_error) {
    return null;
  }
  const host = String(urlObj.hostname || "").toLowerCase();
  if (!host.includes("linkedin.com")) return null;
  const parts = String(urlObj.pathname || "")
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < 2 || parts[0] !== "in") return null;
  const handle = parts[1];
  if (!handle) return null;
  const fullName = handle
    .split(/[-_]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
  return {
    linkedinUrl: `https://www.linkedin.com/in/${handle}/`,
    fullName,
    role: "",
    company: "",
  };
};

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

const toRouteId = (value, fallbackIndex) => {
  const base = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (base) return base;
  return `route_${fallbackIndex + 1}`;
};

const titleCase = (value) =>
  String(value || "")
    .trim()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

const buildDeterministicRoute = (topic, index) => {
  const routeId = toRouteId(topic, index);
  const title = titleCase(topic) || `Route ${index + 1}`;
  const makeTier1 = (n) => {
    const code = `${routeId}_option_${n}`;
    const a = `${routeId}_a${n}`;
    const b = `${routeId}_b${n}`;
    return {
      code,
      label: `${title} ${n}`,
      tier2Prompt: `Choose one style for ${title.toLowerCase()}:`,
      tier2Options: [a, b],
      tier3Mode: "branch_specific_dual",
      tier3ByTier2: {
        [a]: [
          { prompt: "Pick one:", options: [`${routeId}_x${n}`, `${routeId}_y${n}`] },
          { prompt: "Pick one:", options: [`${routeId}_m${n}`, `${routeId}_n${n}`] },
        ],
        [b]: [
          { prompt: "Pick one:", options: [`${routeId}_p${n}`, `${routeId}_q${n}`] },
          { prompt: "Pick one:", options: [`${routeId}_u${n}`, `${routeId}_v${n}`] },
        ],
      },
      freeTextPromptOverride: `Optional: your favorite ${title.toLowerCase()} example`,
    };
  };
  return {
    routeId,
    title,
    tier1Prompt: `Which ${title.toLowerCase()} topic fits you best?`,
    tier1Options: [makeTier1(1), makeTier1(2), makeTier1(3), makeTier1(4)],
    freeTextPrompt: `Optional: one ${title.toLowerCase()} detail you enjoy sharing`,
  };
};

const buildDeterministicCatalog = (selectedTopics) => ({
  version: "v1",
  language: "en",
  routesPerParticipant: 3,
  freeTextDefault: {
    enabled: true,
    label: "Optional: share one specific example",
  },
  routes: selectedTopics.map((topic, index) => buildDeterministicRoute(topic, index)),
});

const tryGenerateCatalogWithOpenAI = async ({
  selectedTopics,
  crowdCues,
  eventDescription,
  generationStyleNotes,
}) => {
  if (!OPENAI_API_KEY) return null;
  const prompt = `Generate a strict JSON object for an icebreaker route catalog.
Output must be valid JSON only. Do not wrap in markdown.
Schema top-level:
{
  "version":"v1",
  "language":"en",
  "routesPerParticipant":3,
  "freeTextDefault":{"enabled":true,"label":"Optional: share one specific example"},
  "routes":[ ... ]
}
Each route must include:
routeId, title, tier1Prompt, tier1Options (exactly 4), freeTextPrompt.
Each tier1Option must include:
code, label, tier2Prompt, tier2Options (exactly 2), tier3Mode="branch_specific_dual", tier3ByTier2 with two keys matching tier2 options and each key has exactly two questions each with exactly two options, freeTextPromptOverride.
Use snake_case codes for routeId, tier1 option codes, tier2 option codes, and tier3 option codes.

Context from organizer (follow closely):
- Selected route topics (one JSON object per topic, in order): ${JSON.stringify(selectedTopics)}
- Event description: ${String(eventDescription || "")}
- Crowd cues (free text — may include audience, tone, boundaries, off-limits, examples; treat all of it as authoritative guidance): ${String(crowdCues || "")}
- Additional generation style notes (optional free text): ${String(generationStyleNotes || "")}

Respect audience and tone from crowd cues. Avoid topics or wording that violate stated boundaries. Keep prompts short and event-appropriate.`;

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: prompt,
      }),
    });
    if (!response.ok) return null;
    const payload = await response.json();
    const outputText = payload?.output_text;
    if (!outputText || typeof outputText !== "string") return null;
    const parsed = JSON.parse(outputText);
    if (!parsed || !Array.isArray(parsed.routes)) return null;
    return parsed;
  } catch (_error) {
    return null;
  }
};

/**
 * Vercel Node serverless often leaves `req.body` unset; the JSON payload must be read from the stream.
 */
const readJsonBody = async (req) => {
  const method = req.method || "GET";
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return {};
  }
  const raw = req.body;
  if (raw !== undefined && raw !== null) {
    if (typeof raw === "string") {
      try {
        const t = raw.trim();
        return t ? JSON.parse(t) : {};
      } catch (_e) {
        return {};
      }
    }
    if (Buffer.isBuffer(raw)) {
      try {
        const t = raw.toString("utf8").trim();
        return t ? JSON.parse(t) : {};
      } catch (_e) {
        return {};
      }
    }
    if (typeof raw === "object") {
      return raw;
    }
  }
  try {
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), "utf8"));
    }
    const text = Buffer.concat(chunks).toString("utf8").trim();
    return text ? JSON.parse(text) : {};
  } catch (_e) {
    return {};
  }
};

const getOrganizerBearerToken = (req, body) => {
  const auth = req.headers.authorization || req.headers.Authorization;
  if (isNonEmptyString(auth) && String(auth).toLowerCase().startsWith("bearer ")) {
    return String(auth).slice(7).trim();
  }
  if (body && isNonEmptyString(body.organizerSessionToken)) {
    return String(body.organizerSessionToken).trim();
  }
  return null;
};

const requireOrganizerSession = (req, body) => {
  const token = getOrganizerBearerToken(req, body);
  const organizer = organizerAuth.getOrganizerForSession(token);
  if (!organizer) return null;
  return { token, organizer, organizerKey: organizer.key };
};

const persistOrganizerGlobalSettings = (organizerKey) => {
  organizerAuth.applyFullActiveEventSettings(organizerKey, globalThis.__organizerSettings);
};

const getUserId = (req, body) =>
  req.headers["x-user-id"] || body.userId || body.id || null;

const stableHash = (value) => {
  const input = String(value || "");
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const getMeetupConfig = () => globalThis.__organizerSettings?.physicalMeetup || {};

const normalizedPairKey = (left, right) => [String(left || ""), String(right || "")].sort().join("::");

const buildPairMeetupPlan = (userId, targetUserId) => {
  const meetupConfig = getMeetupConfig();
  const spaces = Array.isArray(meetupConfig.spaces)
    ? meetupConfig.spaces.filter((entry) => typeof entry === "string" && entry.trim().length > 0)
    : [];
  const signs = Array.isArray(meetupConfig.signs?.options)
    ? meetupConfig.signs.options.filter((entry) => typeof entry === "string" && entry.trim().length > 0)
    : [];
  const signsEnabled = Boolean(meetupConfig.signs?.enabled) && signs.length > 0;
  const pairKey = normalizedPairKey(userId, targetUserId);
  const hash = stableHash(pairKey);
  const space = spaces.length > 0 ? spaces[hash % spaces.length].trim() : "Main Hall";
  const sign = signsEnabled ? signs[hash % signs.length].trim() : null;
  const requiresWearableMarker = !signsEnabled;
  return {
    pairKey,
    space,
    sign,
    signsEnabled,
    requiresWearableMarker,
    wearablePrompt:
      typeof meetupConfig.wearablePrompt === "string" && meetupConfig.wearablePrompt.trim().length > 0
        ? meetupConfig.wearablePrompt.trim()
        : "What are you wearing so your match can spot you quickly?",
  };
};

const ensureDraft = (userId) => {
  const current = store.onboardingDrafts.get(userId) || {};
  store.onboardingDrafts.set(userId, current);
  return current;
};

const buildMockCandidates = () => [
  {
    candidateUserId: "u2",
    id: "u2",
    name: "Elena Park",
    role: "Investor",
    company: "Green VC",
    compatibilityScore: 0.93,
    compatibilityReasons: [
      "Founder-investor intent alignment",
      "Mutual interest in climate pilots",
      "Complementary network goals",
    ],
    reasons: [
      "Founder-investor intent alignment",
      "Mutual interest in climate pilots",
      "Complementary network goals",
    ],
    revealStatus: "locked",
    whatsapp: "+65 8111 1111",
  },
  {
    candidateUserId: "u3",
    id: "u3",
    name: "Daniel Ng",
    role: "Frontend Engineer",
    company: "Flow Apps",
    compatibilityScore: 0.86,
    compatibilityReasons: [
      "Product collaboration overlap",
      "Shared hiring needs",
      "High execution-focused profile fit",
    ],
    reasons: [
      "Product collaboration overlap",
      "Shared hiring needs",
      "High execution-focused profile fit",
    ],
    revealStatus: "locked",
    whatsapp: "+65 8222 2222",
  },
  {
    candidateUserId: "u4",
    id: "u4",
    name: "Sophia Tan",
    role: "Operator",
    company: "Scale Studio",
    compatibilityScore: 0.82,
    compatibilityReasons: [
      "B2B SaaS growth complementarity",
      "Operational scaling expertise match",
      "Aligned near-term partnership goals",
    ],
    reasons: [
      "B2B SaaS growth complementarity",
      "Operational scaling expertise match",
      "Aligned near-term partnership goals",
    ],
    revealStatus: "locked",
    whatsapp: "+65 8333 3333",
  },
];

const createWave = (eventId) => ({
  waveId: `wave-${Date.now()}`,
  eventId,
  createdAt: new Date().toISOString(),
  candidates: buildMockCandidates(),
});

const resolveHandlerPath = (req) => {
  if (Object.prototype.hasOwnProperty.call(req.query || {}, "path")) {
    const pathParam = req.query.path;
    const raw = Array.isArray(pathParam) ? pathParam.join("/") : String(pathParam ?? "");
    const trimmed = raw.trim();
    return trimmed.length > 0 ? (trimmed.startsWith("/") ? trimmed : `/${trimmed}`) : "/";
  }

  const rawUrl = typeof req.url === "string" ? req.url : "";
  const pathname = rawUrl.split("?")[0] || "/";

  if (pathname.startsWith("/api/")) {
    const rest = pathname.slice("/api".length);
    return rest.length ? (rest.startsWith("/") ? rest : `/${rest}`) : "/";
  }
  if (pathname === "/api") {
    return "/";
  }

  const routeParts = Array.isArray(req.query.route)
    ? req.query.route
    : req.query.route
      ? [req.query.route]
      : [];
  if (routeParts.length) {
    const joined = routeParts.join("/");
    return joined.startsWith("/") ? joined : `/${joined}`;
  }

  if (pathname.startsWith("/")) {
    return pathname;
  }
  return `/${pathname}`;
};

module.exports = async (req, res) => {
  const path = resolveHandlerPath(req);

  try {
    let body = {};
    if (req.method !== "GET" && req.method !== "HEAD" && req.method !== "OPTIONS") {
      body = await readJsonBody(req);
    }
    if (req.method === "GET" && path === "/health") {
      sendJson(res, 200, { ok: true, service: "api", mode: "vercel" });
      return;
    }

    if (req.method === "GET" && path === "/tags/catalog") {
      sendJson(res, 200, { ok: true, eventId: EVENT_ID, tags: GLOBAL_TAG_CATALOG });
      return;
    }

    if (req.method === "POST" && path === "/profile/enrich-linkedin") {
      const parsed = parseLinkedInPublicUrl(body.linkedinUrl);
      if (!parsed) {
        sendJson(res, 400, {
          ok: false,
          error:
            "Please provide a valid public LinkedIn URL (for example: https://www.linkedin.com/in/your-handle/).",
        });
        return;
      }
      sendJson(res, 200, {
        ok: true,
        source: "linkedin_url",
        prefill: parsed,
        note: "MVP uses URL parsing only. Please review and edit all profile fields.",
      });
      return;
    }

    if (req.method === "GET" && path === "/routes/catalog") {
      const catalog = getRouteCatalog();
      if (!catalog) {
        sendJson(res, 500, { ok: false, error: "Route catalog is unavailable." });
        return;
      }
      sendJson(res, 200, catalog);
      return;
    }

    if (req.method === "POST" && path === "/organizer/signup") {
      const created = organizerAuth.createOrganizer(body?.name, body?.email, body?.password, buildDefaultOrganizerSettings);
      if (!created.ok) {
        sendJson(res, 400, { ok: false, error: created.error });
        return;
      }
      sendJson(res, 200, {
        ok: true,
        organizerKey: created.organizer.key,
        email: created.organizer.details.email,
        diskWriteOk: organizerAuth.diskWriteSucceeded(),
      });
      return;
    }

    if (req.method === "POST" && path === "/organizer/login") {
      const logged = organizerAuth.loginOrganizer(body?.email, body?.password);
      if (!logged.ok) {
        sendJson(res, 401, { ok: false, error: logged.error });
        return;
      }
      organizerAuth.syncGlobalOrganizerSettingsFromEvent(logged.organizer.key, logged.organizer.lastActiveEventKey, (projection) => {
        globalThis.__organizerSettings = projection;
      });
      sendJson(res, 200, {
        ok: true,
        token: logged.token,
        organizerKey: logged.organizer.key,
        details: { name: logged.organizer.details.name, email: logged.organizer.details.email },
        activeEventKey: logged.organizer.lastActiveEventKey,
        diskWriteOk: organizerAuth.diskWriteSucceeded(),
      });
      return;
    }

    if (req.method === "POST" && path === "/organizer/logout") {
      const token = getOrganizerBearerToken(req, body);
      organizerAuth.revokeOrganizerSession(token);
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === "GET" && path === "/organizer/me") {
      const sess = requireOrganizerSession(req, body);
      if (!sess) {
        sendJson(res, 401, { ok: false, error: "Organizer session required." });
        return;
      }
      organizerAuth.syncGlobalOrganizerSettingsFromEvent(sess.organizerKey, sess.organizer.lastActiveEventKey, (projection) => {
        globalThis.__organizerSettings = projection;
      });
      sendJson(res, 200, {
        ok: true,
        organizerKey: sess.organizerKey,
        details: sess.organizer.details,
        activeEventKey: sess.organizer.lastActiveEventKey,
        events: organizerAuth.listEvents(sess.organizerKey),
        diskWriteOk: organizerAuth.diskWriteSucceeded(),
      });
      return;
    }

    if (req.method === "GET" && path === "/organizer/events") {
      const sess = requireOrganizerSession(req, body);
      if (!sess) {
        sendJson(res, 401, { ok: false, error: "Organizer session required." });
        return;
      }
      sendJson(res, 200, {
        ok: true,
        activeEventKey: sess.organizer.lastActiveEventKey,
        events: organizerAuth.listEvents(sess.organizerKey),
      });
      return;
    }

    if (req.method === "POST" && path === "/organizer/events") {
      const sess = requireOrganizerSession(req, body);
      if (!sess) {
        sendJson(res, 401, { ok: false, error: "Organizer session required." });
        return;
      }
      const name = isNonEmptyString(body?.name) ? body.name.trim() : "New event";
      const created = organizerAuth.createEvent(sess.organizerKey, name, buildDefaultOrganizerSettings);
      if (!created.ok) {
        sendJson(res, 400, { ok: false, error: created.error });
        return;
      }
      organizerAuth.syncGlobalOrganizerSettingsFromEvent(sess.organizerKey, created.eventKey, (projection) => {
        globalThis.__organizerSettings = projection;
      });
      sendJson(res, 200, {
        ok: true,
        activeEventKey: created.eventKey,
        settings: globalThis.__organizerSettings,
        events: organizerAuth.listEvents(sess.organizerKey),
        diskWriteOk: organizerAuth.diskWriteSucceeded(),
      });
      return;
    }

    if (req.method === "POST" && path === "/organizer/events/select") {
      const sess = requireOrganizerSession(req, body);
      if (!sess) {
        sendJson(res, 401, { ok: false, error: "Organizer session required." });
        return;
      }
      const eventKey = body?.eventKey;
      if (!isNonEmptyString(eventKey)) {
        sendJson(res, 400, { ok: false, error: "eventKey is required." });
        return;
      }
      const sel = organizerAuth.setLastActiveEvent(sess.organizerKey, eventKey.trim());
      if (!sel.ok) {
        sendJson(res, 400, { ok: false, error: sel.error });
        return;
      }
      organizerAuth.syncGlobalOrganizerSettingsFromEvent(sess.organizerKey, eventKey.trim(), (projection) => {
        globalThis.__organizerSettings = projection;
      });
      sendJson(res, 200, {
        ok: true,
        activeEventKey: eventKey.trim(),
        settings: globalThis.__organizerSettings,
        events: organizerAuth.listEvents(sess.organizerKey),
        diskWriteOk: organizerAuth.diskWriteSucceeded(),
      });
      return;
    }

    if (req.method === "POST" && path === "/organizer/events/clone") {
      const sess = requireOrganizerSession(req, body);
      if (!sess) {
        sendJson(res, 401, { ok: false, error: "Organizer session required." });
        return;
      }
      const fromEventKey = isNonEmptyString(body?.fromEventKey) ? body.fromEventKey.trim() : sess.organizer.lastActiveEventKey;
      const cloned = organizerAuth.cloneEvent(sess.organizerKey, fromEventKey, buildDefaultOrganizerSettings);
      if (!cloned.ok) {
        sendJson(res, 400, { ok: false, error: cloned.error });
        return;
      }
      organizerAuth.syncGlobalOrganizerSettingsFromEvent(sess.organizerKey, cloned.eventKey, (projection) => {
        globalThis.__organizerSettings = projection;
      });
      sendJson(res, 200, {
        ok: true,
        activeEventKey: cloned.eventKey,
        settings: globalThis.__organizerSettings,
        events: organizerAuth.listEvents(sess.organizerKey),
        diskWriteOk: organizerAuth.diskWriteSucceeded(),
      });
      return;
    }

    if (req.method === "GET" && path === "/organizer/settings") {
      const sess = requireOrganizerSession(req, body);
      if (!sess) {
        sendJson(res, 401, { ok: false, error: "Organizer session required." });
        return;
      }
      organizerAuth.syncGlobalOrganizerSettingsFromEvent(sess.organizerKey, sess.organizer.lastActiveEventKey, (projection) => {
        globalThis.__organizerSettings = projection;
      });
      sendJson(res, 200, {
        ok: true,
        eventId: globalThis.__organizerSettings?.eventInfo?.id || EVENT_ID,
        organizerKey: sess.organizerKey,
        activeEventKey: sess.organizer.lastActiveEventKey,
        events: organizerAuth.listEvents(sess.organizerKey),
        settings: globalThis.__organizerSettings,
        diskWriteOk: organizerAuth.diskWriteSucceeded(),
      });
      return;
    }

    if (req.method === "POST" && path === "/organizer/settings") {
      const sess = requireOrganizerSession(req, body);
      if (!sess) {
        sendJson(res, 401, { ok: false, error: "Organizer session required." });
        return;
      }
      const incomingSettings =
        body && typeof body === "object" && body.settings ? body.settings : body;
      const prevPublished = getPublishedOrganizerRouteCatalog();
      const nextSettings = mergeObjects(globalThis.__organizerSettings, incomingSettings);
      if (Object.prototype.hasOwnProperty.call(incomingSettings, "icebreakerRoutes")) {
        const nextCat = nextSettings.icebreakerRoutes;
        const nextValid =
          nextCat &&
          typeof nextCat === "object" &&
          validateIcebreakerRoutesCatalog(nextCat) === null;
        if (prevPublished && nextValid && JSON.stringify(prevPublished) !== JSON.stringify(nextCat)) {
          nextSettings.icebreakerRoutesHistory = [
            { catalog: prevPublished, savedAtIso: new Date().toISOString() },
          ];
        }
        if (nextCat === null || nextCat === undefined) {
          nextSettings.icebreakerRoutesHistory = [];
        }
      }
      const validationError = validateOrganizerSettings(nextSettings);
      if (validationError) {
        sendJson(res, 400, { ok: false, error: validationError });
        return;
      }
      globalThis.__organizerSettings = nextSettings;
      persistOrganizerGlobalSettings(sess.organizerKey);
      globalThis.__routeCatalog = undefined;
      sendJson(res, 200, {
        ok: true,
        eventId: globalThis.__organizerSettings?.eventInfo?.id || EVENT_ID,
        organizerKey: sess.organizerKey,
        activeEventKey: sess.organizer.lastActiveEventKey,
        events: organizerAuth.listEvents(sess.organizerKey),
        settings: globalThis.__organizerSettings,
        diskWriteOk: organizerAuth.diskWriteSucceeded(),
      });
      return;
    }

    if (req.method === "POST" && path === "/organizer/routes/publish") {
      const sess = requireOrganizerSession(req, body);
      if (!sess) {
        sendJson(res, 401, { ok: false, error: "Organizer session required." });
        return;
      }
      const catalog =
        body && typeof body === "object" && body.catalog
          ? body.catalog
          : globalThis.__organizerSettings?.icebreakerRoutesDraft?.catalog;
      const validationErr = validateIcebreakerRoutesCatalog(catalog);
      if (validationErr) {
        sendJson(res, 400, { ok: false, error: validationErr });
        return;
      }
      const prev = getPublishedOrganizerRouteCatalog();
      const history = [];
      if (prev) {
        history.push({
          catalog: prev,
          savedAtIso: new Date().toISOString(),
        });
      }
      globalThis.__organizerSettings.icebreakerRoutes = catalog;
      globalThis.__organizerSettings.icebreakerRoutesHistory = history;
      globalThis.__organizerSettings.icebreakerRoutesDraft = null;
      globalThis.__routeCatalog = undefined;
      const settingsErr = validateOrganizerSettings(globalThis.__organizerSettings);
      if (settingsErr) {
        sendJson(res, 500, { ok: false, error: settingsErr });
        return;
      }
      persistOrganizerGlobalSettings(sess.organizerKey);
      sendJson(res, 200, {
        ok: true,
        eventId: globalThis.__organizerSettings?.eventInfo?.id || EVENT_ID,
        organizerKey: sess.organizerKey,
        activeEventKey: sess.organizer.lastActiveEventKey,
        events: organizerAuth.listEvents(sess.organizerKey),
        settings: globalThis.__organizerSettings,
        diskWriteOk: organizerAuth.diskWriteSucceeded(),
      });
      return;
    }

    if (req.method === "POST" && path === "/organizer/routes/rollback") {
      const sess = requireOrganizerSession(req, body);
      if (!sess) {
        sendJson(res, 401, { ok: false, error: "Organizer session required." });
        return;
      }
      const hist = globalThis.__organizerSettings?.icebreakerRoutesHistory;
      const entry = Array.isArray(hist) && hist.length > 0 ? hist[0] : null;
      if (!entry || !entry.catalog) {
        sendJson(res, 400, { ok: false, error: "No published route history to roll back to." });
        return;
      }
      const rollbackErr = validateIcebreakerRoutesCatalog(entry.catalog);
      if (rollbackErr) {
        sendJson(res, 500, { ok: false, error: rollbackErr });
        return;
      }
      globalThis.__organizerSettings.icebreakerRoutes = entry.catalog;
      globalThis.__organizerSettings.icebreakerRoutesHistory = [];
      globalThis.__organizerSettings.icebreakerRoutesDraft = null;
      globalThis.__routeCatalog = undefined;
      persistOrganizerGlobalSettings(sess.organizerKey);
      sendJson(res, 200, {
        ok: true,
        eventId: globalThis.__organizerSettings?.eventInfo?.id || EVENT_ID,
        organizerKey: sess.organizerKey,
        activeEventKey: sess.organizer.lastActiveEventKey,
        events: organizerAuth.listEvents(sess.organizerKey),
        settings: globalThis.__organizerSettings,
        diskWriteOk: organizerAuth.diskWriteSucceeded(),
      });
      return;
    }

    if (req.method === "POST" && path === "/organizer/routes/generate") {
      const sess = requireOrganizerSession(req, body);
      if (!sess) {
        sendJson(res, 401, { ok: false, error: "Organizer session required." });
        return;
      }
      const selectedTopics = Array.isArray(body.selectedTopics)
        ? body.selectedTopics
            .map((entry) => String(entry || "").trim())
            .filter((entry) => entry.length > 0)
        : [];
      if (selectedTopics.length < 1) {
        sendJson(res, 400, {
          ok: false,
          error: "selectedTopics must include at least one route topic.",
        });
        return;
      }
      const generatedCatalog =
        (await tryGenerateCatalogWithOpenAI({
          selectedTopics,
          crowdCues: body.crowdCues,
          eventDescription: body.eventDescription,
          generationStyleNotes: body.generationStyleNotes,
        })) || buildDeterministicCatalog(selectedTopics);
      const draftErr = validateIcebreakerRoutesCatalog(generatedCatalog);
      globalThis.__organizerSettings.icebreakerRoutesDraft = {
        generatedAtIso: new Date().toISOString(),
        selectedTopics,
        catalog: generatedCatalog,
        validationWarning: draftErr || null,
      };
      persistOrganizerGlobalSettings(sess.organizerKey);
      sendJson(res, 200, {
        ok: true,
        source: OPENAI_API_KEY ? "openai_or_fallback" : "deterministic_fallback",
        selectedTopics,
        generatedCatalog,
        draftValidationWarning: draftErr,
        draftSaved: true,
        diskWriteOk: organizerAuth.diskWriteSucceeded(),
      });
      return;
    }

    if (req.method === "POST" && path === "/auth/session") {
      const provider = body && body.provider;
      if (provider !== "google" && provider !== "linkedin") {
        sendJson(res, 400, {
          ok: false,
          error:
            'JSON body must include "provider": "linkedin" or "google". If you see this from the web app, the request body was not parsed (check Content-Type: application/json).',
        });
        return;
      }
      /** MVP: stub session only — no LinkedIn/Google OAuth on this endpoint. Client collects real identity on the profile step. */
      const userId = body.userId || randomUUID();
      store.sessions.set(userId, {
        provider,
        demoMode: Boolean(body.demoMode),
        createdAt: new Date().toISOString(),
      });
      sendJson(res, 200, {
        ok: true,
        userId,
        provider,
        demoMode: Boolean(body.demoMode),
        profile: {
          name: "",
          email: "",
          picture: "",
        },
      });
      return;
    }

    if (req.method === "POST" && path === "/auth/manual-bootstrap") {
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

    if (req.method === "POST" && path === "/auth/demo-login") {
      if (!DEMO_MODE_ENABLED) {
        sendJson(res, 403, { ok: false, error: "Demo mode is disabled." });
        return;
      }
      const userId = body.userId || randomUUID();
      store.sessions.set(userId, {
        provider: "google",
        demoMode: true,
        createdAt: new Date().toISOString(),
      });
      sendJson(res, 200, {
        ok: true,
        userId,
        provider: "google",
        demoMode: true,
      });
      return;
    }

    if (req.method === "POST" && path === "/onboarding/profile") {
      const userId = getUserId(req, body);
      if (!isNonEmptyString(userId)) {
        sendJson(res, 400, { ok: false, error: "Missing userId (or X-User-Id)." });
        return;
      }
      const offers = body.offers || body.whatIOffer;
      const seeks = body.seeks || body.whatISeek;
      const { offers: minOffers, seeks: minSeeks } = getRequiredTagMinimums();
      if (!hasMinimumTags(offers, minOffers) || !hasMinimumTags(seeks, minSeeks)) {
        sendJson(res, 400, {
          ok: false,
          error: `Profile requires at least ${minOffers} offer tag(s) and at least ${minSeeks} seek tag(s).`,
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
        linkedinUrl: isNonEmptyString(body.linkedinUrl) ? body.linkedinUrl.trim() : undefined,
        name: body.name || body.fullName || "Anonymous Attendee",
        role: body.role.trim(),
        company: body.company.trim(),
        offers: offers.map((x) => x.trim()),
        seeks: seeks.map((x) => x.trim()),
        whatsapp: isNonEmptyString(body.whatsapp) ? body.whatsapp.trim() : undefined,
      };
      sendJson(res, 200, { ok: true, userId, profileSaved: true });
      return;
    }

    if (req.method === "POST" && path === "/onboarding/questions") {
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
      sendJson(res, 200, { ok: true, userId, questionCount: responses.length });
      return;
    }

    if (req.method === "POST" && path === "/onboarding/complete") {
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
      const { offers: minOffers, seeks: minSeeks } = getRequiredTagMinimums();
      if (!hasMinimumTags(offers, minOffers) || !hasMinimumTags(seeks, minSeeks)) {
        sendJson(res, 400, {
          ok: false,
          error: `Onboarding requires at least ${minOffers} offer tag(s) and at least ${minSeeks} seek tag(s).`,
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
        linkedinUrl: body.linkedinUrl || draft.profile?.linkedinUrl,
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
      sendJson(res, 200, { ok: true, userId, profile });
      return;
    }

    if (req.method === "GET" && path === "/waves/current") {
      const userId = req.headers["x-user-id"] || req.query.userId;
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
      const wave = createWave(EVENT_ID);
      store.wavesByEvent.set(EVENT_ID, wave);
      sendJson(res, 200, wave);
      return;
    }

    if (req.method === "POST" && path === "/waves/trigger") {
      const userId = req.headers["x-user-id"] || req.query.userId;
      if (!isNonEmptyString(userId) || !store.profiles.has(userId)) {
        sendJson(res, 400, {
          ok: false,
          error: "Known userId with completed onboarding is required.",
        });
        return;
      }
      const wave = createWave(EVENT_ID);
      store.wavesByEvent.set(EVENT_ID, wave);
      sendJson(res, 200, wave);
      return;
    }

    if (req.method === "POST" && path === "/matches/action") {
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

    if (req.method === "POST" && path === "/meetup/preferences") {
      const userId = getUserId(req, body);
      if (!isNonEmptyString(userId) || !store.profiles.has(userId)) {
        sendJson(res, 400, {
          ok: false,
          error: "Known userId with completed onboarding is required.",
        });
        return;
      }
      const wearableMarker = isNonEmptyString(body.wearableMarker) ? body.wearableMarker.trim() : "";
      if (!wearableMarker) {
        sendJson(res, 400, {
          ok: false,
          error: "wearableMarker is required.",
        });
        return;
      }
      store.meetupPreferences.set(userId, {
        wearableMarker,
        updatedAt: new Date().toISOString(),
      });
      sendJson(res, 200, {
        ok: true,
        userId,
        wearableMarker,
      });
      return;
    }

    if (req.method === "GET" && path === "/meetup/plan") {
      const userId = req.headers["x-user-id"] || req.query.userId;
      const targetUserId = req.query.targetUserId;
      if (!isNonEmptyString(userId) || !store.profiles.has(userId)) {
        sendJson(res, 400, {
          ok: false,
          error: "Known userId with completed onboarding is required.",
        });
        return;
      }
      if (!isNonEmptyString(targetUserId)) {
        sendJson(res, 400, {
          ok: false,
          error: "targetUserId is required.",
        });
        return;
      }
      const plan = buildPairMeetupPlan(userId, targetUserId);
      const selfPreference = store.meetupPreferences.get(userId) || null;
      sendJson(res, 200, {
        ok: true,
        targetUserId,
        meetup: {
          pairKey: plan.pairKey,
          space: plan.space,
          sign: plan.sign,
          requiresWearableMarker: plan.requiresWearableMarker,
          wearablePrompt: plan.wearablePrompt,
          yourWearableMarker: selfPreference?.wearableMarker || "",
          instructionsForUser: plan.sign
            ? `Meet at ${plan.space}. Look for the ${plan.sign}.`
            : `Meet at ${plan.space}. Share what you are wearing so your match can spot you.`,
        },
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
