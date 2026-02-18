// =============================
// PLANS.JS (UPDATED)
// - Weekly plan: draft + "Save Weekly Plan" button
// - Reset weekly plan: clears DB + UI properly
// - Assignments persist visually after refresh
// - Does NOT touch other pages
// =============================

// MODAL CONTROL
let presets = [];
let weeklyPlan = null;

let editingPreset = null; // null = creating new
let presetItems = []; // array of exercises in the current preset

// Weekly plan draft (user picks but not saved yet)
const DAY_KEYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
let draftPlan = {}; // { monday: 1, tuesday: null, ... }

// DOM references
const presetModalBackdrop = document.getElementById("presetModalBackdrop");
const presetModalCloseBtn = document.getElementById("presetModalCloseBtn");
const presetModalTitle = document.getElementById("presetModalTitle");
const presetsListEl = document.getElementById("presetsList");
const presetItemsListEl = document.getElementById("presetItemsList");

// form fields
const presetNameInput = document.getElementById("presetNameInput");
const presetDurationInput = document.getElementById("presetDurationInput");
const presetDifficultyInput = document.getElementById("presetDifficultyInput");
const presetNotesInput = document.getElementById("presetNotesInput");

// buttons
const savePresetBtn = document.getElementById("savePresetBtn");
const deletePresetBtn = document.getElementById("deletePresetBtn");
const createPresetBtn = document.getElementById("createPresetBtn");

const resetPlanBtn = document.getElementById("resetPlanBtn");
const savePlanBtn = document.getElementById("savePlanBtn");

const tooltip = document.getElementById("presetPreviewTooltip");

// -----------------------
// TOOLTIP
// -----------------------
function showTooltip(html, x, y) {
  if (!tooltip) return;
  tooltip.innerHTML = html;
  tooltip.style.left = x + 15 + "px";
  tooltip.style.top = y + 15 + "px";
  tooltip.classList.add("visible");
}

function hideTooltip() {
  if (!tooltip) return;
  tooltip.classList.remove("visible");
}

function getPresetPreviewHTML(preset) {
  let html = `
    <div class="preview-title">${preset.name}</div>
  `;

  if (preset.totalDuration || preset.difficulty) {
    html += `<div class="preview-sub">`;
    if (preset.totalDuration) html += `⏱ ${preset.totalDuration} mins`;
    if (preset.difficulty) html += ` • 💢 Difficulty: ${preset.difficulty}`;
    html += `</div>`;
  }

  html += `<div class="preview-sub">Exercises:</div>`;

  (preset.items || []).forEach((it) => {
    const name = it.customName || it.workout?.name || "Unnamed";
    const sets = it.customSets || it.workout?.sets || "";
    const reps = it.customReps || it.workout?.reps || "";

    html += `
      <div class="preview-item">
        ${name}
        ${sets ? ` • ${sets} sets` : ""}
        ${reps ? ` × ${reps} reps` : ""}
      </div>
    `;
  });

  return html;
}

// -----------------------
// MODAL OPEN/CLOSE
// -----------------------
function openCreatePresetModal() {
  editingPreset = null;
  presetItems = [];

  presetModalTitle.textContent = "Create new preset";

  presetNameInput.value = "";
  presetDurationInput.value = "";
  presetDifficultyInput.value = "";
  presetNotesInput.value = "";
  presetItemsListEl.innerHTML = "";

  if (deletePresetBtn) deletePresetBtn.style.display = "none";
  if (presetModalBackdrop) presetModalBackdrop.classList.add("open");
}

async function openEditPresetModal(id) {
  editingPreset = presets.find((p) => p.id === id);
  if (!editingPreset) return;

  presetModalTitle.textContent = "Edit preset";

  presetNameInput.value = editingPreset.name;
  presetDurationInput.value = editingPreset.totalDuration || "";
  presetDifficultyInput.value = editingPreset.difficulty || "";
  presetNotesInput.value = editingPreset.notes || "";

  presetItems = [...(editingPreset.items || [])];
  renderPresetItems();

  if (deletePresetBtn) deletePresetBtn.style.display = "inline-flex";
  if (presetModalBackdrop) presetModalBackdrop.classList.add("open");
}

function closePresetModal() {
  if (presetModalBackdrop) presetModalBackdrop.classList.remove("open");
}

// Bind modal controls
if (createPresetBtn) createPresetBtn.addEventListener("click", openCreatePresetModal);
if (presetModalCloseBtn) presetModalCloseBtn.addEventListener("click", closePresetModal);

