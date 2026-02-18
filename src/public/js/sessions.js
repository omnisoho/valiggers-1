// ============================
// SESSIONS PAGE
// ============================

function authFetch(url, options = {}) {
  const token = localStorage.getItem("token");
  const headers = options.headers ? { ...options.headers } : {};

  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (options.body && !headers["Content-Type"]) headers["Content-Type"] = "application/json";

  return fetch(url, { ...options, headers });
}

const $ = (id) => document.getElementById(id);

function show(el) { el.classList.remove("hidden"); }
function hide(el) { el.classList.add("hidden"); }

function openModal(backdrop) { backdrop.classList.add("open"); }
function closeModal(backdrop) { backdrop.classList.remove("open"); }

function toast(msg) {
  const t = $("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.remove("hidden");
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => t.classList.add("hidden"), 2400);
}

function prettyDay(dayKey) {
  if (!dayKey) return "Today";
  return dayKey.charAt(0).toUpperCase() + dayKey.slice(1);
}

function badgeForState(state) {
  const s = String(state || "").toUpperCase();

  if (s === "COMPLETED") return `<span class="badge badge-success">COMPLETED</span>`;
  if (s === "CANCELLED") return `<span class="badge badge-danger">CANCELLED</span>`;
  if (s === "IN_PROGRESS") return `<span class="badge badge-accent">IN PROGRESS</span>`;
  if (s === "PAUSED") return `<span class="badge">PAUSED</span>`;
  return `<span class="badge">NOT STARTED</span>`;
}

function actionButtonsFor(state) {
  const s = String(state || "").toUpperCase();

  if (s === "NOT_STARTED") {
    return `
      <button class="btn btn-small" data-action="set" data-state="IN_PROGRESS">Start</button>
      <button class="btn btn-small btn-ghost" data-action="set" data-state="CANCELLED">Cancel</button>
    `;
  }

  if (s === "IN_PROGRESS") {
    return `
      <button class="btn btn-small" data-action="set" data-state="PAUSED">Pause</button>
      <button class="btn btn-small" data-action="set" data-state="COMPLETED">Complete</button>
      <button class="btn btn-small btn-ghost" data-action="set" data-state="CANCELLED">Cancel</button>
    `;
  }

  if (s === "PAUSED") {
    return `
      <button class="btn btn-small" data-action="set" data-state="IN_PROGRESS">Resume</button>
      <button class="btn btn-small btn-ghost" data-action="set" data-state="CANCELLED">Cancel</button>
    `;
  }

  return `<span class="muted">Locked</span>`;
}

function renderSessionItem(session) {
  const workoutName = session.workout?.name || "Workout";
  const mg = session.workout?.muscleGroup ? `• ${session.workout.muscleGroup}` : "";
  const sets = session.workout?.sets != null ? `${session.workout.sets} sets` : "";
  const reps = session.workout?.reps != null ? `${session.workout.reps} reps` : "";
  const meta = [sets, reps].filter(Boolean).join(" × ");

  return `
    <div class="session-item" data-session-id="${session.id}">
      <div class="session-top">
        <div>
          <div class="session-name">${workoutName}</div>
          <div class="session-sub">${mg} ${meta ? `• ${meta}` : ""}</div>
        </div>
        <div>${badgeForState(session.state)}</div>
      </div>

      <div class="session-actions">
        ${actionButtonsFor(session.state)}
      </div>
    </div>
  `;
}

async function loadToday() {
  hide($("emptyState"));
  hide($("sessionsCard"));

  const list = $("sessionsList");
  list.innerHTML = `<div class="muted">Loading...</div>`;

  const res = await authFetch("/sessions-api/today");
  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    list.innerHTML = `<div class="muted">${payload?.error || "Failed to load sessions."}</div>`;
    return;
  }

  const data = await res.json();

  $("pageTitle").textContent = `${prettyDay(data.dayKey)} Sessions`;
  $("dayKeyBadge").textContent = prettyDay(data.dayKey).toUpperCase();

  // No preset assigned OR preset empty
  if (!data.hasPlan) {
    $("subTitle").textContent = "No sessions available today.";
    show($("emptyState"));
    list.innerHTML = "";
    return;
  }

  // Show sessions
  $("subTitle").textContent = "Track progress using states: Not Started → In Progress → Paused/Completed.";
  $("presetName").textContent = data.preset?.name || "Preset";
  $("presetMeta").textContent = data.preset?.updatedAt
    ? `Last updated: ${new Date(data.preset.updatedAt).toLocaleString()}`
    : "";

  show($("sessionsCard"));

  list.innerHTML = "";
  (data.sessions || []).forEach((s) => {
    list.insertAdjacentHTML("beforeend", renderSessionItem(s));
  });

  // Outdated preset prompt
  const backdrop = $("sessionUpdateBackdrop");
  if (data.isOutdated && backdrop) {
    openModal(backdrop);
  }
}

async function updateState(sessionId, nextState) {
  const res = await authFetch(`/sessions-api/${sessionId}/state`, {
    method: "PATCH",
    body: JSON.stringify({ state: nextState }),
  });

  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    toast(payload?.error || payload?.message || "Invalid state change.");
    return;
  }

  toast(`Updated: ${nextState.replace("_", " ")}`);
  await loadToday();
}

async function switchToLatest() {
  const res = await authFetch("/sessions-api/today/switch", { method: "POST" });

  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    toast(payload?.error || payload?.message || "Unable to switch.");
    return;
  }

  closeModal($("sessionUpdateBackdrop"));
  toast("Updated — switched to the latest preset.");
  await loadToday();
}

function wireEvents() {
  // Refresh
  $("refreshBtn")?.addEventListener("click", loadToday);

  // Modal buttons
  $("keepOldBtn")?.addEventListener("click", () => {
    closeModal($("sessionUpdateBackdrop"));
    toast("Continuing with the old sessions.");
  });

  $("switchBtn")?.addEventListener("click", switchToLatest);

  $("updateModalCloseBtn")?.addEventListener("click", () => {
    closeModal($("sessionUpdateBackdrop"));
  });

  // Session action buttons
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;

    const action = btn.getAttribute("data-action");
    if (action !== "set") return;

    const wrap = btn.closest("[data-session-id]");
    if (!wrap) return;

    const sessionId = Number(wrap.getAttribute("data-session-id"));
    const nextState = btn.getAttribute("data-state");

    if (!sessionId || !nextState) return;
    updateState(sessionId, nextState);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  wireEvents();
  loadToday();
});
