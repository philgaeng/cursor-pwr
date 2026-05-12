const REQUIRED_ASSIGNED_ROUTES = 3;

/** Same-origin `/api` (Vercel or `vercel dev`). Override with window.API_BASE_URL only for debugging. */
const resolveApiBaseUrl = () => {
  if (window.API_BASE_URL !== undefined && window.API_BASE_URL !== null) {
    const raw = String(window.API_BASE_URL).trim();
    if (raw !== "") return raw.replace(/\/$/, "");
  }
  return "";
};

const API_BASE_URL = resolveApiBaseUrl();
const STORAGE_KEY = "nexuslink-web-state-v2";
const ORGANIZER_SESSION_KEY = "nexuslink-organizer-session-token";
const OFFER_TAG_OPTIONS = [
  "AI Product Strategy",
  "Fundraising Advice",
  "Hiring Referrals",
  "Technical Mentorship",
  "Growth Partnerships",
  "Demo Feedback",
];
const SEEK_TAG_OPTIONS = [
  "Investors",
  "Co-founder Match",
  "Pilot Customers",
  "Engineering Talent",
  "B2B Partnerships",
  "Mentors",
];

const defaultState = {
  auth: null,
  userId: null,
  eventId: null,
  profile: null,
  answers: [],
  icebreakerResponses: [],
  icebreakerDraft: null,
  assignedRouteIds: [],
  routeCatalogVersion: null,
  consent: null,
  onboardingComplete: false,
  wave: null,
  actions: [],
  meetupPlans: {},
};

const loadState = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    const merged = { ...defaultState, ...(parsed || {}) };
    return {
      ...merged,
      answers: Array.isArray(merged.answers) ? merged.answers : [],
      icebreakerResponses: Array.isArray(merged.icebreakerResponses) ? merged.icebreakerResponses : [],
      assignedRouteIds: Array.isArray(merged.assignedRouteIds) ? merged.assignedRouteIds : [],
      actions: Array.isArray(merged.actions) ? merged.actions : [],
      meetupPlans: merged.meetupPlans && typeof merged.meetupPlans === "object" ? merged.meetupPlans : {},
      profile: merged.profile && typeof merged.profile === "object" ? merged.profile : null,
      auth: merged.auth && typeof merged.auth === "object" ? merged.auth : null,
    };
  } catch (_error) {
    return { ...defaultState };
  }
};

const saveState = (state) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

const state = loadState();
const page = document.body.dataset.page;
const appStatus = document.getElementById("app-status");

const setStatus = (message, type = "info") => {
  if (!appStatus) return;
  appStatus.textContent = message;
  appStatus.className = "";
  if (type === "error") appStatus.classList.add("status-error");
  if (type === "success") appStatus.classList.add("status-success");
};

const navigate = (path) => {
  window.location.href = path;
};

const shuffle = (items) => {
  const clone = [...items];
  for (let i = clone.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [clone[i], clone[j]] = [clone[j], clone[i]];
  }
  return clone;
};

/** Returns false if a redirect was triggered (do not bind page handlers). */
const ensureStep = () => {
  if (page === "organizer-login") return true;
  if (page === "organizer") {
    try {
      const token = sessionStorage.getItem(ORGANIZER_SESSION_KEY);
      if (!token) {
        navigate("./organizer-login.html");
        return false;
      }
    } catch (_error) {
      navigate("./organizer-login.html");
      return false;
    }
    return true;
  }
  const hasProfile = Boolean(state.profile && typeof state.profile === "object");
  const responseCount = Array.isArray(state.icebreakerResponses) ? state.icebreakerResponses.length : 0;
  if (page !== "auth" && !state.auth) {
    navigate("./index.html");
    return false;
  }
  if (["questions", "consent", "queue", "vault"].includes(page) && !hasProfile) {
    navigate("/profile.html");
    return false;
  }
  if (["consent", "queue", "vault"].includes(page) && responseCount < 3) {
    navigate("./questions.html");
    return false;
  }
  if (["queue", "vault"].includes(page) && !state.onboardingComplete) {
    navigate("./consent.html");
    return false;
  }
  return true;
};

const normalizeWave = (wave) => {
  if (!wave) return null;
  if (wave.id && Array.isArray(wave.candidates) && wave.candidates[0]?.profile) return wave;
  return {
    id: wave.waveId ?? "wave-unknown",
    eventId: wave.eventId ?? "demo-event-2026",
    sentAtIso: wave.createdAt ?? new Date().toISOString(),
    candidates: (wave.candidates ?? []).map((candidate) => ({
      profile: {
        id: candidate.id,
        fullName: candidate.name,
        headline: `${candidate.role} at ${candidate.company}`,
        company: candidate.company,
        phone: candidate.whatsapp,
      },
      matchReason: Array.isArray(candidate.reasons) ? candidate.reasons.join(" • ") : candidate.reason,
      score: candidate.compatibilityScore ?? 0.5,
    })),
  };
};

const mockWave = () =>
  normalizeWave({
    waveId: `wave-${Date.now()}`,
    eventId: "demo-event-2026",
    createdAt: new Date().toISOString(),
    candidates: [
      { id: "u2", name: "Elena Park", role: "Investor", company: "Green VC", compatibilityScore: 0.93, reasons: ["Founder-investor fit", "Shared climate focus"], whatsapp: "+65 8111 1111" },
      { id: "u3", name: "Daniel Ng", role: "Frontend Engineer", company: "Flow Apps", compatibilityScore: 0.86, reasons: ["Product overlap", "Hiring alignment"], whatsapp: "+65 8222 2222" },
      { id: "u4", name: "Sophia Tan", role: "Operator", company: "Scale Studio", compatibilityScore: 0.82, reasons: ["GTM complement", "B2B SaaS synergy"], whatsapp: "+65 8333 3333" },
    ],
  });

const apiFetch = async (path, options = {}) => {
  const url = path.startsWith("http") ? path : `${API_BASE_URL}${path}`;
  const requestPath = path.startsWith("http") ? new URL(path).pathname : path;
  const method = String(options.method || "GET").toUpperCase();
  const headers = { ...(options.headers || {}) };
  if (method !== "GET" && method !== "HEAD") {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
  }
  if (state.userId) headers["X-User-Id"] = state.userId;
  if (/^\/api\/organizer\//.test(requestPath) && !/^\/api\/organizer\/(login|signup)$/.test(requestPath)) {
    try {
      const organizerToken = sessionStorage.getItem(ORGANIZER_SESSION_KEY);
      if (organizerToken) headers.Authorization = `Bearer ${organizerToken}`;
    } catch (_error) {
      /* sessionStorage unavailable */
    }
  }

  const timeoutMs = typeof options.timeoutMs === "number" ? options.timeoutMs : 25000;
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), timeoutMs);
  let response;
  try {
    response = await fetch(url, { ...options, method: method || "GET", headers, signal: ctrl.signal });
  } catch (err) {
    clearTimeout(tid);
    if (err && err.name === "AbortError") {
      throw new Error("Request timed out. Try again or check the deployment.");
    }
    throw err;
  }
  clearTimeout(tid);

  if (!response.ok) {
    try {
      const payload = await response.json();
      throw new Error(payload.error || `Request failed: ${response.status}`);
    } catch (_error) {
      throw new Error(`Request failed: ${response.status}`);
    }
  }
  return response.json();
};

const TIER1_TILE_CAP = 4;
const ROUTE_STEPS = 5;
const ICE_EMOJI_DECK = ["🎯", "✨", "🌟", "🔥", "💫", "🎨", "🎪", "🚀", "🌈", "⚡"];

const optionHuePair = (key) => {
  let h = 0;
  const s = String(key);
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  const h1 = h % 360;
  const h2 = (h * 17 + 127) % 360;
  return { h1, h2 };
};

const optionEmoji = (key) => {
  let h = 0;
  const s = String(key);
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 13 + s.charCodeAt(i)) >>> 0;
  }
  return ICE_EMOJI_DECK[h % ICE_EMOJI_DECK.length];
};

const formatOptionLabel = (code) =>
  String(code)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

const tier1OptionsForTiles = (route) => route.tier1Options.slice(0, TIER1_TILE_CAP);

const findAssignedRouteIndex = (routes, responses) => {
  const done = new Set(responses.map((r) => r.routeId));
  const idx = routes.findIndex((r) => !done.has(r.routeId));
  return idx === -1 ? routes.length : idx;
};

const emptyDraft = (routeId) => ({
  routeId,
  step: 1,
  tier1: "",
  tier2: "",
  tier3: [],
  freeText: "",
});

const normalizeDraft = (route, raw) => {
  const base = emptyDraft(route.routeId);
  const d = {
    ...base,
    ...(raw || {}),
    routeId: route.routeId,
    tier3: Array.isArray(raw?.tier3) ? [...raw.tier3] : [],
  };
  if (d.step < 1) d.step = 1;
  if (d.step > ROUTE_STEPS) d.step = ROUTE_STEPS;
  return d;
};