window.addEventListener("click", (e) => {
  if (e.target === presetModalBackdrop) closePresetModal();
});

// -----------------------
// PRESET ITEMS RENDER
// -----------------------
function renderPresetItems() {
  presetItemsListEl.innerHTML = "";

  if (presetItems.length === 0) {
    presetItemsListEl.innerHTML = `<div class="list-item">No exercises added yet.</div>`;
    return;
  }

  presetItems.forEach((item, index) => {
    const el = document.createElement("div");
    el.className = "list-item";

    const name = item.customName || item.workout?.name || "Unnamed exercise";
    const sets = item.customSets || item.workout?.sets || "";
    const reps = item.customReps || item.workout?.reps || "";

    el.innerHTML = `
      <div class="list-item-header">
        <div>
          <div class="list-title">${name}</div>
          <div class="list-meta">
            ${sets ? sets + " sets" : ""}
            ${reps ? " × " + reps + " reps" : ""}
          </div>
        </div>

        <div style="display:flex; gap:6px;">
          <button class="btn-link" data-up="${index}">↑</button>
          <button class="btn-link" data-down="${index}">↓</button>
          <button class="btn-danger" data-del="${index}">Delete</button>
        </div>
      </div>
    `;

    presetItemsListEl.appendChild(el);
  });

  document.querySelectorAll("[data-up]").forEach((btn) =>
    btn.addEventListener("click", () => moveItemUp(btn.dataset.up))
  );
  document.querySelectorAll("[data-down]").forEach((btn) =>
    btn.addEventListener("click", () => moveItemDown(btn.dataset.down))
  );
  document.querySelectorAll("[data-del]").forEach((btn) =>
    btn.addEventListener("click", () => deleteItem(btn.dataset.del))
  );
}

function moveItemUp(i) {
  i = Number(i);
  if (i <= 0) return;
  [presetItems[i - 1], presetItems[i]] = [presetItems[i], presetItems[i - 1]];
  renderPresetItems();
}

function moveItemDown(i) {
  i = Number(i);
  if (i >= presetItems.length - 1) return;
  [presetItems[i + 1], presetItems[i]] = [presetItems[i], presetItems[i + 1]];
  renderPresetItems();
}

function deleteItem(i) {
  presetItems.splice(Number(i), 1);
  renderPresetItems();
}

// -----------------------
// PRESETS LIST RENDER
// -----------------------
function renderPresets() {
  presetsListEl.innerHTML = "";

  if (!presets || presets.length === 0) {
    presetsListEl.innerHTML = `<div class="list-item">No presets created yet.</div>`;
    return;
  }

  presets.forEach((p) => {
    const item = document.createElement("div");
    item.className = "list-item fade-slide";

    item.innerHTML = `
      <div class="list-item-header">
        <div>
          <div class="list-title">${p.name}</div>
          <div class="list-meta">${p.items?.length || 0} exercises</div>
        </div>
        <button class="btn-link" data-edit="${p.id}">Edit</button>
      </div>
    `;

    presetsListEl.appendChild(item);
    setTimeout(() => item.classList.add("visible"), 20);
  });

  document.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = Number(btn.getAttribute("data-edit"));
      openEditPresetModal(id);
    });
  });
}

// =============================
// BACKEND HELPERS
// =============================
function authFetch(url, options = {}) {
  const token = localStorage.getItem("token");
  const headers = options.headers ? { ...options.headers } : {};

  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (options.body && !headers["Content-Type"]) headers["Content-Type"] = "application/json";

  return fetch(url, { ...options, headers });
}

async function loadPresets() {
  const res = await authFetch("/presets-api");
  if (res.status === 401) {
    alert("You must be logged in to use Plans.");
    return [];
  }
  const data = await res.json().catch(() => []);
  return Array.isArray(data) ? data : [];
}

async function loadWeeklyPlan() {
  const res = await authFetch("/weekplan-api");
  if (res.status === 401) {
    alert("You must be logged in to use Plans.");
    return null;
  }
  const data = await res.json().catch(() => null);
  return data && typeof data === "object" ? data : null;
}

async function saveDay(dayKey, presetId) {
  const res = await authFetch(`/weekplan-api/day/${dayKey}`, {
    method: "PUT",
    body: JSON.stringify({ presetId }),
  });

  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    throw new Error(payload?.error || payload?.message || `Failed to save ${dayKey}`);
  }
}

async function resetPlan() {
  const res = await authFetch("/weekplan-api", { method: "DELETE" });

  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    throw new Error(payload?.error || payload?.message || "Failed to reset weekly plan");
  }
}

