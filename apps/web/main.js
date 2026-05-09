const REQUIRED_ASSIGNED_ROUTES = 3;

const API_BASE_URL = (window.API_BASE_URL || "http://127.0.0.1:8787").replace(/\/$/, "");
const STORAGE_KEY = "nexuslink-web-state-v2";
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
  assignedRouteIds: [],
  routeCatalogVersion: null,
  consent: null,
  onboardingComplete: false,
  wave: null,
  actions: [],
};

const loadState = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    return { ...defaultState, ...(parsed || {}) };
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

const ensureStep = () => {
  if (page !== "auth" && !state.auth) navigate("./index.html");
  if (["questions", "consent", "queue", "vault"].includes(page) && !state.profile) navigate("./profile.html");
  if (["consent", "queue", "vault"].includes(page) && state.icebreakerResponses.length < 3) navigate("./questions.html");
  if (["queue", "vault"].includes(page) && !state.onboardingComplete) navigate("./consent.html");
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
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (state.userId) headers["X-User-Id"] = state.userId;
  const response = await fetch(url, { ...options, headers });
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

const renderRouteBuilder = (container, route, existing = null) => {
  const card = document.createElement("div");
  card.className = "question-row";
  card.dataset.routeId = route.routeId;
  card.innerHTML = `
    <h3>${route.title}</h3>
    <label>${route.tier1Prompt}
      <select data-field="tier1">
        <option value="">Select an option</option>
        ${route.tier1Options
          .map((opt) => `<option value="${opt.code}">${opt.label}</option>`)
          .join("")}
      </select>
    </label>
    <div data-slot="tier2"></div>
    <div data-slot="tier3"></div>
    <label data-slot="freeText"><span data-field="freeTextLabel">${route.freeTextPrompt || "Optional: share one specific example"}</span>
      <input data-field="freeText" placeholder="Optional free text" />
    </label>
  `;
  container.appendChild(card);

  const tier1Select = card.querySelector("select[data-field='tier1']");
  const tier2Slot = card.querySelector("[data-slot='tier2']");
  const tier3Slot = card.querySelector("[data-slot='tier3']");
  const freeTextInput = card.querySelector("input[data-field='freeText']");

  const renderTier2 = () => {
    tier2Slot.innerHTML = "";
    tier3Slot.innerHTML = "";
    const tier1Value = tier1Select.value;
    if (!tier1Value) return;
    const tier1Option = route.tier1Options.find((opt) => opt.code === tier1Value);
    if (!tier1Option) return;
    const label = document.createElement("label");
    label.textContent = tier1Option.tier2Prompt;
    const select = document.createElement("select");
    select.dataset.field = "tier2";
    select.innerHTML = `<option value="">Select an option</option>${tier1Option.tier2Options
      .map((opt) => `<option value="${opt}">${opt.replace(/_/g, " ")}</option>`)
      .join("")}`;
    label.appendChild(select);
    tier2Slot.appendChild(label);
    select.addEventListener("change", () => renderTier3(tier1Option, select.value));
    if (existing?.tier2) {
      select.value = existing.tier2;
      renderTier3(tier1Option, existing.tier2, existing.tier3 || []);
    }
  };

  const renderTier3 = (tier1Option, tier2Value, existingTier3 = []) => {
    tier3Slot.innerHTML = "";
    if (!tier2Value) return;
    const tier3ByTier2 = tier1Option.tier3ByTier2 || {};
    const questions = tier3ByTier2[tier2Value] || [];
    questions.forEach((question, index) => {
      const label = document.createElement("label");
      label.textContent = question.prompt;
      const select = document.createElement("select");
      select.dataset.field = `tier3-${index}`;
      select.innerHTML = `<option value="">Select an option</option>${question.options
        .map((opt) => `<option value="${opt}">${opt.replace(/_/g, " ")}</option>`)
        .join("")}`;
      if (existingTier3[index]) select.value = existingTier3[index];
      label.appendChild(select);
      tier3Slot.appendChild(label);
    });
    const override = tier1Option.freeTextPromptOverride || route.freeTextPrompt || "Optional free text";
    const freeTextLabel = card.querySelector("[data-field='freeTextLabel']");
    if (freeTextLabel) freeTextLabel.textContent = override;
  };

  tier1Select.addEventListener("change", renderTier2);

  if (existing) {
    tier1Select.value = existing.tier1 || "";
    freeTextInput.value = existing.freeText || "";
    renderTier2();
  }
};

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
  state.actions.forEach((entry) => {
    const candidate = state.wave?.candidates.find((item) => item.profile.id === entry.userId);
    const item = document.createElement("li");
    item.className = "vault-item";
    if (!candidate) {
      item.textContent = `${entry.action} recorded for ${entry.userId}.`;
    } else if (entry.action === "like" && entry.userId === "u2") {
      item.textContent = `Mutual like with ${candidate.profile.fullName}. WhatsApp unlocked: ${candidate.profile.phone}`;
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
    navigate("./profile.html?step=02_details_gathering");
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
    try {
      const session = await apiFetch("/api/auth/session", {
        method: "POST",
        body: JSON.stringify({ provider, eventId: state.eventId || undefined }),
      });
      saveBootstrap(provider, session);
      setStatus(`Signed in with ${provider}.`, "success");
      continueToDetailsGathering();
    } catch (error) {
      const reason = error instanceof Error ? error.message : `${provider} sign-in failed.`;
      if (provider === "linkedin") {
        showGoogleFallback(`${reason} Continue with Google.`);
      } else {
        showManualFallback(`${reason} Continue with manual entry.`);
      }
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
  if (!form) return;

  let selectedOffers = [];
  let selectedSeeks = [];

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
    document.getElementById("full-name").value = state.profile.fullName || "";
    document.getElementById("role").value = state.profile.role || "";
    document.getElementById("company").value = state.profile.company || "";
    document.getElementById("email").value = state.profile.email || "";
    document.getElementById("whatsapp").value = state.profile.whatsapp || "";
    selectedOffers = Array.isArray(state.profile.offers) ? state.profile.offers : [];
    selectedSeeks = Array.isArray(state.profile.seeks) ? state.profile.seeks : [];
    renderTagSelection();
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
  const form = document.getElementById("questionnaire-form");
  const list = document.getElementById("question-list");
  if (!form || !list) return;

  const hydrate = async () => {
    try {
      const catalog = await apiFetch("/api/routes/catalog", { method: "GET" });
      const routes = Array.isArray(catalog.routes) ? catalog.routes : [];
      if (routes.length === 0) {
        setStatus("No route catalog available.", "error");
        return;
      }
      state.routeCatalogVersion = catalog.version || "v1";
      if (!Array.isArray(state.assignedRouteIds) || state.assignedRouteIds.length !== REQUIRED_ASSIGNED_ROUTES) {
        state.assignedRouteIds = shuffle(routes.map((r) => r.routeId)).slice(0, REQUIRED_ASSIGNED_ROUTES);
      }
      const assignedRoutes = state.assignedRouteIds
        .map((id) => routes.find((route) => route.routeId === id))
        .filter(Boolean);
      const existingByRoute = new Map(
        (state.icebreakerResponses || []).map((entry) => [entry.routeId, entry])
      );
      list.innerHTML = "";
      assignedRoutes.forEach((route) => {
        renderRouteBuilder(list, route, existingByRoute.get(route.routeId));
      });
      saveState(state);
      setStatus(`Complete ${REQUIRED_ASSIGNED_ROUTES} routes to continue.`, "info");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to load route catalog.", "error");
    }
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const cards = Array.from(list.querySelectorAll("[data-route-id]"));
    const responses = [];

    for (const card of cards) {
      const routeId = card.dataset.routeId;
      const tier1 = card.querySelector("select[data-field='tier1']")?.value || "";
      const tier2 = card.querySelector("select[data-field='tier2']")?.value || "";
      const tier3 = Array.from(card.querySelectorAll("select[data-field^='tier3-']"))
        .map((input) => input.value)
        .filter(Boolean);
      const freeText = card.querySelector("input[data-field='freeText']")?.value.trim() || "";
      if (!routeId || !tier1 || !tier2 || tier3.length < 2) {
        setStatus("Please answer all required route selections.", "error");
        return;
      }
      responses.push({
        questionId: `${routeId}:${tier1}:${tier2}`,
        answer: `${tier1} > ${tier2} > ${tier3.join(", ")}`,
        routeId,
        tier1,
        tier2,
        tier3,
        freeText,
        answeredAt: new Date().toISOString(),
      });
    }

    if (responses.length < REQUIRED_ASSIGNED_ROUTES) {
      setStatus(`Answer all ${REQUIRED_ASSIGNED_ROUTES} assigned routes.`, "error");
      return;
    }

    try {
      await apiFetch("/api/onboarding/questions", {
        method: "POST",
        body: JSON.stringify({ icebreakerResponses: responses }),
      });
      state.icebreakerResponses = responses;
      state.answers = responses.map((response) => response.answer);
      saveState(state);
      navigate("./consent.html");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Questionnaire save failed.", "error");
    }
  });

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
  renderVault();
};

ensureStep();
if (page === "auth") bindAuthPage();
if (page === "profile") bindProfilePage();
if (page === "questions") bindQuestionsPage();
if (page === "consent") bindConsentPage();
if (page === "queue") bindQueuePage();
if (page === "vault") bindVaultPage();