const getTier1Branch = (route, tier1Code) => route.tier1Options.find((o) => o.code === tier1Code);

const getTier3Questions = (tier1Option, tier2Value) => {
  if (!tier1Option || !tier2Value) return [];
  return (tier1Option.tier3ByTier2 || {})[tier2Value] || [];
};

const freeTextPromptForRoute = (route, tier1Option) =>
  tier1Option?.freeTextPromptOverride || route.freeTextPrompt || "Optional: share one specific example";

const renderWave = () => {
  const waveStatus = document.getElementById("wave-status");
  const list = document.getElementById("match-list");
  if (!waveStatus || !list) return;
  list.innerHTML = "";
  if (!state.wave) {
    waveStatus.textContent = "No wave loaded.";
    return;
  }
  waveStatus.textContent = `Wave ${state.wave.id} loaded with ${state.wave.candidates.length} candidates.`;
  state.wave.candidates.forEach((candidate) => {
    const card = document.createElement("li");
    card.className = "candidate-card";
    card.innerHTML = `
      <strong>${candidate.profile.fullName}</strong>
      <p>${candidate.profile.headline}</p>
      <p>Score: ${Math.round(candidate.score * 100)}%</p>
      <p>${candidate.matchReason}</p>
      <div class="candidate-actions">
        <button type="button" data-user-id="${candidate.profile.id}" data-action="like">Like</button>
        <button type="button" data-user-id="${candidate.profile.id}" data-action="pass" class="ghost-btn">Pass</button>
      </div>
    `;
    list.appendChild(card);
  });
};

const renderVault = () => {
  const list = document.getElementById("connections-list");
  if (!list) return;
  list.innerHTML = "";
  const actionEntries = Array.isArray(state.actions) ? state.actions : [];
  if (actionEntries.length === 0) {
    const empty = document.createElement("li");
    empty.className = "vault-item";
    empty.textContent = "No actions yet. Go back to the queue and review candidates.";
    list.appendChild(empty);
    return;
  }
  actionEntries.forEach((entry) => {
    const candidate = state.wave?.candidates.find((item) => item.profile.id === entry.userId);
    const item = document.createElement("li");
    item.className = "vault-item";
    if (!candidate) {
      item.textContent = `${entry.action} recorded for ${entry.userId}.`;
    } else if (entry.action === "like" && entry.userId === "u2") {
      const meetup = state.meetupPlans?.[entry.userId];
      const title = document.createElement("p");
      title.textContent = `Mutual like with ${candidate.profile.fullName}. WhatsApp unlocked: ${candidate.profile.phone}`;
      item.appendChild(title);
      if (meetup?.instructionsForUser) {
        const meetupInfo = document.createElement("p");
        meetupInfo.textContent = `Meetup plan: ${meetup.instructionsForUser}`;
        item.appendChild(meetupInfo);
      } else {
        const pending = document.createElement("p");
        pending.textContent = "Fetching meetup instructions…";
        item.appendChild(pending);
      }
      if (meetup?.requiresWearableMarker) {
        const markerWrap = document.createElement("div");
        markerWrap.className = "vault-marker-row";
        const label = document.createElement("label");
        label.textContent = meetup.wearablePrompt || "What are you wearing?";
        const input = document.createElement("input");
        input.type = "text";
        input.placeholder = "e.g. black polo with white shoes";
        input.value = meetup.yourWearableMarker || "";
        input.dataset.targetUserId = entry.userId;
        input.className = "vault-marker-input";
        const saveBtn = document.createElement("button");
        saveBtn.type = "button";
        saveBtn.className = "ghost-btn";
        saveBtn.dataset.action = "save-marker";
        saveBtn.dataset.targetUserId = entry.userId;
        saveBtn.textContent = meetup.yourWearableMarker ? "Update marker" : "Save marker";
        label.appendChild(input);
        markerWrap.appendChild(label);
        markerWrap.appendChild(saveBtn);
        item.appendChild(markerWrap);
      }
    } else if (entry.action === "like") {
      item.textContent = `Liked ${candidate.profile.fullName}. Waiting for mutual like (locked).`;
    } else {
      item.textContent = `Passed ${candidate.profile.fullName}. Contact remains private.`;
    }
    list.appendChild(item);
  });
};

const bindAuthPage = () => {
  const linkedInButton = document.getElementById("linkedin-auth-btn");
  const googleButton = document.getElementById("google-auth-btn");
  const manualButton = document.getElementById("manual-fallback-btn");
  const manualForm = document.getElementById("manual-bootstrap-form");
  const qrContext = document.getElementById("qr-context");
  if (!linkedInButton || !googleButton || !manualButton || !manualForm) return;

  const params = new URLSearchParams(window.location.search);
  const eventId = params.get("eventId");
  if (eventId) {
    state.eventId = eventId;
    saveState(state);
    if (qrContext) {
      qrContext.hidden = false;
      qrContext.textContent = `Event QR detected (${eventId}). LinkedIn is prioritized for fastest onboarding.`;
    }
  }

  const showGoogleFallback = (message) => {
    googleButton.hidden = false;
    manualButton.hidden = true;
    manualForm.hidden = true;
    setStatus(message, "error");
  };

  const showManualFallback = (message) => {
    googleButton.hidden = false;
    manualButton.hidden = false;
    setStatus(message, "error");
  };

  const continueToDetailsGathering = () => {
    navigate("/profile.html?step=02_details_gathering");
  };

  const saveBootstrap = (provider, session) => {
    state.auth = { provider, demoMode: Boolean(session.demoMode) };
    state.userId = session.userId;
    state.profile = {
      ...(state.profile || {}),
      fullName: session.profile?.name || state.profile?.fullName || "",
      name: session.profile?.name || state.profile?.name || "",
      email: session.profile?.email || state.profile?.email || "",
      avatarUrl: session.profile?.picture || state.profile?.avatarUrl || "",
      role: state.profile?.role || "",
      company: state.profile?.company || "",
      whatsapp: state.profile?.whatsapp || "",
      offers: Array.isArray(state.profile?.offers) ? state.profile.offers : [],
      seeks: Array.isArray(state.profile?.seeks) ? state.profile.seeks : [],
    };
    saveState(state);
  };

  const authenticateProvider = async (provider) => {
    const primaryBtn = provider === "linkedin" ? linkedInButton : googleButton;
    primaryBtn.disabled = true;
    setStatus(provider === "linkedin" ? "Starting LinkedIn (demo sign-in)…" : "Starting Google (demo sign-in)…", "info");
    try {
      const session = await apiFetch("/api/auth/session", {
        method: "POST",
        body: JSON.stringify({
          provider,
          eventId: state.eventId || undefined,
          /** MVP stub: server issues a session without real OAuth; marks intent for analytics. */
          demoMode: true,
        }),
      });
      saveBootstrap(provider, session);
      setStatus(`Signed in with ${provider}.`, "success");
      continueToDetailsGathering();
    } catch (error) {
      const reason = error instanceof Error ? error.message : `${provider} sign-in failed.`;
      if (provider === "linkedin") {
        showGoogleFallback(`${reason} You can continue with Google.`);
      } else {
        showManualFallback(`${reason} Continue with manual entry.`);
      }
    } finally {
      primaryBtn.disabled = false;
    }
  };

  linkedInButton.addEventListener("click", () => {
    authenticateProvider("linkedin");
  });
  googleButton.addEventListener("click", () => {
    authenticateProvider("google");
  });
  manualButton.addEventListener("click", () => {
    manualForm.hidden = false;
    setStatus("Complete manual bootstrap to continue.", "info");
  });

  manualForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = {
      name: document.getElementById("manual-name").value.trim(),
      company: document.getElementById("manual-company").value.trim(),
      role: document.getElementById("manual-role").value.trim(),
      email: document.getElementById("manual-email").value.trim(),
      phone: document.getElementById("manual-phone").value.trim(),
      eventId: state.eventId || undefined,
    };
    try {
      const result = await apiFetch("/api/auth/manual-bootstrap", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      state.auth = { provider: "manual", demoMode: true };
      state.userId = result.userId;
      state.profile = {
        ...(state.profile || {}),
        fullName: result.profile.name,
        name: result.profile.name,
        role: result.profile.role,
        company: result.profile.company,
        email: result.profile.email,
        whatsapp: result.profile.phone,
        offers: Array.isArray(state.profile?.offers) ? state.profile.offers : [],
        seeks: Array.isArray(state.profile?.seeks) ? state.profile.seeks : [],
      };
      saveState(state);
      setStatus("Manual profile saved.", "success");
      continueToDetailsGathering();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Manual bootstrap failed.", "error");
    }
  });
};