// =============================
// WEEKLY PLAN UI (SEARCHABLE INPUTS)
// =============================
function getWrapper(day) {
  return document.querySelector(`.searchable-select[data-day="${day}"]`);
}

function setDraftDay(day, presetId) {
  draftPlan[day] = presetId;
  const wrapper = getWrapper(day);
  if (wrapper) wrapper.dataset.presetId = presetId == null ? "" : String(presetId);
}

function applyWeeklyPlanToInputs() {
  DAY_KEYS.forEach((day) => {
    const wrapper = getWrapper(day);
    if (!wrapper) return;

    const input = wrapper.querySelector("input");
    if (!input) return;

    const presetId = weeklyPlan?.[`${day}Id`] ?? null;

    // sync both UI + draft
    setDraftDay(day, presetId);

    if (!presetId) {
      input.value = "";
      return;
    }

    const p = presets.find((x) => x.id === presetId);
    input.value = p ? p.name : "";
  });
}

async function saveWeeklyPlanDraft() {
  for (const day of DAY_KEYS) {
    const presetId = day in draftPlan ? draftPlan[day] : null;
    await saveDay(day, presetId);
  }
}

function initSearchableDropdowns() {
  document.querySelectorAll(".searchable-select").forEach((wrapper) => {
    const day = wrapper.getAttribute("data-day");
    const input = wrapper.querySelector("input");
    const list = wrapper.querySelector(".searchable-options");
    if (!day || !input || !list) return;

    function refreshList() {
      const query = input.value.toLowerCase();
      list.innerHTML = "";
      list.style.display = "block";

      // default option
      const none = document.createElement("div");
      none.textContent = "-- No preset --";
      none.addEventListener("click", () => {
        input.value = "";
        list.style.display = "none";
        setDraftDay(day, null); // ✅ draft only (no auto-save)
      });
      list.appendChild(none);

      presets
        .filter((p) => p.name.toLowerCase().includes(query))
        .forEach((preset) => {
          const div = document.createElement("div");
          div.textContent = preset.name;

          // CLICK = draft assign only
          div.addEventListener("click", () => {
            input.value = preset.name;
            list.style.display = "none";
            setDraftDay(day, preset.id); // ✅ draft only
          });

          // HOVER PREVIEW
          div.addEventListener("mouseenter", (e) => {
            const html = getPresetPreviewHTML(preset);
            showTooltip(html, e.clientX, e.clientY);
          });

          div.addEventListener("mousemove", (e) => {
            if (!tooltip) return;
            tooltip.style.left = e.clientX + 15 + "px";
            tooltip.style.top = e.clientY + 15 + "px";
          });

          div.addEventListener("mouseleave", hideTooltip);

          list.appendChild(div);
        });
    }

    input.addEventListener("input", refreshList);
    input.addEventListener("focus", refreshList);

    document.addEventListener("click", (e) => {
      if (!wrapper.contains(e.target)) list.style.display = "none";
    });
  });
}

// =============================
// CUSTOM ITEM + WORKOUT LIBRARY
// =============================
let workoutLibrary = [];

async function loadLibrary() {
  const res = await fetch("/workouts-api");
  const data = await res.json().catch(() => []);
  workoutLibrary = Array.isArray(data) ? data : [];
  renderLibraryResults();
}

function renderLibraryResults() {
  const searchEl = document.getElementById("librarySearchInput");
  const muscleEl = document.getElementById("libraryMuscleFilter");
  const list = document.getElementById("libraryResultsList");
  if (!searchEl || !muscleEl || !list) return;

  const search = searchEl.value.toLowerCase();
  const muscle = muscleEl.value;

  list.innerHTML = "";

  const filtered = workoutLibrary.filter((w) => {
    return (!muscle || w.muscleGroup === muscle) && w.name.toLowerCase().includes(search);
  });

  filtered.forEach((w) => {
    const item = document.createElement("div");
    item.className = "list-item";

    item.innerHTML = `
      <div class="list-item-header">
        <div>
          <div class="list-title">${w.name}</div>
          <div class="list-meta">${w.muscleGroup}</div>
        </div>
        <button class="btn-link" data-add-workout="${w.id}">Add</button>
      </div>
    `;

    list.appendChild(item);
  });

  document.querySelectorAll("[data-add-workout]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const workoutId = Number(btn.getAttribute("data-add-workout"));
      const workout = workoutLibrary.find((w) => w.id === workoutId);

      presetItems.push({
        workoutId,
        workout,
      });

      renderPresetItems();
    });
  });
}

