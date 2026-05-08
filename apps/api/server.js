const http = require("node:http");
const { randomUUID } = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");

const HOST = process.env.API_HOST || "127.0.0.1";
const PORT = Number(process.env.API_PORT || 8787);
const DEMO_MODE_ENABLED = process.env.DEMO_MODE_ENABLED !== "false";

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

const store = {
  sessions: new Map(),
  profiles: new Map(),
  onboardingDrafts: new Map(),
  actions: new Map(),
  wavesByEvent: new Map(),
};

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

const isTripleTags = (value) =>
  Array.isArray(value) &&
  value.length === 3 &&
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

    if (req.method === "POST" && path === "/api/auth/session") {
      const body = await parseJsonBody(req);
      const provider = body.provider;
      if (provider !== "google" && provider !== "linkedin") {
        sendJson(res, 400, { ok: false, error: "provider must be google or linkedin" });
        return;
      }
      if (provider === "linkedin" && !body.demoMode) {
        sendJson(res, 400, {
          ok: false,
          error: "LinkedIn is not enabled in MVP runtime. Use google or demo mode.",
        });
        return;
      }
      const userId = body.userId || randomUUID();
      store.sessions.set(userId, {
        provider,
        demoMode: Boolean(body.demoMode),
        createdAt: new Date().toISOString(),
      });
      await persistStoreToDisk();
      sendJson(res, 200, { ok: true, userId, provider, demoMode: Boolean(body.demoMode) });
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
      if (!isTripleTags(offers) || !isTripleTags(seeks)) {
        sendJson(res, 400, {
          ok: false,
          error: "Profile requires exactly 3 offer tags and exactly 3 seek tags.",
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

      if (!isTripleTags(offers) || !isTripleTags(seeks)) {
        sendJson(res, 400, {
          ok: false,
          error: "Onboarding requires exactly 3 offers and exactly 3 seeks.",
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
      const wave = createWave(EVENT_ID);
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
      const wave = createWave(EVENT_ID);
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
