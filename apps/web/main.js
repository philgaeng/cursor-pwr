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

const state = {
  auth: null,
  userId: null,
  profile: null,
  answers: [],
  consent: null,
  onboardingComplete: false,
  wave: null,
  actions: new Map(),
};

const authForm = document.getElementById("auth-form");
const profileForm = document.getElementById("profile-form");
const questionnaireForm = document.getElementById("questionnaire-form");
const consentForm = document.getElementById("consent-form");
const questionList = document.getElementById("question-list");
const waveStatus = document.getElementById("wave-status");
const appStatus = document.getElementById("app-status");
const matchList = document.getElementById("match-list");
const connectionsList = document.getElementById("connections-list");
const loadWaveButton = document.getElementById("load-wave");
const triggerWaveButton = document.getElementById("trigger-wave");

const parseTags = (raw) =>
  raw
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

const normalizeWave = (wave) => {
  if (!wave) {
    return null;
  }
  if (wave.id && Array.isArray(wave.candidates) && wave.candidates[0]?.profile) {
    return wave;
  }
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
        role: "attendee",
        whatIOffer: [],
        whatISeek: [],
      },
      matchReason: Array.isArray(candidate.reasons) ? candidate.reasons.join(" • ") : candidate.reason,
      score: candidate.compatibilityScore ?? 0.5,
    })),
  };
};

const setStatus = (message, type = "info") => {
  appStatus.textContent = message;
  appStatus.className = "";
  if (type === "error") {
    appStatus.classList.add("status-error");
  } else if (type === "success") {
    appStatus.classList.add("status-success");
  }
};

const renderQuestions = () => {
  questionList.innerHTML = "";
  ICEBREAKER_QUESTIONS.forEach((question, index) => {
    const row = document.createElement("div");
    row.className = "question-row";
    row.innerHTML = `
      <label>
        Q${index + 1}. ${question}
        <input data-question-index="${index}" placeholder="Optional answer" />
      </label>
    `;
    questionList.appendChild(row);
  });
};

const mockWave = () => ({
  id: `wave-${Date.now()}`,
  eventId: "demo-event-2026",
  sentAtIso: new Date().toISOString(),
  candidates: [
    {
      profile: {
        id: "u2",
        fullName: "Elena Park",
        headline: "Investor at Green VC",
        company: "Green VC",
        phone: "+65 8111 1111",
        role: "attendee",
        whatIOffer: ["Funding", "Mentorship", "Climate Network"],
        whatISeek: ["Dealflow", "Founders", "Partnerships"],
      },
      matchReason: "Climate founder-investor fit • Shared interest in pilot programs",
      score: 0.93,
    },
    {
      profile: {
        id: "u3",
        fullName: "Daniel Ng",
        headline: "Frontend Engineer at Flow Apps",
        company: "Flow Apps",
        phone: "+65 8222 2222",
        role: "attendee",
        whatIOffer: ["Frontend Architecture", "Product UI", "Hiring Advice"],
        whatISeek: ["Partnerships", "Co-founders", "Advisors"],
      },
      matchReason: "Product partnership overlap • Hiring and advisory interests align",
      score: 0.86,
    },
    {
      profile: {
        id: "u4",
        fullName: "Sophia Tan",
        headline: "Operator at Scale Studio",
        company: "Scale Studio",
        phone: "+65 8333 3333",
        role: "attendee",
        whatIOffer: ["Go-to-market", "B2B Sales", "Ops Scaling"],
        whatISeek: ["Product Teams", "Investors", "Distribution Partners"],
      },
      matchReason: "Go-to-market experience • Mutual B2B SaaS network goals",
      score: 0.82,
    },
  ],
});

const apiFetch = async (path, options = {}) => {
  const requestUrl = path.startsWith("http") ? path : `${API_BASE_URL}${path}`;
  const requestHeaders = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  if (state.userId) {
    requestHeaders["X-User-Id"] = state.userId;
  }
  try {
    const response = await fetch(requestUrl, {
      headers: requestHeaders,
      ...options,
    });
    if (!response.ok) {
      let apiError = `Request failed: ${response.status}`;
      try {
        const errorPayload = await response.json();
        if (typeof errorPayload?.error === "string") {
          apiError = errorPayload.error;
        }
      } catch (_error) {
        // Keep default status-based error message if body is not JSON.
      }
      throw new Error(apiError);
    }
    return await response.json();
  }
};

const renderConnections = () => {
  connectionsList.innerHTML = "";
  for (const [userId, action] of state.actions.entries()) {
    const candidate = state.wave?.candidates.find((item) => item.profile.id === userId);
    const li = document.createElement("li");
    if (!candidate) {
      li.textContent = `${action} recorded for ${userId}.`;
      connectionsList.appendChild(li);
      continue;
    }
    if (action === "like" && userId === "u2") {
      li.textContent = `Mutual like with ${candidate.profile.fullName}. WhatsApp unlocked: ${candidate.profile.phone}`;
    } else if (action === "like") {
      li.textContent = `Liked ${candidate.profile.fullName}. Waiting for mutual like. WhatsApp still locked.`;
    } else {
      li.textContent = `Passed ${candidate.profile.fullName}. Contact remains private.`;
    }
    connectionsList.appendChild(li);
  }
};

const renderWave = () => {
  matchList.innerHTML = "";
  if (!state.wave) {
    waveStatus.textContent = "No wave loaded.";
    return;
  }
  waveStatus.textContent = `Wave ${state.wave.id} loaded with ${state.wave.candidates.length} candidates.`;
  state.wave.candidates.forEach((candidate) => {
    const profile = candidate.profile;
    const li = document.createElement("li");
    li.innerHTML = `
      <strong>${profile.fullName}</strong> - ${profile.headline}
      <div>Score: ${Math.round(candidate.score * 100)}%</div>
      <div>${candidate.matchReason}</div>
      <div style="margin-top:8px;display:flex;gap:8px;">
        <button type="button" data-user-id="${profile.id}" data-action="like">Like</button>
        <button type="button" data-user-id="${profile.id}" data-action="pass">Pass</button>
      </div>
    `;
    matchList.appendChild(li);
  });
};