// =============================
// SAVE/DELETE PRESET
// =============================
async function savePreset() {
  const name = presetNameInput.value.trim();
  if (!name) {
    alert("Preset name is required.");
    return;
  }

  // Keep your current behavior; minimal change:
  // (If your backend ever rejects extra fields, we can sanitize items later.)
  const data = {
    name,
    totalDuration: presetDurationInput.value ? Number(presetDurationInput.value) : null,
    difficulty: presetDifficultyInput.value ? Number(presetDifficultyInput.value) : null,
    notes: presetNotesInput.value.trim(),
    items: presetItems.map((item, index) => ({
      ...item,
      order: index,
    })),
  };

  let res;
  if (!editingPreset) {
    res = await authFetch("/presets-api", {
      method: "POST",
      body: JSON.stringify(data),
    });
  } else {
    res = await authFetch(`/presets-api/${editingPreset.id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    alert(payload?.error || payload?.message || "Error saving preset.");
    return;
  }

  closePresetModal();

  presets = await loadPresets();
  renderPresets();

  // reload weekly plan + reapply (in case preset deleted/renamed)
  weeklyPlan = await loadWeeklyPlan();
  applyWeeklyPlanToInputs();
}

async function deletePreset() {
  if (!editingPreset) return;
  if (!confirm("Delete this preset?")) return;

  const res = await authFetch(`/presets-api/${editingPreset.id}`, { method: "DELETE" });
  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    alert(payload?.error || payload?.message || "Failed to delete preset.");
    return;
  }

  closePresetModal();

  presets = await loadPresets();
  renderPresets();

  weeklyPlan = await loadWeeklyPlan();
  applyWeeklyPlanToInputs();
}

// =============================
// BIND EVENTS
// =============================
function bindEvents() {
  // Save preset
  if (savePresetBtn) savePresetBtn.addEventListener("click", savePreset);

  // Delete preset
  if (deletePresetBtn) deletePresetBtn.addEventListener("click", deletePreset);

  // Library filters
  const libSearch = document.getElementById("librarySearchInput");
  const libMuscle = document.getElementById("libraryMuscleFilter");
  if (libSearch) libSearch.addEventListener("input", renderLibraryResults);
  if (libMuscle) libMuscle.addEventListener("change", renderLibraryResults);

  // Add custom item
  const addCustomBtn = document.getElementById("addCustomItemBtn");
  if (addCustomBtn) {
    addCustomBtn.addEventListener("click", () => {
      const name = document.getElementById("customNameInput")?.value.trim();
      const sets = Number(document.getElementById("customSetsInput")?.value);
      const reps = Number(document.getElementById("customRepsInput")?.value);
      const dur = Number(document.getElementById("customDurationInput")?.value);
      const notes = document.getElementById("customNotesInput")?.value.trim();

      if (!name || !sets || !reps) {
        alert("Please enter name, sets, and reps.");
        return;
      }

      presetItems.push({
        customName: name,
        customSets: sets,
        customReps: reps,
        customDurationMin: dur || null,
        customNotes: notes || null,
      });

      renderPresetItems();

      document.getElementById("customNameInput").value = "";
      document.getElementById("customSetsInput").value = "";
      document.getElementById("customRepsInput").value = "";
      document.getElementById("customDurationInput").value = "";
      document.getElementById("customNotesInput").value = "";
    });
  }

  // Reset weekly plan (DB + UI)
  if (resetPlanBtn) {
    resetPlanBtn.addEventListener("click", async () => {
      if (!confirm("Reset weekly plan?")) return;

      try {
        await resetPlan();
        weeklyPlan = await loadWeeklyPlan();
        applyWeeklyPlanToInputs(); // clears UI + draft
        alert("Weekly plan reset.");
      } catch (e) {
        alert(e.message || "Reset failed.");
      }
    });
  }

  // Save weekly plan (draft -> DB)
  if (savePlanBtn) {
    savePlanBtn.addEventListener("click", async () => {
      try {
        await saveWeeklyPlanDraft();
        weeklyPlan = await loadWeeklyPlan();
        applyWeeklyPlanToInputs();
        alert("Weekly plan saved!");
      } catch (e) {
        alert(e.message || "Save weekly plan failed.");
      }
    });
  }
}

// =============================
// INIT
// =============================
document.addEventListener("DOMContentLoaded", async () => {
  await loadLibrary();
  presets = await loadPresets();
  weeklyPlan = await loadWeeklyPlan();

  renderPresets();

  initSearchableDropdowns();
  applyWeeklyPlanToInputs();

  bindEvents();
});
