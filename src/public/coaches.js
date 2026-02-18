// =======================
// Coaches page + Backend Chat (REST)
// Full replacement for coaches.js
// =======================

const grid = document.getElementById("grid");
const statusEl = document.getElementById("status");

const openFiltersBtnTop = document.getElementById("openFiltersBtnTop");
const navSearchEl = document.getElementById("navSearch");

const searchEl = document.getElementById("search");
const specialtyEl = document.getElementById("specialty");
const minRateEl = document.getElementById("minRate");
const maxRateEl = document.getElementById("maxRate");
const sortEl = document.getElementById("sort");

const applyBtn = document.getElementById("applyBtn");
const resetBtn = document.getElementById("resetBtn");
const openFiltersBtn = document.getElementById("openFiltersBtn");
const filtersModal = document.getElementById("filtersModal");
const closeFiltersBtn = document.getElementById("closeFiltersBtn");

const STORAGE_KEY = "coaches_filters_v1";

// Chat DOM
const openChatBtn = document.getElementById("openChatBtn");
const chatModal = document.getElementById("chatModal");
const closeChatBtn = document.getElementById("closeChatBtn");
const newChatBtn = document.getElementById("newChatBtn");

const chatSearchEl = document.getElementById("chatSearch");
const chatListItemsEl = document.getElementById("chatListItems");
const chatMessagesEl = document.getElementById("chatMessages");

const chatPeerNameEl = document.getElementById("chatPeerName");
const chatPeerMetaEl = document.getElementById("chatPeerMeta");
const chatPeerAvatarEl = document.getElementById("chatPeerAvatar");

const chatComposer = document.getElementById("chatComposer");
const chatInput = document.getElementById("chatInput");

const newChatSheet = document.getElementById("newChatSheet");
const closeNewChatBtn = document.getElementById("closeNewChatBtn");
const newChatSearchEl = document.getElementById("newChatSearch");
const newChatListEl = document.getElementById("newChatList");

// ===== Backend Chat State =====
let liveConversations = [];
let activeConversationId = null;
let activeMessages = [];
let activeConversation = null; // { coach, student, ... } from backend
let lastLoadedCoaches = []; // from /coaches listing

let chatPollTimer = null;
let lastPollConversationId = null;

// -----------------------
// Utils
// -----------------------
function openModal() {
  filtersModal.classList.add("is-open");
  filtersModal.setAttribute("aria-hidden", "false");
  setTimeout(() => searchEl.focus(), 0);
}

function closeModal() {
  filtersModal.classList.remove("is-open");
  filtersModal.setAttribute("aria-hidden", "true");
}

function fmtMoney(n) {
  if (n === null || n === undefined) return "-";
  const num = Number(n);
  if (Number.isNaN(num)) return String(n);
  return `$${num.toFixed(0)}/hr`;
}

function fmtRating(avg, count) {
  const a = Number(avg ?? 0);
  const c = Number(count ?? 0);
  if (!c) return "No reviews";
  return `${a.toFixed(1)}★ (${c})`;
}

function safeText(s, fallback = "") {
  return (s ?? fallback).toString();
}

function fmtTime(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString([], {
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function specialtyLabel(s) {
  const map = {
    STRENGTH: "Strength",
    HYPERTROPHY: "Hypertrophy",
    WEIGHT_LOSS: "Weight Loss",
    REHAB: "Rehab",
    MOBILITY: "Mobility",
    NUTRITION: "Nutrition",
    SPORTS: "Sports",
  };
  return map[s] || s;
}

function getToken() {
  return localStorage.getItem("token");
}

function getCurrentUserIdFromToken() {
  const token = getToken();
  if (!token) return null;

  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    // base64url decode
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    const payload = JSON.parse(json);
    return payload?.userId ?? null;
  } catch {
    return null;
  }
}

async function api(path, options = {}) {
  const token = getToken();
  const headers = { ...(options.headers || {}) };

  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body && !headers["Content-Type"]) headers["Content-Type"] = "application/json";

  const res = await fetch(path, { ...options, headers });
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const msg = data?.message || data?.error || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

function getPeerFromConversation(convo, currentUserId) {
  const uid = Number(currentUserId);

  const isCoachOwner = Number(convo?.coach?.userId) === uid;
  const isStudent = Number(convo?.student?.user_id) === uid || Number(convo?.studentId) === uid;

  // If I'm the coach, peer is the student
  if (isCoachOwner) {
    return {
      name: convo?.student?.username || "Student",
      avatarUrl: convo?.student?.pfpUrl || "",
      role: "STUDENT",
    };
  }

  // Otherwise (student), peer is the coach
  return {
    name: convo?.coach?.displayName || "Coach",
    avatarUrl: convo?.coach?.avatarUrl || "",
    role: "COACH",
  };
}

// -----------------------
// Filters / Coach browsing
// -----------------------
function getFilters() {
  return {
    search: searchEl.value.trim(),
    specialty: specialtyEl.value,
    minRate: minRateEl.value,
    maxRate: maxRateEl.value,
    sort: sortEl.value,
  };
}

function setFilters(f) {
  searchEl.value = f.search ?? "";
  specialtyEl.value = f.specialty ?? "";
  minRateEl.value = f.minRate ?? "";
  maxRateEl.value = f.maxRate ?? "";
  sortEl.value = f.sort ?? "newest";

  if (navSearchEl) navSearchEl.value = searchEl.value;
}

function saveFilters() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(getFilters()));
}