const canCompleteOnboarding = () =>
  Boolean(state.auth && state.profile && state.answers.length >= 3 && state.consent?.consentAccepted);

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const provider = document.getElementById("provider").value;
  const demoMode = document.getElementById("demo-mode").checked;
  state.auth = { provider, demoMode };
  if (provider !== "google" && !demoMode) {
    setStatus("LinkedIn is UI-only in MVP. Enable demo mode or switch to Google.", "error");
    return;
  }
  try {
    const session = await apiFetch("/api/auth/session", {
      method: "POST",
      body: JSON.stringify(state.auth),
    });
    state.userId = session.userId || null;
    setStatus("Auth step complete. Continue with profile and tags.", "success");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Auth failed.", "error");
  }
});

profileForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const offers = parseTags(document.getElementById("offer-tags").value);
  const seeks = parseTags(document.getElementById("seek-tags").value);

  if (offers.length !== 3 || seeks.length !== 3) {
    setStatus("Enter exactly 3 tags for offer and 3 tags for looking-for.", "error");
    return;
  }

  state.profile = {
    userId: state.userId,
    fullName: document.getElementById("full-name").value.trim(),
    role: document.getElementById("role").value.trim(),
    company: document.getElementById("company").value.trim(),
    whatsapp: document.getElementById("whatsapp").value.trim(),
    offers,
    seeks,
  };
  try {
    await apiFetch("/api/onboarding/profile", {
      method: "POST",
      body: JSON.stringify(state.profile),
    });
    setStatus("Profile saved. Answer at least 3 icebreaker questions.", "success");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Profile save failed.", "error");
  }
});

questionnaireForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const inputs = Array.from(questionList.querySelectorAll("input[data-question-index]"));
  const answers = inputs
    .map((input) => input.value.trim())
    .filter((answer) => answer.length > 0);

  if (answers.length < 3) {
    setStatus("Please answer at least 3 icebreaker questions.", "error");
    return;
  }

  state.answers = answers;
  try {
    await apiFetch("/api/onboarding/questions", {
      method: "POST",
      body: JSON.stringify({ answers }),
    });
    setStatus("Questionnaire saved. Complete privacy and consent.", "success");
  } catch (error) {
    setStatus(
      error instanceof Error ? error.message : "Questionnaire save failed.",
      "error"
    );
  }
});

consentForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const consentAccepted = document.getElementById("privacy-consent").checked;
  const deleteAfter24h = document.getElementById("auto-delete").checked;

  if (!consentAccepted) {
    setStatus("Privacy agreement is required to continue.", "error");
    return;
  }

  state.consent = {
    consentAccepted,
    deleteAfter24h,
  };

  if (!canCompleteOnboarding()) {
    setStatus("Complete auth, profile, and at least 3 questionnaire answers first.", "error");
    return;
  }

  try {
    await apiFetch("/api/onboarding/complete", {
      method: "POST",
      body: JSON.stringify({
        userId: state.userId,
        provider: state.auth.provider,
        consentAccepted: state.consent.consentAccepted,
        autoDeleteAfter24h: state.consent.deleteAfter24h,
        offers: state.profile.offers,
        seeks: state.profile.seeks,
        name: state.profile.fullName,
        role: state.profile.role,
        company: state.profile.company,
        whatsapp: state.profile.whatsapp,
        answers: state.answers,
      }),
    });

    state.onboardingComplete = true;
    setStatus("Onboarding complete. Load current wave when ready.", "success");
    waveStatus.textContent = "Onboarding complete. Ready for wave retrieval.";
  } catch (error) {
    setStatus(
      error instanceof Error ? error.message : "Onboarding completion failed.",
      "error"
    );
  }
});

loadWaveButton.addEventListener("click", async () => {
  if (!state.onboardingComplete) {
    setStatus("Complete onboarding first.", "error");
    return;
  }

  try {
    const wave = await apiFetch("/api/waves/current");
    state.wave = normalizeWave(wave);
    renderWave();
    setStatus("Current wave loaded.", "success");
  } catch (_error) {
    state.wave = mockWave();
    renderWave();
    setStatus("API unavailable, using demo wave fallback.", "error");
  }
});

triggerWaveButton.addEventListener("click", async () => {
  if (!state.onboardingComplete) {
    setStatus("Onboarding must be complete before wave trigger.", "error");
    return;
  }
  try {
    const wave = await apiFetch("/api/waves/trigger", { method: "POST" });
    state.wave = normalizeWave(wave);
    renderWave();
    setStatus("Operator wave trigger executed.", "success");
  } catch (_error) {
    state.wave = mockWave();
    renderWave();
    setStatus("API unavailable, using demo wave fallback.", "error");
  }
});

matchList.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) {
    return;
  }
  const userId = target.dataset.userId;
  const action = target.dataset.action;
  if (!userId || (action !== "like" && action !== "pass")) {
    return;
  }
  try {
    await apiFetch("/api/matches/action", {
      method: "POST",
      body: JSON.stringify({
        userId: state.userId,
        waveId: state.wave?.id,
        targetUserId: userId,
        action,
      }),
    });
    state.actions.set(userId, action);
    renderConnections();
    setStatus(`Action recorded: ${action} ${userId}.`, "success");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Action failed.", "error");
  }
});

renderQuestions();
