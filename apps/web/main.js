const ICEBREAKER_QUESTIONS = [
  "What is one meaningful outcome you want from this event?",
  "Which industry trend are you watching most closely this year?",
  "What type of collaboration are you open to right now?",
  "What is your strongest superpower in your current role?",
  "What challenge are you actively trying to solve this quarter?",
  "Which market or customer segment are you focused on?",
  "What does a great intro look like for you?",
  "What kind of partner would be most valuable to meet here?",
  "What signal tells you a project has strong execution potential?",
  "What is one lesson from a recent failure you now apply often?",
  "Which metric matters most in your current work?",
  "What capability are you looking to add to your team?",
  "What topic can you discuss for hours with high energy?",
];

const API_BASE_URL = (window.API_BASE_URL || "http://127.0.0.1:8787").replace(/\/$/, "");
const STORAGE_KEY = "nexuslink-web-state-v2";

const defaultState = {
  auth: null,
  userId: null,
  profile: null,
  answers: [],
  consent: null,
  onboardingComplete: false,
  wave: null,
  actions: [],
};

const parseTags = (raw) =>
  raw
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

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

const ensureStep = () => {
  if (page !== "auth" && !state.auth) navigate("./index.html");
  if (["questions", "consent", "queue", "vault"].includes(page) && !state.profile) navigate("./profile.html");
  if (["consent", "queue", "vault"].includes(page) && state.answers.length < 3) navigate("./questions.html");
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

const renderQuestions = () => {
  const list = document.getElementById("question-list");
  if (!list) return;
  list.innerHTML = "";
  ICEBREAKER_QUESTIONS.forEach((question, index) => {
    const row = document.createElement("div");
    row.className = "question-row";
    const existing = state.answers[index] || "";
    row.innerHTML = `<label>Q${index + 1}. ${question}<input data-question-index="${index}" value="${existing}" placeholder="Optional answer" /></label>`;
    list.appendChild(row);
  });
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
  const form = document.getElementById("auth-form");
  if (!form) return;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const provider = document.getElementById("provider").value;
    const demoMode = document.getElementById("demo-mode").checked;
    if (provider !== "google" && !demoMode) {
      setStatus("LinkedIn requires demo mode in MVP.", "error");
      return;
    }
    try {
      const session = await apiFetch("/api/auth/session", { method: "POST", body: JSON.stringify({ provider, demoMode }) });
      state.auth = { provider, demoMode };
      state.userId = session.userId;
      saveState(state);
      setStatus("Auth complete.", "success");
      navigate("./profile.html");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Auth failed.", "error");
    }
  });
};

const bindProfilePage = () => {
  const form = document.getElementById("profile-form");
  if (!form) return;
  if (state.profile) {
    document.getElementById("full-name").value = state.profile.fullName || "";
    document.getElementById("role").value = state.profile.role || "";
    document.getElementById("company").value = state.profile.company || "";
    document.getElementById("whatsapp").value = state.profile.whatsapp || "";
    document.getElementById("offer-tags").value = (state.profile.offers || []).join(", ");
    document.getElementById("seek-tags").value = (state.profile.seeks || []).join(", ");
  }
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const offers = parseTags(document.getElementById("offer-tags").value);
    const seeks = parseTags(document.getElementById("seek-tags").value);
    if (offers.length !== 3 || seeks.length !== 3) {
      setStatus("Enter exactly 3 offer and 3 seek tags.", "error");
      return;
    }
    const profile = {
      userId: state.userId,
      fullName: document.getElementById("full-name").value.trim(),
      name: document.getElementById("full-name").value.trim(),
      role: document.getElementById("role").value.trim(),
      company: document.getElementById("company").value.trim(),
      whatsapp: document.getElementById("whatsapp").value.trim(),
      offers,
      seeks,
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
  if (!form) return;
  renderQuestions();
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const answers = Array.from(document.querySelectorAll("input[data-question-index]"))
      .map((input) => input.value.trim())
      .filter(Boolean);
    if (answers.length < 3) {
      setStatus("Answer at least 3 questions.", "error");
      return;
    }
    try {
      await apiFetch("/api/onboarding/questions", { method: "POST", body: JSON.stringify({ answers }) });
      state.answers = answers;
      saveState(state);
      navigate("./consent.html");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Questionnaire save failed.", "error");
    }
  });
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
          whatsapp: state.profile.whatsapp,
          answers: state.answers,
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