function loadFilters() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function buildQuery(filters) {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.specialty) params.set("specialty", filters.specialty);
  if (filters.minRate) params.set("minRate", filters.minRate);
  if (filters.maxRate) params.set("maxRate", filters.maxRate);
  if (filters.sort) params.set("sort", filters.sort);
  return params.toString();
}

function renderEmpty(message) {
  grid.innerHTML = "";
  statusEl.textContent = message || "No coaches found.";
}

function renderCards(coaches) {
  grid.innerHTML = "";

  for (const c of coaches) {
    const avatarUrl = c.avatarUrl || c.user?.pfpUrl || "";
    const displayName = safeText(c.displayName, "Coach");
    const username = c.user?.username ? `@${c.user.username}` : "";
    const desc = safeText(c.bio, "No bio yet.");
    const rate = fmtMoney(c.hourlyRate);
    const rating = fmtRating(c.avgRating, c.reviewCount);

    const specialties = Array.isArray(c.specialties) ? c.specialties : [];
    const topSpecs = specialties.slice(0, 3);

    const card = document.createElement("div");
    card.className = "card";

    card.innerHTML = `
      <div class="avatar">
        ${avatarUrl ? `<img src="${avatarUrl}" alt="avatar">` : `<span>👤</span>`}
      </div>

      <div class="content" style="display:flex;flex-direction:column;flex:1;">
        <div>
          <h3>${displayName} <span style="color:rgba(255,255,255,0.65);font-weight:500;font-size:13px;">${username}</span></h3>

          <div class="meta">
            <span class="pill">${rating}</span>
            <span class="pill">${rate}</span>
            ${topSpecs.map((s) => `<span class="pill">${specialtyLabel(s)}</span>`).join("")}
          </div>

          <p class="desc">${desc}</p>
        </div>

        <div class="card-footer">
          <span style="color:rgba(255,255,255,0.65);font-size:12px;">ID: ${c.id}</span>
          <a class="link-btn" href="/coach-detail?id=${c.id}">View more</a>
        </div>
      </div>
    `;

    grid.appendChild(card);
  }
}

async function fetchCoaches() {
  const filters = getFilters();
  saveFilters();

  statusEl.textContent = "Loading coaches...";
  grid.innerHTML = "";

  const qs = buildQuery(filters);

  try {
    const res = await fetch(`/coaches${qs ? `?${qs}` : ""}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Request failed (${res.status})`);
    }

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      lastLoadedCoaches = [];
      return renderEmpty("No coaches found. Try adjusting your filters.");
    }

    lastLoadedCoaches = Array.isArray(data) ? data : [];
    statusEl.textContent = `Showing ${data.length} coach(es)`;
    renderCards(data);
  } catch {
    lastLoadedCoaches = [];
    renderEmpty("We’re having trouble loading coaches right now. Please try again in a moment.");
  }
}

// -----------------------
// Chat UI helpers (backend)
// -----------------------
function stopChatPolling() {
  if (chatPollTimer) clearInterval(chatPollTimer);
  chatPollTimer = null;
  lastPollConversationId = null;
}

function startChatPolling() {
  stopChatPolling();

  // poll list always if chat open, and poll messages if in a conversation
  chatPollTimer = setInterval(async () => {
    if (!chatModal.classList.contains("is-open")) return;

    try {
      const token = getToken();
      if (!token) return;

      // refresh conversation list
      await loadConversations();

      // refresh messages if we have an active conversation
      if (activeConversationId) {
        // avoid polling wrong convo if user switched very fast
        lastPollConversationId = activeConversationId;
        await loadMessages(activeConversationId, { silent: true });
        if (lastPollConversationId !== activeConversationId) return;
      }
    } catch {
      // ignore polling errors (network, auth expiry etc.)
    }
  }, 3000);
}

function setChatEmptyState() {
  chatPeerNameEl.textContent = "Select a chat";
  chatPeerMetaEl.textContent = "Messages are saved to your account";
  chatPeerAvatarEl.textContent = "👤";
  chatMessagesEl.innerHTML = "";
  chatInput.value = "";
  chatInput.disabled = true;
}