const bindProfilePage = () => {
  const form = document.getElementById("profile-form");
  const offerContainer = document.getElementById("offer-tag-options");
  const seekContainer = document.getElementById("seek-tag-options");
  const demoBanner = document.getElementById("demo-auth-banner");
  const linkedinUrlInput = document.getElementById("linkedin-url");
  const linkedinPrefillBtn = document.getElementById("linkedin-prefill-btn");
  if (!form) return;

  if (demoBanner) {
    const p = state.auth?.provider;
    const demo = Boolean(state.auth?.demoMode) && (p === "linkedin" || p === "google");
    demoBanner.hidden = !demo;
    demoBanner.textContent = demo
      ? `Demo ${p === "linkedin" ? "LinkedIn" : "Google"} sign-in: this build does not read your ${p === "linkedin" ? "LinkedIn" : "Google"} profile yet. Fill in your real details below, then continue.`
      : "";
  }

  let selectedOffers = [];
  let selectedSeeks = [];

  const applyLinkedInPrefill = (prefill) => {
    if (!prefill || typeof prefill !== "object") return;
    const fullNameEl = document.getElementById("full-name");
    const roleEl = document.getElementById("role");
    const companyEl = document.getElementById("company");
    if (linkedinUrlInput && prefill.linkedinUrl) linkedinUrlInput.value = prefill.linkedinUrl;
    if (prefill.fullName && !fullNameEl.value.trim()) fullNameEl.value = prefill.fullName;
    if (prefill.role && !roleEl.value.trim()) roleEl.value = prefill.role;
    if (prefill.company && !companyEl.value.trim()) companyEl.value = prefill.company;
  };

  const createTagButton = (tag, type) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tag-chip";
    button.dataset.tag = tag;
    button.dataset.type = type;
    button.textContent = tag;
    return button;
  };

  const renderTagSelection = () => {
    if (offerContainer) {
      offerContainer.querySelectorAll(".tag-chip").forEach((button) => {
        button.classList.toggle("selected", selectedOffers.includes(button.dataset.tag));
      });
    }
    if (seekContainer) {
      seekContainer.querySelectorAll(".tag-chip").forEach((button) => {
        button.classList.toggle("selected", selectedSeeks.includes(button.dataset.tag));
      });
    }
  };

  const toggleTag = (tag, selectedList) => {
    if (selectedList.includes(tag)) {
      return selectedList.filter((entry) => entry !== tag);
    }
    return [...selectedList, tag];
  };

  if (offerContainer) {
    OFFER_TAG_OPTIONS.forEach((tag) => {
      offerContainer.appendChild(createTagButton(tag, "offer"));
    });
    offerContainer.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLButtonElement)) return;
      selectedOffers = toggleTag(target.dataset.tag, selectedOffers);
      renderTagSelection();
      setStatus(
        `Offer selected: ${selectedOffers.length} • Looking for selected: ${selectedSeeks.length}`,
        "info"
      );
    });
  }

  if (seekContainer) {
    SEEK_TAG_OPTIONS.forEach((tag) => {
      seekContainer.appendChild(createTagButton(tag, "seek"));
    });
    seekContainer.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLButtonElement)) return;
      selectedSeeks = toggleTag(target.dataset.tag, selectedSeeks);
      renderTagSelection();
      setStatus(
        `Offer selected: ${selectedOffers.length} • Looking for selected: ${selectedSeeks.length}`,
        "info"
      );
    });
  }

  if (state.profile) {
    if (linkedinUrlInput) linkedinUrlInput.value = state.profile.linkedinUrl || "";
    document.getElementById("full-name").value = state.profile.fullName || "";
    document.getElementById("role").value = state.profile.role || "";
    document.getElementById("company").value = state.profile.company || "";
    document.getElementById("email").value = state.profile.email || "";
    document.getElementById("whatsapp").value = state.profile.whatsapp || "";
    selectedOffers = Array.isArray(state.profile.offers) ? state.profile.offers : [];
    selectedSeeks = Array.isArray(state.profile.seeks) ? state.profile.seeks : [];
    renderTagSelection();
  }

  if (linkedinPrefillBtn && linkedinUrlInput) {
    linkedinPrefillBtn.addEventListener("click", async () => {
      const linkedinUrl = linkedinUrlInput.value.trim();
      if (!linkedinUrl) {
        setStatus("Enter a LinkedIn URL to prefill.", "error");
        return;
      }
      linkedinPrefillBtn.disabled = true;
      setStatus("Parsing LinkedIn URL...", "info");
      try {
        const result = await apiFetch("/api/profile/enrich-linkedin", {
          method: "POST",
          body: JSON.stringify({ linkedinUrl }),
        });
        applyLinkedInPrefill(result.prefill || {});
        setStatus("LinkedIn URL parsed. Please review and edit details.", "success");
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "LinkedIn prefill failed.", "error");
      } finally {
        linkedinPrefillBtn.disabled = false;
      }
    });
  }

  if (selectedOffers.length === 0 && selectedSeeks.length === 0) {
    setStatus("Select at least 1 offer tag and 1 looking-for tag.", "info");
  } else {
    setStatus(
      `Offer selected: ${selectedOffers.length} • Looking for selected: ${selectedSeeks.length}`,
      "info"
    );
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (selectedOffers.length < 1 || selectedSeeks.length < 1) {
      setStatus("Select at least 1 offer tag and at least 1 looking-for tag.", "error");
      return;
    }
    const profile = {
      userId: state.userId,
      linkedinUrl: linkedinUrlInput ? linkedinUrlInput.value.trim() : "",
      fullName: document.getElementById("full-name").value.trim(),
      name: document.getElementById("full-name").value.trim(),
      role: document.getElementById("role").value.trim(),
      company: document.getElementById("company").value.trim(),
      email: document.getElementById("email").value.trim(),
      whatsapp: document.getElementById("whatsapp").value.trim(),
      offers: selectedOffers,
      seeks: selectedSeeks,
    };
    try {
      await apiFetch("/api/onboarding/profile", { method: "POST", body: JSON.stringify(profile) });
      state.profile = profile;
      saveState(state);
      navigate("./questions.html");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Profile save failed.", "error");
    }
  });
};

