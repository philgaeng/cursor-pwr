const state = {
  onboardingComplete: false,
  profile: null,
  wave: null,
  actions: new Map(),
};

const onboardingForm = document.getElementById("onboarding-form");
const waveStatus = document.getElementById("wave-status");
const matchList = document.getElementById("match-list");
const connectionsList = document.getElementById("connections-list");
const loadWaveButton = document.getElementById("load-wave");

const parseThreeTags = (raw) =>
  raw
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

const renderConnections = () => {
  connectionsList.innerHTML = "";
  for (const [userId, action] of state.actions.entries()) {
    const li = document.createElement("li");
    if (action === "like" && userId === "u2") {
      li.textContent = "Mutual like with Elena. Contact unlocked: elena@greenvc.example";
    } else if (action === "like") {
      li.textContent = `Liked ${userId}. Waiting for mutual like.`;
    } else {
      li.textContent = `Passed ${userId}. No contact shared.`;
    }
    connectionsList.appendChild(li);
  }
};

const handleAction = (userId, action) => {
  state.actions.set(userId, action);
  renderConnections();
};

const renderWave = () => {
  matchList.innerHTML = "";
  if (!state.wave) {
    return;
  }
  waveStatus.textContent = `Wave ${state.wave.id} loaded with ${state.wave.candidates.length} candidates.`;
  state.wave.candidates.forEach((candidate) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <strong>${candidate.name}</strong> - ${candidate.reason}
      <div style="margin-top:8px;display:flex;gap:8px;">
        <button data-user-id="${candidate.id}" data-action="like">Like</button>
        <button data-user-id="${candidate.id}" data-action="pass">Pass</button>
      </div>
    `;
    matchList.appendChild(li);
  });
};

loadWaveButton.addEventListener("click", () => {
  if (!state.onboardingComplete) {
    waveStatus.textContent = "Complete onboarding first.";
    return;
  }
  state.wave = {
    id: "wave-1",
    candidates: [
      { id: "u2", name: "Elena Park", reason: "Founder + seed investor match in Green Tech" },
      { id: "u3", name: "Daniel Ng", reason: "Frontend dev + partnership search overlap" },
      { id: "u4", name: "Sophia Tan", reason: "Operator with your go-to-market interests" },
    ],
  };
  renderWave();
});

matchList.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) {
    return;
  }
  const userId = target.dataset.userId;
  const action = target.dataset.action;
  if (!userId || (action !== "like" && action !== "pass")) {
    return;
  }
  handleAction(userId, action);
});

onboardingForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const provider = document.getElementById("provider").value;
  const offers = parseThreeTags(document.getElementById("offer-tags").value);
  const seeks = parseThreeTags(document.getElementById("seek-tags").value);
  const consentAccepted = document.getElementById("privacy-consent").checked;
  const autoDeleteAfter24h = document.getElementById("auto-delete").checked;

  if (offers.length !== 3 || seeks.length !== 3) {
    waveStatus.textContent = "Enter exactly 3 tags for both offer and looking-for.";
    return;
  }
  if (!consentAccepted) {
    waveStatus.textContent = "Privacy agreement is required.";
    return;
  }

  state.profile = {
    provider,
    offers,
    seeks,
    autoDeleteAfter24h,
  };
  state.onboardingComplete = true;
  waveStatus.textContent = "Onboarding complete. You can now load a match wave.";
});