function renderChatListFromBackend() {
  const q = (chatSearchEl.value || "").trim().toLowerCase();
  chatListItemsEl.innerHTML = "";

  const items = liveConversations.filter((c) => {
    if (!q) return true;
    const coachName = (c.coach?.displayName || "").toLowerCase();
    const studentName = (c.student?.username || "").toLowerCase();
    const last = (c.lastMessage?.content || "").toLowerCase();
    return coachName.includes(q) || studentName.includes(q) || last.includes(q);
  });

  if (!items.length) {
    chatListItemsEl.innerHTML = `<div style="padding:12px;color:rgba(255,255,255,0.65);font-size:13px;">No chats yet. Tap ＋ to start one.</div>`;
    return;
  }

  for (const c of items) {
    const currentUserId = getCurrentUserIdFromToken();
    const peer = getPeerFromConversation(c, currentUserId);

    const title = peer.name;
    const avatarUrl = peer.avatarUrl;
    const snippet = c.lastMessage?.content || "No messages yet";

    const el = document.createElement("div");
    el.className = "chat-item" + (c.id === activeConversationId ? " is-active" : "");
    el.innerHTML = `
      <div class="chat-item-avatar">
        ${
          avatarUrl
            ? `<img src="${avatarUrl}" alt="avatar" style="width:100%;height:100%;object-fit:cover;border-radius:12px;">`
            : "👤"
        }
      </div>
      <div style="min-width:0;">
        <div class="chat-item-title">${title}</div>
        <p class="chat-item-snippet">${snippet}</p>
      </div>
    `;

    el.addEventListener("click", async () => {
      await openConversation(c.id);
    });

    chatListItemsEl.appendChild(el);
  }
}

function renderMessagesFromBackend() {
  chatMessagesEl.innerHTML = "";

  if (!activeConversationId || !activeConversation) {
    setChatEmptyState();
    return;
  }

    const currentUserId = getCurrentUserIdFromToken();
    const peer = getPeerFromConversation(activeConversation, currentUserId);

    chatPeerNameEl.textContent = peer.name;
    const avatarUrl = peer.avatarUrl;
  if (avatarUrl) {
    chatPeerAvatarEl.innerHTML = `<img src="${avatarUrl}" alt="avatar" style="width:100%;height:100%;object-fit:cover;border-radius:12px;">`;
  } else {
    chatPeerAvatarEl.textContent = "👤";
  }

  chatInput.disabled = false;

  for (const m of activeMessages) {
    const isMe = currentUserId && Number(m.senderUserId) === Number(currentUserId);

    const row = document.createElement("div");
    row.className = "msg " + (isMe ? "me" : "coach");
    row.innerHTML = `
      <div>${safeText(m.content, "")}</div>
      <span class="ts">${fmtTime(m.createdAt)}</span>
    `;
    chatMessagesEl.appendChild(row);
  }

  chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
}

async function loadConversations() {
  const token = getToken();
  if (!token) {
    liveConversations = [];
    chatListItemsEl.innerHTML = `<div style="padding:12px;color:rgba(255,255,255,0.65);font-size:13px;">Log in to use chat.</div>`;
    setChatEmptyState();
    return;
  }

  liveConversations = await api("/chat/conversations");
  renderChatListFromBackend();
}

async function loadMessages(conversationId, { silent = false } = {}) {
  const token = getToken();
  if (!token) {
    if (!silent) alert("Log in to view messages.");
    return;
  }

  const data = await api(`/chat/conversations/${conversationId}/messages`);
  activeConversation = data.conversation;
  activeMessages = Array.isArray(data.messages) ? data.messages : [];

  renderMessagesFromBackend();
}

async function openConversation(conversationId) {
  activeConversationId = Number(conversationId);
  await loadMessages(activeConversationId);
  renderChatListFromBackend();
  setTimeout(() => chatInput.focus(), 0);
}

async function createOrGetConversationForCoach(coachProfileId) {
  const token = getToken();
  if (!token) {
    alert("Log in to start a chat.");
    return null;
  }

  const convo = await api("/chat/conversations", {
    method: "POST",
    body: JSON.stringify({ coachId: Number(coachProfileId) }),
  });

  return convo;
}

function openChatModal() {
  chatModal.classList.add("is-open");
  chatModal.setAttribute("aria-hidden", "false");

  // reset view every open
  if (!activeConversationId) setChatEmptyState();

  // load list + start polling
  loadConversations().catch(() => {});
  startChatPolling();
}

function closeChatModal() {
  chatModal.classList.remove("is-open");
  chatModal.setAttribute("aria-hidden", "true");
  closeNewChatSheet();
  stopChatPolling();
}