const bindQuestionsPage = () => {
  const stage = document.getElementById("icebreaker-stage");
  const pill = document.getElementById("icebreaker-step-pill");
  const routeTitleEl = document.getElementById("icebreaker-route-title");
  const promptEl = document.getElementById("icebreaker-prompt");
  const backBtn = document.getElementById("icebreaker-back");
  if (!stage || !pill || !routeTitleEl || !promptEl || !backBtn) return;

  const showStageHint = (text, className = "icebreaker-hint") => {
    stage.textContent = "";
    const p = document.createElement("p");
    p.className = className;
    p.textContent = text;
    stage.appendChild(p);
  };

  pill.textContent = "Loading…";
  routeTitleEl.textContent = "";
  promptEl.textContent = "";
  showStageHint("Loading route choices…");

  let assignedRoutes = [];
  let routeIndex = 0;
  let draft = null;

  const persist = () => {
    state.icebreakerDraft = draft;
    saveState(state);
  };

  const renderTiles = (container, items, layout, onPick) => {
    container.innerHTML = "";
    const grid = document.createElement("div");
    grid.className = layout === "4" ? "ice-tile-grid ice-tile-grid--four" : "ice-tile-grid ice-tile-grid--two";
    items.forEach((item) => {
      const { value, label } = item;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "ice-tile";
      const { h1, h2 } = optionHuePair(`${value}:${label}`);
      const art = document.createElement("span");
      art.className = "ice-tile__visual";
      art.style.background = `linear-gradient(135deg, hsl(${h1}, 72%, 52%), hsl(${h2}, 70%, 38%))`;
      const emoji = document.createElement("span");
      emoji.className = "ice-tile__emoji";
      emoji.setAttribute("aria-hidden", "true");
      emoji.textContent = optionEmoji(value);
      art.appendChild(emoji);
      const lab = document.createElement("span");
      lab.className = "ice-tile__label";
      lab.textContent = label;
      btn.appendChild(art);
      btn.appendChild(lab);
      btn.addEventListener("click", () => onPick(value));
      grid.appendChild(btn);
    });
    container.appendChild(grid);
  };

  const syncChrome = () => {
    const route = assignedRoutes[routeIndex];
    if (!route || !draft) return;
    pill.textContent = `Route ${routeIndex + 1} of ${assignedRoutes.length} · Step ${draft.step} of ${ROUTE_STEPS}`;
    routeTitleEl.textContent = route.title;
    backBtn.hidden = draft.step <= 1;
  };

  const tier3AnswersValid = (tier3List, t3Questions) => {
    const filled = (tier3List || []).filter(Boolean);
    if (t3Questions.length === 0) return true;
    if (t3Questions.length === 1) return filled.length >= 1;
    return filled.length >= 2;
  };

  const finishRoute = async () => {
    const route = assignedRoutes[routeIndex];
    if (!route || !draft) return;
    const tier1Option = getTier1Branch(route, draft.tier1);
    const t3q = getTier3Questions(tier1Option, draft.tier2);
    const tier3 = [...draft.tier3];
    if (!draft.tier1 || !draft.tier2 || !tier3AnswersValid(tier3, t3q)) {
      setStatus("Please complete each choice for this route.", "error");
      render();
      return;
    }
    const freeText = (draft.freeText || "").trim();
    const response = {
      questionId: `${route.routeId}:${draft.tier1}:${draft.tier2}`,
      answer: `${draft.tier1} > ${draft.tier2} > ${tier3.filter(Boolean).join(", ")}`,
      routeId: route.routeId,
      tier1: draft.tier1,
      tier2: draft.tier2,
      tier3,
      freeText,
      answeredAt: new Date().toISOString(),
    };
    state.icebreakerResponses = state.icebreakerResponses.filter((r) => r.routeId !== route.routeId);
    state.icebreakerResponses.push(response);
    state.icebreakerDraft = null;
    draft = null;
    saveState(state);

    if (state.icebreakerResponses.length < REQUIRED_ASSIGNED_ROUTES) {
      routeIndex = findAssignedRouteIndex(assignedRoutes, state.icebreakerResponses);
      const nextRoute = assignedRoutes[routeIndex];
      draft = emptyDraft(nextRoute.routeId);
      state.icebreakerDraft = draft;
      saveState(state);
      const remaining = REQUIRED_ASSIGNED_ROUTES - state.icebreakerResponses.length;
      setStatus(`Saved. ${remaining} more route${remaining === 1 ? "" : "s"} to go.`, "success");
      render();
      return;
    }

    try {
      await apiFetch("/api/onboarding/questions", {
        method: "POST",
        body: JSON.stringify({ icebreakerResponses: state.icebreakerResponses }),
      });
      state.answers = state.icebreakerResponses.map((r) => r.answer);
      state.icebreakerDraft = null;
      saveState(state);
      navigate("./consent.html");
    } catch (error) {
      draft = normalizeDraft(route, {
        routeId: route.routeId,
        step: ROUTE_STEPS,
        tier1: response.tier1,
        tier2: response.tier2,
        tier3: response.tier3,
        freeText: response.freeText,
      });
      state.icebreakerDraft = draft;
      state.icebreakerResponses = state.icebreakerResponses.filter((r) => r.routeId !== route.routeId);
      saveState(state);
      setStatus(error instanceof Error ? error.message : "Questionnaire save failed.", "error");
      render();
    }
  };

  const render = () => {
    const route = assignedRoutes[routeIndex];
    if (!route || !draft) return;
    draft = normalizeDraft(route, draft);
    syncChrome();
    stage.innerHTML = "";
    promptEl.textContent = "";

    if (draft.step === 1) {
      promptEl.textContent = route.tier1Prompt;
      const opts = tier1OptionsForTiles(route).map((o) => ({ value: o.code, label: o.label }));
      renderTiles(stage, opts, "4", (code) => {
        draft.tier1 = code;
        draft.tier2 = "";
        draft.tier3 = [];
        draft.freeText = "";
        draft.step = 2;
        persist();
        render();
      });
      return;
    }

    const tier1Option = getTier1Branch(route, draft.tier1);
    if (!tier1Option) {
      draft.step = 1;
      draft.tier1 = "";
      persist();
      render();
      return;
    }

    if (draft.step === 2) {
      promptEl.textContent = tier1Option.tier2Prompt;
      const opts = (tier1Option.tier2Options || []).map((code) => ({
        value: code,
        label: formatOptionLabel(code),
      }));
      renderTiles(stage, opts, "2", (code) => {
        draft.tier2 = code;
        draft.tier3 = [];
        draft.freeText = "";
        draft.step = 3;
        persist();
        render();
      });
      return;
    }

    const t3 = getTier3Questions(tier1Option, draft.tier2);

    if (draft.step === 3) {
      const q = t3[0];
      if (!q) {
        draft.step = 5;
        persist();
        render();
        return;
      }
      promptEl.textContent = q.prompt;
      const opts = q.options.map((code) => ({ value: code, label: formatOptionLabel(code) }));
      renderTiles(stage, opts, "2", (code) => {
        draft.tier3 = [code];
        draft.freeText = "";
        draft.step = t3.length >= 2 ? 4 : 5;
        persist();
        render();
      });
      return;
    }

    if (draft.step === 4) {
      const q = t3[1];
      if (!q) {
        draft.step = 5;
        persist();
        render();
        return;
      }
      promptEl.textContent = q.prompt;
      const opts = q.options.map((code) => ({ value: code, label: formatOptionLabel(code) }));
      renderTiles(stage, opts, "2", (code) => {
        const first = draft.tier3[0] || "";
        draft.tier3 = [first, code];
        draft.freeText = "";
        draft.step = 5;
        persist();
        render();
      });
      return;
    }

    if (draft.step === 5) {
      promptEl.textContent = freeTextPromptForRoute(route, tier1Option);
      const wrap = document.createElement("div");
      wrap.className = "ice-free-wrap";
      const ta = document.createElement("textarea");
      ta.className = "ice-free-text";
      ta.placeholder = "Optional — add a fun detail";
      ta.value = draft.freeText || "";
      ta.rows = 4;
      ta.addEventListener("input", () => {
        draft.freeText = ta.value;
        persist();
      });
      const actions = document.createElement("div");
      actions.className = "ice-primary-actions";
      const nextBtn = document.createElement("button");
      nextBtn.type = "button";
      nextBtn.textContent =
        routeIndex + 1 >= assignedRoutes.length ? "Finish icebreakers" : "Save & next route";
      nextBtn.addEventListener("click", () => finishRoute());
      actions.appendChild(nextBtn);
      wrap.appendChild(ta);
      wrap.appendChild(actions);
      stage.appendChild(wrap);
    }
  };

  backBtn.addEventListener("click", () => {
    if (!draft || draft.step <= 1) return;
    const route = assignedRoutes[routeIndex];
    const tier1Option = getTier1Branch(route, draft.tier1);
    const t3 = getTier3Questions(tier1Option, draft.tier2);

    if (draft.step === 5) {
      if (t3.length >= 2) {
        draft.step = 4;
        draft.tier3 = draft.tier3.slice(0, 1);
      } else {
        draft.step = 3;
        draft.tier3 = [];
      }
      draft.freeText = "";
    } else if (draft.step === 4) {
      draft.step = 3;
      draft.tier3 = [];
    } else if (draft.step === 3) {
      draft.step = 2;
      draft.tier3 = [];
    } else if (draft.step === 2) {
      draft.step = 1;
      draft.tier2 = "";
      draft.tier3 = [];
    }
    persist();
    render();
  });

  const hydrate = async () => {
    try {
      /** Static JSON ships with the web app (Vercel rewrite → apps/web); avoids serverless FS issues. */
      let catalog;
      try {
        catalog = await apiFetch("/icebreaker-routes.v1.json", { method: "GET" });
      } catch (_staticErr) {
        catalog = await apiFetch("/api/routes/catalog", { method: "GET" });
      }
      const routes = Array.isArray(catalog.routes) ? catalog.routes : [];
      if (routes.length === 0) {
        pill.textContent = "Unavailable";
        showStageHint("No routes in catalog. Try again or contact support.", "icebreaker-hint icebreaker-hint--error");
        setStatus("No route catalog available.", "error");
        return;
      }
      state.routeCatalogVersion = catalog.version || "v1";
      if (!Array.isArray(state.assignedRouteIds) || state.assignedRouteIds.length !== REQUIRED_ASSIGNED_ROUTES) {
        state.assignedRouteIds = shuffle(routes.map((r) => r.routeId)).slice(0, REQUIRED_ASSIGNED_ROUTES);
      }
      assignedRoutes = state.assignedRouteIds
        .map((id) => routes.find((r) => r.routeId === id))
        .filter(Boolean);
      if (assignedRoutes.length < REQUIRED_ASSIGNED_ROUTES) {
        pill.textContent = "Error";
        showStageHint("Assigned routes could not be resolved from the catalog.", "icebreaker-hint icebreaker-hint--error");
        setStatus("Assigned routes could not be resolved.", "error");
        return;
      }

      routeIndex = findAssignedRouteIndex(assignedRoutes, state.icebreakerResponses);
      if (routeIndex >= assignedRoutes.length) {
        navigate("./consent.html");
        return;
      }

      const currentRoute = assignedRoutes[routeIndex];
      if (state.icebreakerDraft && state.icebreakerDraft.routeId === currentRoute.routeId) {
        draft = normalizeDraft(currentRoute, state.icebreakerDraft);
      } else {
        draft = emptyDraft(currentRoute.routeId);
        state.icebreakerDraft = draft;
      }
      saveState(state);
      const remaining = REQUIRED_ASSIGNED_ROUTES - state.icebreakerResponses.length;
      setStatus(
        remaining > 0
          ? `Tap a tile to choose — ${remaining} route${remaining === 1 ? "" : "s"} left after you finish this one.`
          : "Almost done.",
        "info"
      );
      render();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unable to load route catalog.";
      pill.textContent = "Couldn’t load";
      showStageHint(
        `${msg} In DevTools → Network, confirm GET /api/routes/catalog returns 200 on this host.`,
        "icebreaker-hint icebreaker-hint--error"
      );
      setStatus(msg, "error");
    }
  };

  hydrate();
};

