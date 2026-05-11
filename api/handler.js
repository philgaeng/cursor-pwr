const { randomUUID } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const DEMO_MODE_ENABLED = process.env.DEMO_MODE_ENABLED !== "false";
const EVENT_ID = "demo-event-2026";

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

if (!globalThis.__organizerSettings) {
  globalThis.__organizerSettings = buildDefaultOrganizerSettings();
}

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
  return null;
};

const getRouteCatalog = () => {
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

const getUserId = (req, body) =>
  req.headers["x-user-id"] || body.userId || body.id || null;

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

    if (req.method === "GET" && path === "/organizer/settings") {
      sendJson(res, 200, {
        ok: true,
        eventId: EVENT_ID,
        settings: globalThis.__organizerSettings,
      });
      return;
    }

    if (req.method === "POST" && path === "/organizer/settings") {
      const incomingSettings =
        body && typeof body === "object" && body.settings ? body.settings : body;
      const nextSettings = mergeObjects(globalThis.__organizerSettings, incomingSettings);
      const validationError = validateOrganizerSettings(nextSettings);
      if (validationError) {
        sendJson(res, 400, { ok: false, error: validationError });
        return;
      }
      globalThis.__organizerSettings = nextSettings;
      sendJson(res, 200, { ok: true, eventId: EVENT_ID, settings: globalThis.__organizerSettings });
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

    sendJson(res, 404, { ok: false, error: "Route not found." });
  } catch (error) {
    sendJson(res, 500, {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown server error.",
    });
  }
};
