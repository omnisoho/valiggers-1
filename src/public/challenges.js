// ============================
// CHALLENGES + REWARDS (single page, tab switch)
// ============================

function authFetch(url, options = {}) {
  const token = localStorage.getItem("token");
  const headers = options.headers ? { ...options.headers } : {};
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(url, { ...options, headers });
}

const VOUCHERS = [
  { id: "voucher-1", name: "$1 Off Store Voucher", cost: 50 },
  { id: "voucher-3", name: "$3 Off Store Voucher", cost: 150 },
  { id: "voucher-5", name: "$5 Off Store Voucher", cost: 250 },
];

// ----------------------------
// Local storage helpers
// ----------------------------
function getOwnedKey() {
  const token = localStorage.getItem("token") || "anon";
  return `fitcore_owned_vouchers_${token}`;
}

function loadOwnedVouchers() {
  try { return JSON.parse(localStorage.getItem(getOwnedKey()) || "[]"); }
  catch { return []; }
}

function saveOwnedVouchers(list) {
  localStorage.setItem(getOwnedKey(), JSON.stringify(list));
}

// Singapore day key (UTC+8)
function getDayKeySG(d = new Date()) {
  const offsetMs = 8 * 60 * 60 * 1000;
  const shifted = new Date(d.getTime() + offsetMs);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const day = String(shifted.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getDailyRedeemKey() {
  const token = localStorage.getItem("token") || "anon";
  return `fitcore_daily_redeem_${token}`;
}

function getDailyRedeemState() {
  try { return JSON.parse(localStorage.getItem(getDailyRedeemKey()) || "null"); }
  catch { return null; }
}

function setDailyRedeemState(obj) {
  localStorage.setItem(getDailyRedeemKey(), JSON.stringify(obj));
}

// ----------------------------
// Small DOM utils
// ----------------------------
function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function show(id, yes) {
  const el = document.getElementById(id);
  if (el) el.style.display = yes ? "" : "none";
}

function setBadge(status) {
  const el = document.getElementById("challengeStatus");
  if (!el) return;

  const s = String(status || "").toUpperCase();
  el.textContent = s;

  el.classList.remove("available", "accepted", "inprogress", "completed", "failed", "expired");

  if (s === "AVAILABLE") el.classList.add("available");
  else if (s === "ACCEPTED") el.classList.add("accepted");
  else if (s === "IN_PROGRESS") el.classList.add("inprogress");
  else if (s === "FAILED") el.classList.add("failed");
  else if (s === "EXPIRED") el.classList.add("expired");
  else if (s === "COMPLETED") el.classList.add("completed");
  else el.classList.add("accepted");
}

// Progress bar behavior:
// - AVAILABLE: 0%
// - ACCEPTED / IN_PROGRESS (not completed): 50% even if 0/1
// - COMPLETED: 100%
function setProgress(progress, target, status) {
  const p = Number(progress || 0);
  const t = Math.max(1, Number(target || 1));
  const s = String(status || "").toUpperCase();

  setText("challengeProgressText", `Progress: ${Math.min(p, t)} / ${t}`);

  let pct = Math.round((Math.min(p, t) / t) * 100);
  if ((s === "ACCEPTED" || s === "IN_PROGRESS") && pct < 50) pct = 50;
  if (s === "AVAILABLE") pct = 0;
  if (s === "COMPLETED") pct = 100;

  const bar = document.getElementById("challengeProgressBar");
  if (bar) bar.style.width = `${Math.max(0, Math.min(100, pct))}%`;
  setText("challengeDoneHint", pct === 100 ? "Done" : "");
}

function setChallengeButtons(status) {
  const s = String(status || "").toUpperCase();
  const btnAccept = document.getElementById("btnAcceptChallenge");
  const btnGo = document.getElementById("btnGoSessions");

  if (!btnAccept || !btnGo) return;

  if (s === "AVAILABLE") {
    btnAccept.style.display = "";
    btnGo.style.display = "none";
  } else {
    btnAccept.style.display = "none";
    btnGo.style.display = "";
  }
}

function prettyState(s) {
  const u = String(s || "").toUpperCase();
  if (!u) return "—";
  return u.replace("_", " ");
}

// ----------------------------
// Rewards rendering + once/day rule (client-side)
// ----------------------------
function renderVoucherList(points) {
  const wrap = document.getElementById("voucherList");
  if (!wrap) return;

  const daily = getDailyRedeemState();
  const todayKey = getDayKeySG();
  const redeemedToday = daily && daily.dayKey === todayKey;

  wrap.innerHTML = "";

  VOUCHERS.forEach((v) => {
    const canBuy = Number(points || 0) >= v.cost;
    const isRedeemedVoucher = redeemedToday && daily.rewardId === v.id;

    const row = document.createElement("div");
    row.className = "meta-chip";
    row.style.display = "flex";
    row.style.alignItems = "center";
    row.style.justifyContent = "space-between";
    row.style.gap = "10px";
    row.style.width = "100%";
    row.style.borderRadius = "14px";
    row.style.padding = "10px 12px";
    row.style.marginBottom = "10px";

    const left = document.createElement("div");
    left.innerHTML = `<div style="font-weight:800;color:var(--text)">${v.name}</div>
                      <div style="font-size:12px;color:var(--muted)">${v.cost} points</div>`;

    const btn = document.createElement("button");
    btn.className = "btn primary";

    if (redeemedToday) {
      btn.disabled = true;
      btn.textContent = isRedeemedVoucher ? "Redeemed" : "Redeem (1/day)";
    } else {
      btn.textContent = "Redeem";
      btn.disabled = !canBuy;
      btn.onclick = () => redeemVoucher(v.id);
    }

    row.appendChild(left);
    row.appendChild(btn);
    wrap.appendChild(row);
  });
}

function renderOwnedVouchers() {
  const owned = loadOwnedVouchers();
  const wrap = document.getElementById("ownedVoucherList");
  if (!wrap) return;

  wrap.innerHTML = "";
  show("noOwnedVouchers", owned.length === 0);

  owned.forEach((o) => {
    const row = document.createElement("div");
    row.className = "meta-chip";
    row.style.display = "flex";
    row.style.alignItems = "center";
    row.style.justifyContent = "space-between";
    row.style.gap = "10px";
    row.style.width = "100%";
    row.style.borderRadius = "14px";
    row.style.padding = "10px 12px";
    row.style.marginBottom = "10px";

    const left = document.createElement("div");
    const date = o.redeemedAt ? new Date(o.redeemedAt) : null;
    left.innerHTML = `<div style="font-weight:800;color:var(--text)">${o.rewardName || o.rewardId}</div>
                      <div style="font-size:12px;color:var(--muted)">${date ? date.toLocaleString() : ""}</div>`;

    const btn = document.createElement("button");
    btn.className = "btn danger";
    btn.textContent = "Remove";
    btn.onclick = () => {
      const next = loadOwnedVouchers().filter((x) => x.redeemedAt !== o.redeemedAt);
      saveOwnedVouchers(next);
      renderOwnedVouchers();
    };

    row.appendChild(left);
    row.appendChild(btn);
    wrap.appendChild(row);
  });
}

// ----------------------------
// Challenge load + accept/start
// ----------------------------
async function loadChallenge() {
  show("challengeErrorBox", false);

  try {
    const res = await authFetch("/challenges-api/me");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to load challenge");

    const uc = data.userChallenge;

    setText("challengeTitle", uc?.challenge?.title || "Complete 1 Session");
    setText("challengeDesc", uc?.challenge?.description || "Finish one workout session today.");
    setText("challengeReward", `Reward: +${uc?.challenge?.pointsReward ?? 50} points`);

    setBadge(uc?.status || "AVAILABLE");
    setChallengeButtons(uc?.status || "AVAILABLE");
    setProgress(uc?.progressValue ?? 0, uc?.challenge?.targetValue ?? 1, uc?.status || "AVAILABLE");

    // How it works: today + yesterday states
    setText("todayStateHint", `Status: ${prettyState(uc?.status || "AVAILABLE")}`);
    setText("yesterdayStateHint", `Status: ${prettyState(data.previousDayStatus || "—")}`);

    // Points
    const points = data.totalPoints ?? 0;
    setText("pointsTotal", points);
    setText("navPoints", points);

    renderVoucherList(points);
    renderOwnedVouchers();
  } catch (e) {
    const box = document.getElementById("challengeErrorBox");
    if (box) {
      box.textContent = e.message || "Unable to load challenge.";
      box.style.display = "";
    }
  }
}

async function acceptTodayChallenge() {
  show("challengeErrorBox", false);

  try {
    const res = await authFetch("/challenges-api/me/accept", { method: "POST" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Unable to accept challenge");

    const uc = data.userChallenge;
    setBadge(uc?.status || "ACCEPTED");
    setChallengeButtons(uc?.status || "ACCEPTED");
    setProgress(uc?.progressValue ?? 0, uc?.challenge?.targetValue ?? 1, uc?.status || "ACCEPTED");
    setText("todayStateHint", `Status: ${prettyState(uc?.status || "ACCEPTED")}`);

    // After a few seconds, switch to IN_PROGRESS (and persist to backend)
    setTimeout(async () => {
      try {
        const r2 = await authFetch("/challenges-api/me/start", { method: "POST" });
        const d2 = await r2.json();
        if (r2.ok) {
          const uc2 = d2.userChallenge;
          setBadge(uc2?.status || "IN_PROGRESS");
          setChallengeButtons(uc2?.status || "IN_PROGRESS");
          setProgress(uc2?.progressValue ?? 0, uc2?.challenge?.targetValue ?? 1, uc2?.status || "IN_PROGRESS");
          setText("todayStateHint", `Status: ${prettyState(uc2?.status || "IN_PROGRESS")}`);
        } else {
          // fallback display-only
          setBadge("IN_PROGRESS");
          setChallengeButtons("IN_PROGRESS");
          setProgress(0, 1, "IN_PROGRESS");
          setText("todayStateHint", `Status: IN PROGRESS`);
        }
      } catch {
        // ignore
      }
    }, 2500);

  } catch (e) {
    const box = document.getElementById("challengeErrorBox");
    if (box) {
      box.textContent = e.message || "Unable to accept.";
      box.style.display = "";
    }
  }
}

// ----------------------------
// Rewards API
// ----------------------------
async function loadRewardsOnly() {
  show("voucherErrorBox", false);

  try {
    const res = await authFetch("/rewards-api/me");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to load rewards");

    const points = data.totalPoints ?? 0;
    setText("pointsTotal", points);
    setText("navPoints", points);
    renderVoucherList(points);
    renderOwnedVouchers();
  } catch (e) {
    const box = document.getElementById("voucherErrorBox");
    if (box) {
      box.textContent = e.message || "Unable to load rewards.";
      box.style.display = "";
    }
  }
}

async function redeemVoucher(rewardId) {
  show("voucherErrorBox", false);

  // Enforce 1 redeem/day (client-side) using SG day key
  const todayKey = getDayKeySG();
  const daily = getDailyRedeemState();
  if (daily && daily.dayKey === todayKey) {
    const box = document.getElementById("voucherErrorBox");
    if (box) {
      box.textContent = "You can only redeem one reward per day.";
      box.style.display = "";
    }
    return;
  }

  try {
    const res = await authFetch("/rewards-api/redeem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rewardId }),
    });

    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || "Unable to redeem");

    // Save daily redeem marker
    setDailyRedeemState({ dayKey: todayKey, rewardId, redeemedAt: new Date().toISOString() });

    // Save owned voucher locally (display-only)
    const owned = loadOwnedVouchers();
    owned.unshift({
      rewardId: data.voucher.rewardId,
      rewardName: data.voucher.rewardName,
      pointsCost: data.voucher.pointsCost,
      redeemedAt: data.voucher.redeemedAt,
    });
    saveOwnedVouchers(owned);

    await loadRewardsOnly();
  } catch (e) {
    const box = document.getElementById("voucherErrorBox");
    if (box) {
      box.textContent = e.message || "Unable to redeem.";
      box.style.display = "";
    }
  }
}

// ----------------------------
// Tabs + init
// ----------------------------
function initTabs() {
  const tabC = document.getElementById("tabChallenges");
  const tabR = document.getElementById("tabRewards");
  const panelC = document.getElementById("panelChallenges");
  const panelR = document.getElementById("panelRewards");

  function setActive(which) {
    const isC = which === "ch";
    tabC.classList.toggle("active", isC);
    tabR.classList.toggle("active", !isC);
    tabC.setAttribute("aria-selected", isC ? "true" : "false");
    tabR.setAttribute("aria-selected", isC ? "false" : "true");
    panelC.classList.toggle("active", isC);
    panelR.classList.toggle("active", !isC);
    if (!isC) loadRewardsOnly();
  }

  tabC?.addEventListener("click", () => setActive("ch"));
  tabR?.addEventListener("click", () => setActive("rw"));
}

function initActions() {
  document.getElementById("btnRefreshChallenge")?.addEventListener("click", loadChallenge);
  document.getElementById("btnAcceptChallenge")?.addEventListener("click", acceptTodayChallenge);
}

document.addEventListener("DOMContentLoaded", () => {
  initTabs();
  initActions();
  loadChallenge();
});