const bindConsentPage = () => {
  const form = document.getElementById("consent-form");
  if (!form) return;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const consentAccepted = document.getElementById("privacy-consent").checked;
    const autoDeleteAfter24h = document.getElementById("auto-delete").checked;
    if (!consentAccepted) {
      setStatus("Consent is required.", "error");
      return;
    }
    try {
      await apiFetch("/api/onboarding/complete", {
        method: "POST",
        body: JSON.stringify({
          userId: state.userId,
          provider: state.auth.provider,
          consentAccepted,
          autoDeleteAfter24h,
          offers: state.profile.offers,
          seeks: state.profile.seeks,
          name: state.profile.fullName,
          role: state.profile.role,
          company: state.profile.company,
          email: state.profile.email,
          whatsapp: state.profile.whatsapp,
          icebreakerResponses: state.icebreakerResponses,
        }),
      });
      state.consent = { consentAccepted, autoDeleteAfter24h };
      state.onboardingComplete = true;
      saveState(state);
      navigate("./queue.html");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Onboarding completion failed.", "error");
    }
  });
};

const bindQueuePage = () => {
  const loadButton = document.getElementById("load-wave");
  const triggerButton = document.getElementById("trigger-wave");
  const matchList = document.getElementById("match-list");
  if (!loadButton || !triggerButton || !matchList) return;

  const loadWave = async (manual = false) => {
    try {
      const response = await apiFetch(manual ? "/api/waves/trigger" : "/api/waves/current", {
        method: manual ? "POST" : "GET",
      });
      state.wave = normalizeWave(response);
      saveState(state);
      renderWave();
      setStatus(manual ? "Manual wave triggered." : "Wave loaded.", "success");
    } catch (_error) {
      state.wave = mockWave();
      saveState(state);
      renderWave();
      setStatus("Using demo wave fallback.", "error");
    }
  };

  loadButton.addEventListener("click", () => loadWave(false));
  triggerButton.addEventListener("click", () => loadWave(true));
  matchList.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) return;
    const userId = target.dataset.userId;
    const action = target.dataset.action;
    if (!userId || (action !== "like" && action !== "pass")) return;
    try {
      await apiFetch("/api/matches/action", {
        method: "POST",
        body: JSON.stringify({ userId: state.userId, waveId: state.wave?.id, targetUserId: userId, action }),
      });
      state.actions = state.actions.filter((entry) => entry.userId !== userId);
      state.actions.push({ userId, action });
      saveState(state);
      setStatus(`Action saved: ${action}.`, "success");
      navigate("./vault.html");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Action failed.", "error");
    }
  });
  renderWave();
};

const bindVaultPage = () => {
  const list = document.getElementById("connections-list");
  const mutualTargets = (state.actions || [])
    .filter((entry) => entry.action === "like" && entry.userId === "u2")
    .map((entry) => entry.userId);

  const fetchMeetupPlan = async (targetUserId) => {
    const response = await apiFetch(`/api/meetup/plan?targetUserId=${encodeURIComponent(targetUserId)}`, {
      method: "GET",
    });
    if (!state.meetupPlans || typeof state.meetupPlans !== "object") {
      state.meetupPlans = {};
    }
    state.meetupPlans[targetUserId] = response.meetup;
    saveState(state);
  };

  const loadPlans = async () => {
    if (mutualTargets.length === 0) return;
    for (const targetUserId of mutualTargets) {
      try {
        await fetchMeetupPlan(targetUserId);
      } catch (_error) {
        continue;
      }
    }
    renderVault();
  };

  if (list) {
    list.addEventListener("click", async (event) => {
      const target = event.target;
      if (!(target instanceof HTMLButtonElement)) return;
      if (target.dataset.action !== "save-marker") return;
      const targetUserId = target.dataset.targetUserId;
      if (!targetUserId) return;
      const markerInput = list.querySelector(`input.vault-marker-input[data-target-user-id="${targetUserId}"]`);
      const wearableMarker = markerInput instanceof HTMLInputElement ? markerInput.value.trim() : "";
      if (!wearableMarker) {
        setStatus("Please enter what you are wearing.", "error");
        return;
      }
      target.disabled = true;
      try {
        await apiFetch("/api/meetup/preferences", {
          method: "POST",
          body: JSON.stringify({ wearableMarker }),
        });
        await fetchMeetupPlan(targetUserId);
        renderVault();
        setStatus("Meetup marker saved.", "success");
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Failed to save marker.", "error");
      } finally {
        target.disabled = false;
      }
    });
  }

  renderVault();
  loadPlans();
};

const defaultOrganizerSettingsShape = () => ({
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
    id: "demo-event-2026",
    name: "",
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
    suggestions: ["", "", "", "", "", "", "", ""],
    crowdCues: "",
    generationStyleNotes: "",
  },
  icebreakerRoutes: null,
  icebreakerRoutesDraft: null,
  icebreakerRoutesHistory: [],
  physicalMeetup: {
    enabled: true,
    spaces: ["Main Hall North", "Coffee Bar", "Side Lounge"],
    signs: {
      enabled: true,
      options: ["Red flag", "Blue flag", "Yellow flag"],
    },
    wearablePrompt: "What are you wearing so your match can spot you quickly?",
  },
  parameters: {
    onboarding: {
      requiredOfferTags: 3,
      requiredSeekTags: 3,
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

const deepMerge = (target, source) => {
  if (!source || typeof source !== "object") return target;
  if (Array.isArray(source)) return source.slice();
  const out = Array.isArray(target) ? [...target] : { ...target };
  Object.keys(source).forEach((key) => {
    const sv = source[key];
    const tv = target[key];
    if (
      sv &&
      typeof sv === "object" &&
      !Array.isArray(sv) &&
      tv &&
      typeof tv === "object" &&
      !Array.isArray(tv)
    ) {
      out[key] = deepMerge(tv, sv);
    } else {
      out[key] = sv;
    }
  });
  return out;
};

const bindOrganizerLoginPage = () => {
  const loginForm = document.getElementById("organizer-login-form");
  const signupForm = document.getElementById("organizer-signup-form");
  const toggleSignup = document.getElementById("organizer-toggle-signup");
  const signupPanel = document.getElementById("organizer-signup-panel");
  if (!loginForm) return;

  if (toggleSignup && signupPanel) {
    toggleSignup.addEventListener("click", () => {
      signupPanel.hidden = !signupPanel.hidden;
    });
  }

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const emailEl = document.getElementById("org-login-email");
    const passwordEl = document.getElementById("org-login-password");
    const email = emailEl && typeof emailEl.value === "string" ? emailEl.value.trim() : "";
    const password = passwordEl && typeof passwordEl.value === "string" ? passwordEl.value : "";
    if (!email || !password) {
      setStatus("Email and password are required.", "error");
      return;
    }
    setStatus("Signing in…", "info");
    try {
      const payload = await apiFetch("/api/organizer/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      if (payload.token) {
        try {
          sessionStorage.setItem(ORGANIZER_SESSION_KEY, payload.token);
        } catch (_error) {
          setStatus("Could not store session in this browser.", "error");
          return;
        }
      }
      setStatus("Signed in.", "success");
      navigate("./organizer.html");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Login failed.", "error");
    }
  });

  if (signupForm) {
    signupForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const name = document.getElementById("org-signup-name")?.value?.trim();
      const email = document.getElementById("org-signup-email")?.value?.trim();
      const password = document.getElementById("org-signup-password")?.value || "";
      if (!name || !email || !password) {
        setStatus("Name, email, and password are required.", "error");
        return;
      }
      if (password.length < 8) {
        setStatus("Password must be at least 8 characters.", "error");
        return;
      }
      setStatus("Creating account…", "info");
      try {
        await apiFetch("/api/organizer/signup", {
          method: "POST",
          body: JSON.stringify({ name, email, password }),
        });
        const loginEmail = document.getElementById("org-login-email");
        const loginPassword = document.getElementById("org-login-password");
        if (loginEmail) loginEmail.value = email;
        if (loginPassword) loginPassword.value = password;
        if (signupPanel) signupPanel.hidden = true;
        setStatus("Account created. Press continue to sign in.", "success");
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Signup failed.", "error");
      }
    });
  }
};