function openNewChatSheet() {
  newChatSheet.classList.add("is-open");
  newChatSheet.setAttribute("aria-hidden", "false");
  newChatSearchEl.value = "";
  renderNewChatList();
  setTimeout(() => newChatSearchEl.focus(), 0);
}

function closeNewChatSheet() {
  newChatSheet.classList.remove("is-open");
  newChatSheet.setAttribute("aria-hidden", "true");
}

function renderNewChatList() {
  const q = (newChatSearchEl.value || "").trim().toLowerCase();

  const items = (lastLoadedCoaches || []).filter((c) => {
    if (!q) return true;
    const name = (c.displayName || "").toLowerCase();
    const username = (c.user?.username || "").toLowerCase();
    return name.includes(q) || username.includes(q);
  });

  newChatListEl.innerHTML = "";

  if (!items.length) {
    newChatListEl.innerHTML = `<div style="padding:10px;color:rgba(255,255,255,0.65);font-size:13px;">No coaches loaded yet. Close this and load coaches first.</div>`;
    return;
  }

  for (const c of items) {
    const avatarUrl = c.avatarUrl || c.user?.pfpUrl || "";
    const name = safeText(c.displayName, "Coach");
    const username = c.user?.username ? `@${c.user.username}` : "";

    const row = document.createElement("div");
    row.className = "newchat-row";
    row.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;min-width:0;">
        <div class="chat-item-avatar">
          ${
            avatarUrl
              ? `<img src="${avatarUrl}" alt="avatar" style="width:100%;height:100%;object-fit:cover;border-radius:12px;">`
              : "👤"
          }
        </div>
        <div style="min-width:0;">
          <div style="font-weight:800;font-size:13px;">${name}</div>
          <div style="color:rgba(255,255,255,0.65);font-size:12px;">${username} • ID: ${c.id}</div>
        </div>
      </div>
      <button type="button">Chat</button>
    `;

    row.querySelector("button").addEventListener("click", async () => {
      try {
        const convo = await createOrGetConversationForCoach(c.id);
        if (!convo) return;

        closeNewChatSheet();
        await loadConversations();
        await openConversation(convo.id);
      } catch (e) {
        alert(e.message);
      }
    });

    newChatListEl.appendChild(row);
  }
}

// -----------------------
// Wiring (Filters / UI)
// -----------------------
applyBtn.addEventListener("click", () => {
  fetchCoaches();
  closeModal();
});

resetBtn.addEventListener("click", () => {
  setFilters({ search: "", specialty: "", minRate: "", maxRate: "", sort: "newest" });
  saveFilters();
  fetchCoaches();
});

if (openFiltersBtn) openFiltersBtn.addEventListener("click", openModal);
if (openFiltersBtnTop) openFiltersBtnTop.addEventListener("click", openModal);
closeFiltersBtn.addEventListener("click", closeModal);

filtersModal.addEventListener("click", (e) => {
  const target = e.target;
  if (target && target.dataset && target.dataset.close === "true") closeModal();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && filtersModal.classList.contains("is-open")) closeModal();
});

searchEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter") fetchCoaches();
});

if (navSearchEl) {
  navSearchEl.value = searchEl.value || "";

  navSearchEl.addEventListener("input", () => {
    searchEl.value = navSearchEl.value;
    fetchCoaches();
  });

  navSearchEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") fetchCoaches();
  });
}

// On load: restore saved filters then fetch
const saved = loadFilters();
if (saved) setFilters(saved);
fetchCoaches();

// -----------------------
// Wiring (Chat)
// -----------------------
openChatBtn.addEventListener("click", openChatModal);
closeChatBtn.addEventListener("click", closeChatModal);

chatModal.addEventListener("click", (e) => {
  const target = e.target;
  if (target && target.dataset && target.dataset.chatClose === "true") closeChatModal();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (newChatSheet.classList.contains("is-open")) return closeNewChatSheet();
    if (chatModal.classList.contains("is-open")) return closeChatModal();
  }
});

newChatBtn.addEventListener("click", openNewChatSheet);
closeNewChatBtn.addEventListener("click", closeNewChatSheet);

chatSearchEl.addEventListener("input", renderChatListFromBackend);
newChatSearchEl.addEventListener("input", renderNewChatList);

chatComposer.addEventListener("submit", async (e) => {
  e.preventDefault();

  const token = getToken();
  if (!token) return alert("Log in to send messages.");
  if (!activeConversationId) return;

  const text = (chatInput.value || "").trim();
  if (!text) return;

  try {
    await api(`/chat/conversations/${activeConversationId}/messages`, {
      method: "POST",
      body: JSON.stringify({ content: text }),
    });

    chatInput.value = "";
    await loadMessages(activeConversationId);
    await loadConversations();
  } catch (err) {
    alert(err.message);
  }
});