const bindOrganizerPage = () => {
  const form = document.getElementById("organizer-form");
  const reloadBtn = document.getElementById("organizer-reload");
  const jsonArea = document.getElementById("org-settings-json");
  const jsonRefreshBtn = document.getElementById("org-json-refresh");
  const jsonApplyBtn = document.getElementById("org-json-apply");
  const generateRoutesBtn = document.getElementById("org-generate-routes");
  const publishRoutesBtn = document.getElementById("org-publish-routes");
  const rollbackRoutesBtn = document.getElementById("org-rollback-routes");
  const desktopTabButtons = Array.from(document.querySelectorAll(".organizer-tab-btn"));
  const mobileLinks = Array.from(document.querySelectorAll(".organizer-mobile-link"));
  const sectionPanels = Array.from(document.querySelectorAll("[data-organizer-section]"));
  const mobileMenuToggle = document.getElementById("organizer-mobile-menu-toggle");
  const mobileMenu = document.getElementById("organizer-mobile-menu");
  if (!form) return;

  const getEl = (id) => document.getElementById(id);
  const ORGANIZER_SECTION_KEY = "nexuslink-organizer-active-section";
  let activeSectionId = "section-organizer";

  const eventSelect = getEl("org-event-select");
  const eventNewBtn = getEl("org-event-new");
  const eventCloneBtn = getEl("org-event-clone");
  const logoutBtn = getEl("org-organizer-logout");
  let eventSelectProgrammatic = false;

  const diskMessage = (payload, base, tone = "success") => {
    const warn = payload && payload.diskWriteOk === false;
    const msg = warn
      ? `${base} Note: organizer JSON store could not write to disk; changes may not persist on this host.`
      : base;
    setStatus(msg, warn ? "error" : tone);
  };

  const applyEventsToSwitcher = (events, activeEventKey) => {
    if (!(eventSelect instanceof HTMLSelectElement)) return;
    eventSelectProgrammatic = true;
    const list = Array.isArray(events) ? events : [];
    eventSelect.innerHTML = "";
    list.forEach((entry) => {
      if (!entry || !entry.event_key) return;
      const opt = document.createElement("option");
      opt.value = entry.event_key;
      opt.textContent = entry.name || entry.event_key;
      if (entry.event_key === activeEventKey) opt.selected = true;
      eventSelect.appendChild(opt);
    });
    if (activeEventKey && list.some((e) => e && e.event_key === activeEventKey)) {
      eventSelect.value = activeEventKey;
    }
    eventSelectProgrammatic = false;
  };

  const applyServerOrganizerPayload = (payload) => {
    if (!payload || typeof payload !== "object") return;
    if (payload.settings) {
      lastLoaded = payload.settings;
      applyToForm(lastLoaded);
      refreshJsonFromSettings(lastLoaded);
    }
    if (Array.isArray(payload.events) && payload.activeEventKey != null) {
      applyEventsToSwitcher(payload.events, payload.activeEventKey);
    }
  };

  const syncLlmCredentialVisibility = () => {
    const sel = getEl("org-llm-provider");
    const p = sel instanceof HTMLSelectElement && sel.value ? sel.value : "none";
    ["openai", "anthropic", "gemini", "deepseek"].forEach((key) => {
      const row = getEl(`org-llm-row-${key}`);
      if (row) row.hidden = p !== key;
    });
  };

  const applyToForm = (raw) => {
    const s = deepMerge(defaultOrganizerSettingsShape(), raw || {});
    const eventIdEl = getEl("org-event-id");
    if (eventIdEl) eventIdEl.textContent = s.eventInfo?.id || "—";

    getEl("org-email").value = s.organizer?.creds?.email || "";

    const llm = s.organizer?.llm && typeof s.organizer.llm === "object" ? s.organizer.llm : {};
    const keys = llm.apiKeys && typeof llm.apiKeys === "object" ? llm.apiKeys : {};
    const provSel = getEl("org-llm-provider");
    if (provSel instanceof HTMLSelectElement) {
      const allowed = new Set(["none", "openai", "anthropic", "gemini", "deepseek"]);
      provSel.value = allowed.has(String(llm.provider)) ? String(llm.provider) : "none";
    }
    const openaiKey = getEl("org-llm-key-openai");
    const anthropicKey = getEl("org-llm-key-anthropic");
    const geminiKey = getEl("org-llm-key-gemini");
    const deepseekKey = getEl("org-llm-key-deepseek");
    if (openaiKey) openaiKey.value = keys.openai || "";
    if (anthropicKey) anthropicKey.value = keys.anthropic || "";
    if (geminiKey) geminiKey.value = keys.gemini || "";
    if (deepseekKey) deepseekKey.value = keys.deepseek || "";
    syncLlmCredentialVisibility();

    getEl("org-social-ig").value = s.organizer?.socialMedia?.instagram || "";
    getEl("org-social-wa").value = s.organizer?.socialMedia?.whatsapp || "";
    getEl("org-social-li").value = s.organizer?.socialMedia?.linkedin || "";

    getEl("org-event-name").value = s.eventInfo?.name || "";
    getEl("org-event-desc").value = s.eventInfo?.description || "";
    getEl("org-event-outro").value = s.eventInfo?.outroMessage || "";

    getEl("org-freebies-enabled").checked = Boolean(s.freebies?.enabled);
    const links = Array.isArray(s.freebies?.links) ? s.freebies.links : [];
    getEl("org-freebies-links").value = links.join("\n");

    getEl("org-attendance-size").value = String(s.attendance?.expectedSize ?? 80);
    getEl("org-attendance-desc").value = s.attendance?.crowdDescription || "";

    const suggestions = Array.isArray(s.questionRoutes?.suggestions) ? s.questionRoutes.suggestions : [];
    for (let i = 0; i < 8; i += 1) {
      const input = getEl(`org-route-${i}`);
      if (input) input.value = suggestions[i] || "";
    }
    getEl("org-crowd-cues").value = s.questionRoutes?.crowdCues || "";
    const genStyle = getEl("org-route-gen-style");
    if (genStyle) genStyle.value = s.questionRoutes?.generationStyleNotes || "";
    const routesCatalogEl = getEl("org-icebreaker-routes-json");
    if (routesCatalogEl) {
      routesCatalogEl.value =
        s.icebreakerRoutes && typeof s.icebreakerRoutes === "object"
          ? JSON.stringify(s.icebreakerRoutes, null, 2)
          : "";
    }
    const meetupSpaces = Array.isArray(s.physicalMeetup?.spaces) ? s.physicalMeetup.spaces : [];
    const meetupSigns = Array.isArray(s.physicalMeetup?.signs?.options) ? s.physicalMeetup.signs.options : [];
    getEl("org-meetup-enabled").checked = s.physicalMeetup?.enabled !== false;
    getEl("org-meetup-spaces").value = meetupSpaces.join("\n");
    getEl("org-meetup-signs-enabled").checked = s.physicalMeetup?.signs?.enabled !== false;
    getEl("org-meetup-sign-options").value = meetupSigns.join("\n");
    getEl("org-meetup-wearable-prompt").value = s.physicalMeetup?.wearablePrompt || "";

    const onb = s.parameters?.onboarding || {};
    getEl("org-req-offers").value = String(onb.requiredOfferTags ?? 3);
    getEl("org-req-seeks").value = String(onb.requiredSeekTags ?? 3);
    getEl("org-req-icebreaker").value = String(onb.requiredIcebreakerAnswers ?? 3);
    getEl("org-req-routes").value = String(onb.requiredAssignedRoutesPerParticipant ?? 3);
    getEl("org-resume-timeout").value = String(onb.onboardingResumeTimeoutSeconds ?? 180);

    const m = s.parameters?.matching || {};
    getEl("org-room-threshold").value = String(m.roomSizeStrictModeThreshold ?? 100);
    getEl("org-strict-coverage").value = String(m.strictCoverageTargetPercent ?? 100);
    getEl("org-relaxed-coverage").value = String(m.relaxedCoverageTargetPercent ?? 92);
    getEl("org-wave-interval").value = String(m.waveIntervalMinutes ?? 15);
    getEl("org-wave-size").value = String(m.waveSizeLimit ?? 5);
    getEl("org-target-suggestions").value = String(m.targetSuggestionsPerUser ?? 5);
    getEl("org-diversity-min").value = String(m.diversity?.minDominantRoutes ?? 3);
    getEl("org-diversity-max").value = String(m.diversity?.maxSuggestionsPerDominantRoute ?? 2);
    getEl("org-repeat-allow").checked = m.repeatPolicy?.allowAcrossWaves !== false;
    getEl("org-repeat-cooldown").value = String(m.repeatPolicy?.cooldownWaves ?? 2);

    const w = m.scoring?.weights || {};
    getEl("org-weight-t1").value = String(w.tier1 ?? 3);
    getEl("org-weight-t2").value = String(w.tier2 ?? 2);
    getEl("org-weight-t3").value = String(w.tier3 ?? 2);
    getEl("org-weight-rarity").value = String(w.rarityBonus ?? 5);
    getEl("org-weight-freetext").value = String(w.freeTextSemanticBonus ?? 5);
    getEl("org-start-scoring-min").value = String(m.scoring?.startScoringMinParticipants ?? 40);
    getEl("org-floor-strategy").value = m.scoring?.minMatchFloorStrategy || "";
    getEl("org-lowconf-fewer").checked = m.scoring?.lowConfidenceHandling?.showFewerByDefault !== false;
    getEl("org-lowconf-label").checked = m.scoring?.lowConfidenceHandling?.labelWhenShown !== false;

    const p = s.parameters?.privacy || {};
    getEl("org-privacy-double").checked = p.requireDoubleOptIn !== false;
    getEl("org-privacy-reveal").value = p.primaryRevealChannel || "whatsapp";
    getEl("org-privacy-delete-hours").value = String(p.autoDeleteDefaultHoursAfterEvent ?? 24);
    getEl("org-privacy-audit").checked = p.requireConsentAuditTrail !== false;
  };

  const resolveInitialSection = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const querySection = urlParams.get("section");
    if (querySection) {
      const fromQuery = querySection.startsWith("section-") ? querySection : `section-${querySection}`;
      if (sectionPanels.some((panel) => panel.id === fromQuery)) {
        return fromQuery;
      }
    }
    const storedSection = localStorage.getItem(ORGANIZER_SECTION_KEY);
    if (storedSection && sectionPanels.some((panel) => panel.id === storedSection)) {
      return storedSection;
    }
    return "section-organizer";
  };

  const setActiveSection = (sectionId, syncUrl = true) => {
    if (!sectionPanels.some((panel) => panel.id === sectionId)) {
      return;
    }
    activeSectionId = sectionId;
    localStorage.setItem(ORGANIZER_SECTION_KEY, sectionId);
    sectionPanels.forEach((panel) => {
      const isActive = panel.id === sectionId;
      panel.hidden = !isActive;
      panel.classList.toggle("is-active", isActive);
    });
    [...desktopTabButtons, ...mobileLinks].forEach((button) => {
      const isActive = button.dataset.sectionTarget === sectionId;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-selected", isActive ? "true" : "false");
    });
    if (syncUrl) {
      const url = new URL(window.location.href);
      const shortSection = sectionId.replace(/^section-/, "");
      url.searchParams.set("section", shortSection);
      window.history.replaceState(null, "", url.toString());
    }
  };

  const bindSectionNav = () => {
    const allNavButtons = [...desktopTabButtons, ...mobileLinks];
    allNavButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const target = button.dataset.sectionTarget;
        if (!target) return;
        setActiveSection(target);
        if (mobileMenu) mobileMenu.hidden = true;
      });
    });
    if (mobileMenuToggle && mobileMenu) {
      mobileMenuToggle.addEventListener("click", () => {
        mobileMenu.hidden = !mobileMenu.hidden;
      });
    }
    setActiveSection(resolveInitialSection(), false);
  };

  const readInt = (id, fallback) => {
    const v = parseInt(getEl(id).value, 10);
    return Number.isFinite(v) ? v : fallback;
  };

  const parseIcebreakerRoutesTextarea = () => {
    const el = getEl("org-icebreaker-routes-json");
    if (!el) return null;
    const raw = String(el.value || "").trim();
    if (!raw) return null;
    return JSON.parse(raw);
  };

  const collectFromForm = (previous) => {
    const base = deepMerge(defaultOrganizerSettingsShape(), previous || {});
    const freebieLines = getEl("org-freebies-links")
      .value.split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    let icebreakerRoutes;
    try {
      icebreakerRoutes = parseIcebreakerRoutesTextarea();
    } catch (_e) {
      throw new Error("Published icebreaker routes JSON is invalid. Fix it or clear the field.");
    }
    const suggestions = [];
    for (let i = 0; i < 8; i += 1) {
      suggestions.push((getEl(`org-route-${i}`).value || "").trim());
    }
    const meetupSpaces = getEl("org-meetup-spaces")
      .value.split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const meetupSigns = getEl("org-meetup-sign-options")
      .value.split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    return {
      organizer: {
        creds: {
          email: getEl("org-email").value.trim(),
          google: base.organizer?.creds?.google || {
            enabled: false,
            clientEmail: "",
            privateKey: "",
            spreadsheetId: "",
            folderPath: "",
          },
        },
        llm: {
          provider: (() => {
            const sel = getEl("org-llm-provider");
            const v = sel instanceof HTMLSelectElement ? sel.value : "none";
            const allowed = new Set(["none", "openai", "anthropic", "gemini", "deepseek"]);
            return allowed.has(v) ? v : "none";
          })(),
          apiKeys: {
            openai: getEl("org-llm-key-openai")?.value?.trim() || "",
            anthropic: getEl("org-llm-key-anthropic")?.value?.trim() || "",
            gemini: getEl("org-llm-key-gemini")?.value?.trim() || "",
            deepseek: getEl("org-llm-key-deepseek")?.value?.trim() || "",
          },
        },
        socialMedia: {
          instagram: getEl("org-social-ig").value.trim(),
          whatsapp: getEl("org-social-wa").value.trim(),
          linkedin: getEl("org-social-li").value.trim(),
        },
      },
      eventInfo: {
        ...base.eventInfo,
        name: getEl("org-event-name").value.trim(),
        description: getEl("org-event-desc").value,
        outroMessage: getEl("org-event-outro").value,
      },
      freebies: {
        enabled: getEl("org-freebies-enabled").checked,
        links: freebieLines,
      },
      attendance: {
        expectedSize: readInt("org-attendance-size", base.attendance.expectedSize),
        crowdDescription: getEl("org-attendance-desc").value,
      },
      questionRoutes: {
        suggestions,
        crowdCues: getEl("org-crowd-cues").value,
        generationStyleNotes: getEl("org-route-gen-style") ? getEl("org-route-gen-style").value.trim() : "",
      },
      icebreakerRoutes,
      physicalMeetup: {
        enabled: getEl("org-meetup-enabled").checked,
        spaces: meetupSpaces.length > 0 ? meetupSpaces : base.physicalMeetup.spaces,
        signs: {
          enabled: getEl("org-meetup-signs-enabled").checked,
          options: meetupSigns.length > 0 ? meetupSigns : base.physicalMeetup.signs.options,
        },
        wearablePrompt:
          getEl("org-meetup-wearable-prompt").value.trim() || base.physicalMeetup.wearablePrompt,
      },
      parameters: {
        onboarding: {
          requiredOfferTags: readInt("org-req-offers", base.parameters.onboarding.requiredOfferTags),
          requiredSeekTags: readInt("org-req-seeks", base.parameters.onboarding.requiredSeekTags),
          requiredIcebreakerAnswers: readInt(
            "org-req-icebreaker",
            base.parameters.onboarding.requiredIcebreakerAnswers
          ),
          requiredAssignedRoutesPerParticipant: readInt(
            "org-req-routes",
            base.parameters.onboarding.requiredAssignedRoutesPerParticipant
          ),
          onboardingResumeTimeoutSeconds: readInt(
            "org-resume-timeout",
            base.parameters.onboarding.onboardingResumeTimeoutSeconds
          ),
        },
        matching: {
          roomSizeStrictModeThreshold: readInt(
            "org-room-threshold",
            base.parameters.matching.roomSizeStrictModeThreshold
          ),
          strictCoverageTargetPercent: readInt(
            "org-strict-coverage",
            base.parameters.matching.strictCoverageTargetPercent
          ),
          relaxedCoverageTargetPercent: readInt(
            "org-relaxed-coverage",
            base.parameters.matching.relaxedCoverageTargetPercent
          ),
          waveIntervalMinutes: readInt("org-wave-interval", base.parameters.matching.waveIntervalMinutes),
          waveSizeLimit: readInt("org-wave-size", base.parameters.matching.waveSizeLimit),
          targetSuggestionsPerUser: readInt(
            "org-target-suggestions",
            base.parameters.matching.targetSuggestionsPerUser
          ),
          diversity: {
            minDominantRoutes: readInt("org-diversity-min", base.parameters.matching.diversity.minDominantRoutes),
            maxSuggestionsPerDominantRoute: readInt(
              "org-diversity-max",
              base.parameters.matching.diversity.maxSuggestionsPerDominantRoute
            ),
          },
          repeatPolicy: {
            allowAcrossWaves: getEl("org-repeat-allow").checked,
            cooldownWaves: readInt("org-repeat-cooldown", base.parameters.matching.repeatPolicy.cooldownWaves),
          },
          scoring: {
            weights: {
              tier1: readInt("org-weight-t1", base.parameters.matching.scoring.weights.tier1),
              tier2: readInt("org-weight-t2", base.parameters.matching.scoring.weights.tier2),
              tier3: readInt("org-weight-t3", base.parameters.matching.scoring.weights.tier3),
              rarityBonus: readInt("org-weight-rarity", base.parameters.matching.scoring.weights.rarityBonus),
              freeTextSemanticBonus: readInt(
                "org-weight-freetext",
                base.parameters.matching.scoring.weights.freeTextSemanticBonus
              ),
            },
            startScoringMinParticipants: readInt(
              "org-start-scoring-min",
              base.parameters.matching.scoring.startScoringMinParticipants
            ),
            minMatchFloorStrategy: getEl("org-floor-strategy").value.trim(),
            lowConfidenceHandling: {
              showFewerByDefault: getEl("org-lowconf-fewer").checked,
              labelWhenShown: getEl("org-lowconf-label").checked,
            },
          },
        },
        privacy: {
          requireDoubleOptIn: getEl("org-privacy-double").checked,
          primaryRevealChannel: getEl("org-privacy-reveal").value,
          autoDeleteDefaultHoursAfterEvent: readInt(
            "org-privacy-delete-hours",
            base.parameters.privacy.autoDeleteDefaultHoursAfterEvent
          ),
          requireConsentAuditTrail: getEl("org-privacy-audit").checked,
        },
      },
    };
  };

  const selectedRouteSlots = () => {
    const rows = [];
    for (let i = 0; i < 8; i += 1) {
      const input = getEl(`org-route-${i}`);
      const checkbox = getEl(`org-route-generate-${i}`);
      if (!input || !checkbox) continue;
      if (!checkbox.checked) continue;
      rows.push({ index: i, topic: String(input.value || "").trim() });
    }
    return rows.filter((entry) => entry.topic.length > 0);
  };

  const refreshJsonFromSettings = (settings) => {
    if (!(jsonArea instanceof HTMLTextAreaElement)) return;
    jsonArea.value = JSON.stringify(settings, null, 2);
  };

  let lastLoaded = null;

  const load = async () => {
    try {
      const payload = await apiFetch("/api/organizer/settings", { method: "GET" });
      lastLoaded = payload.settings;
      applyToForm(lastLoaded);
      refreshJsonFromSettings(lastLoaded);
      applyEventsToSwitcher(payload.events, payload.activeEventKey);
      diskMessage(payload, "Settings loaded.", "success");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to load settings.", "error");
    }
  };

  if (reloadBtn) reloadBtn.addEventListener("click", () => load());

  const llmProviderSel = getEl("org-llm-provider");
  if (llmProviderSel instanceof HTMLSelectElement) {
    llmProviderSel.addEventListener("change", () => syncLlmCredentialVisibility());
  }

  if (jsonRefreshBtn) {
    jsonRefreshBtn.addEventListener("click", () => {
      try {
        const settings = collectFromForm(lastLoaded || defaultOrganizerSettingsShape());
        refreshJsonFromSettings(settings);
        setStatus("JSON refreshed from current form values.", "success");
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Could not build JSON from form.", "error");
      }
    });
  }

  if (jsonApplyBtn && jsonArea instanceof HTMLTextAreaElement) {
    jsonApplyBtn.addEventListener("click", () => {
      try {
        const parsed = JSON.parse(jsonArea.value || "{}");
        const merged = deepMerge(defaultOrganizerSettingsShape(), parsed || {});
        lastLoaded = merged;
        applyToForm(merged);
        refreshJsonFromSettings(merged);
        setStatus("JSON applied to form.", "success");
      } catch (_error) {
        setStatus("Invalid JSON. Please fix formatting and try again.", "error");
      }
    });
  }

  if (generateRoutesBtn) {
    generateRoutesBtn.addEventListener("click", async () => {
      const selected = selectedRouteSlots();
      if (selected.length < 1) {
        setStatus("Select at least one route checkbox with a route topic.", "error");
        return;
      }
      generateRoutesBtn.disabled = true;
      setStatus("Generating routes…", "info");
      try {
        const payload = await apiFetch("/api/organizer/routes/generate", {
          method: "POST",
          body: JSON.stringify({
            selectedTopics: selected.map((entry) => entry.topic),
            crowdCues: getEl("org-crowd-cues").value,
            eventDescription: getEl("org-event-desc").value,
            generationStyleNotes: getEl("org-route-gen-style") ? getEl("org-route-gen-style").value : "",
          }),
        });
        const generatedCatalog = payload.generatedCatalog || {};
        const routes = Array.isArray(generatedCatalog.routes) ? generatedCatalog.routes : [];
        selected.forEach((slot, idx) => {
          const generatedRoute = routes[idx];
          if (!generatedRoute || !generatedRoute.routeId) return;
          const input = getEl(`org-route-${slot.index}`);
          if (input) input.value = String(generatedRoute.routeId);
        });
        const routesCatalogEl = getEl("org-icebreaker-routes-json");
        if (routesCatalogEl) {
          routesCatalogEl.value = JSON.stringify(generatedCatalog, null, 2);
        }
        const warn = payload.draftValidationWarning;
        const diskWarn = payload.diskWriteOk === false;
        setActiveSection("section-routes");
        const baseMsg = warn
          ? `Generated ${routes.length} route(s). Draft saved; validation note: ${warn}`
          : `Generated ${routes.length} route definition${routes.length === 1 ? "" : "s"}. Draft saved on server — review JSON, then Publish or Save.`;
        const msg =
          diskWarn && !warn
            ? `${baseMsg} Note: disk store unavailable; draft may not persist.`
            : diskWarn && warn
              ? `${baseMsg} Disk store may be unavailable.`
              : baseMsg;
        setStatus(msg, warn || diskWarn ? "error" : "success");
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Route generation failed.", "error");
      } finally {
        generateRoutesBtn.disabled = false;
      }
    });
  }

  if (publishRoutesBtn) {
    publishRoutesBtn.addEventListener("click", async () => {
      let catalog;
      try {
        catalog = parseIcebreakerRoutesTextarea();
      } catch (_e) {
        setStatus(
          "Fix the icebreaker routes JSON before publishing. Clear the field completely if you intend to publish the last server-generated draft instead.",
          "error"
        );
        return;
      }
      publishRoutesBtn.disabled = true;
      setStatus("Publishing routes…", "info");
      try {
        const body = catalog && typeof catalog === "object" ? { catalog } : {};
        const result = await apiFetch("/api/organizer/routes/publish", {
          method: "POST",
          body: JSON.stringify(body),
        });
        applyServerOrganizerPayload(result);
        diskMessage(result, "Routes published. Attendees will receive this catalog on the next route load.", "success");
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Publish failed.", "error");
      } finally {
        publishRoutesBtn.disabled = false;
      }
    });
  }

  if (rollbackRoutesBtn) {
    rollbackRoutesBtn.addEventListener("click", async () => {
      rollbackRoutesBtn.disabled = true;
      setStatus("Rolling back routes…", "info");
      try {
        const result = await apiFetch("/api/organizer/routes/rollback", { method: "POST", body: "{}" });
        applyServerOrganizerPayload(result);
        diskMessage(result, "Rolled back to the previous published route catalog.", "success");
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Rollback failed.", "error");
      } finally {
        rollbackRoutesBtn.disabled = false;
      }
    });
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    let settings;
    try {
      settings = collectFromForm(lastLoaded || defaultOrganizerSettingsShape());
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Invalid form data.", "error");
      return;
    }
    try {
      const result = await apiFetch("/api/organizer/settings", {
        method: "POST",
        body: JSON.stringify({ settings }),
      });
      applyServerOrganizerPayload(result);
      diskMessage(result, "Event settings saved.", "success");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Save failed.", "error");
    }
  });

  if (eventSelect instanceof HTMLSelectElement) {
    eventSelect.addEventListener("change", async () => {
      if (eventSelectProgrammatic) return;
      const eventKey = eventSelect.value;
      if (!eventKey) return;
      setStatus("Switching event…", "info");
      try {
        const result = await apiFetch("/api/organizer/events/select", {
          method: "POST",
          body: JSON.stringify({ eventKey }),
        });
        applyServerOrganizerPayload(result);
        diskMessage(result, "Active event updated.", "success");
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Could not switch event.", "error");
        await load();
      }
    });
  }

  if (eventNewBtn) {
    eventNewBtn.addEventListener("click", async () => {
      const name = window.prompt("Name for the new event?", "New event");
      if (name == null) return;
      const trimmed = String(name).trim();
      if (!trimmed) return;
      setStatus("Creating event…", "info");
      try {
        const result = await apiFetch("/api/organizer/events", {
          method: "POST",
          body: JSON.stringify({ name: trimmed }),
        });
        applyServerOrganizerPayload(result);
        diskMessage(result, "New event created and selected.", "success");
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Create event failed.", "error");
      }
    });
  }

  if (eventCloneBtn) {
    eventCloneBtn.addEventListener("click", async () => {
      if (!window.confirm("Clone the active event into a new draft?")) return;
      setStatus("Cloning event…", "info");
      try {
        const result = await apiFetch("/api/organizer/events/clone", { method: "POST", body: "{}" });
        applyServerOrganizerPayload(result);
        diskMessage(result, "Event cloned.", "success");
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Clone failed.", "error");
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      try {
        await apiFetch("/api/organizer/logout", { method: "POST", body: "{}" });
      } catch (_error) {
        /* still clear local session */
      }
      try {
        sessionStorage.removeItem(ORGANIZER_SESSION_KEY);
      } catch (_error) {
        /* ignore */
      }
      navigate("./organizer-login.html");
    });
  }

  bindSectionNav();
  load();
};

if (ensureStep()) {
  if (page === "auth") bindAuthPage();
  if (page === "profile") bindProfilePage();
  if (page === "questions") bindQuestionsPage();
  if (page === "consent") bindConsentPage();
  if (page === "queue") bindQueuePage();
  if (page === "vault") bindVaultPage();
  if (page === "organizer") bindOrganizerPage();
  if (page === "organizer-login") bindOrganizerLoginPage();
}
