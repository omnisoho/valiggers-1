// =============================
// STATS PAGE – GLOBAL-ONLY VERSION
// =============================

// Lightweight state machine to manage UI feedback
// The widget only allows the following transitions:
// idle -> loading -> (ready | empty | error)
// From any terminal state, we can go back to loading to re-fetch data.
const StatsState = {
  current: "idle", // idle | loading | ready | empty | error

  transition(next) {
    const allowed = {
      idle: ["loading"],
      loading: ["ready", "empty", "error"],
      ready: ["loading"],
      empty: ["loading"],
      error: ["loading"],
    };

    if (!allowed[this.current]?.includes(next)) {
      console.warn(`Blocked invalid state change: ${this.current} -> ${next}`);
      return false;
    }

    this.current = next;
    renderStateBanner(next);
    return true;
  },
};

function renderStateBanner(state) {
  const el = document.getElementById("statsStateBanner");
  if (!el) return;

  el.className = "state-banner";
  const icon = el.querySelector(".state-icon");
  const text = el.querySelector(".state-text");

  if (!icon || !text) return;

  if (state === "loading") {
    icon.textContent = "⏳";
    text.textContent = "Loading latest popularity stats...";
    el.classList.add("state-loading");
  } else if (state === "ready") {
    icon.textContent = "✅";
    text.textContent = "Stats are up to date.";
    el.classList.add("state-ready");
  } else if (state === "empty") {
    icon.textContent = "📭";
    text.textContent = "No workout stats yet. Add workouts to see trends.";
    el.classList.add("state-empty");
  } else if (state === "error") {
    icon.textContent = "⚠️";
    text.textContent = "Could not load stats right now. Please try again.";
    el.classList.add("state-error");
  }
}
// Load stats from backend (global only)
async function loadStats() {
  const res = await fetch("/stats-api"); // No token needed anymore
  if (!res.ok) {
    throw new Error(`Stats request failed with ${res.status}`);
  }
  const data = await res.json();
  console.log("Stats loaded:", data);
  return data.global || {};
}

// ---------------------
// BASIC CARD RENDERING
// ---------------------
function renderBasicStats(g) {
  const totalEl = document.getElementById("statsTotalWorkouts");
  const topNameEl = document.getElementById("statsTopWorkoutName");
  const topMetaEl = document.getElementById("statsTopWorkoutMeta");
  const comNameEl = document.getElementById("statsTopCommentedName");
  const comMetaEl = document.getElementById("statsTopCommentedMeta");

  if (totalEl) totalEl.textContent = g.totalWorkouts ?? 0;

  // Most upvoted
  if (g.mostUpvoted && topNameEl && topMetaEl) {
    const w = g.mostUpvoted;
    topNameEl.textContent = w.name;
    topMetaEl.textContent = `${w.upvotes} upvotes · ${w.muscleGroup}`;
  } else {
    topNameEl.textContent = "—";
    topMetaEl.textContent = "No data";
  }

  // Most commented
  if (g.mostCommented && comNameEl && comMetaEl) {
    const w = g.mostCommented;
    const c = w.commentCount ?? 0;
    comNameEl.textContent = w.name;
    comMetaEl.textContent = `${c} comments · ${w.muscleGroup}`;
  } else {
    comNameEl.textContent = "—";
    comMetaEl.textContent = "No data";
  }
}

// ---------------------
// HORIZONTAL BAR: Upvotes per muscle group
// ---------------------
function renderMuscleUpvoteChart(g) {
  const canvas = document.getElementById("muscleUpvoteChart");
  const arr = g.muscleUpvotes || [];
  if (!canvas || !arr.length) return;

  const labels = arr.map((x) => x.muscleGroup);
  const values = arr.map((x) => x.totalUpvotes || 0);

  new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Total Upvotes",
          data: values,
          backgroundColor: "#38bdf8",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: "y",
      plugins: { legend: { display: false } },
      scales: {
        x: { beginAtZero: true },
        y: { ticks: { autoSkip: false } },
      },
    },
  });
}

// ---------------------
// VERTICAL BAR: Workout count per muscle group
// ---------------------
function renderMuscleCountChart(g) {
  const canvas = document.getElementById("muscleCountChart");
  const arr = g.muscleGroupCounts || [];
  if (!canvas || !arr.length) return;

  const labels = arr.map((x) => x.muscleGroup);
  const values = arr.map((x) => x.count || 0);

  new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Workout Count",
          data: values,
          backgroundColor: "#4ade80",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true },
        x: {
          ticks: { autoSkip: false },
        },
      },
    },
  });
}

// ---------------------
// INIT PAGE
// ---------------------
document.addEventListener("DOMContentLoaded", async () => {
  try {
    StatsState.transition("loading");
    const globalStats = await loadStats();
     const isEmpty =
      !globalStats ||
      ((globalStats.totalWorkouts ?? 0) === 0 &&
        !(globalStats.muscleUpvotes?.length || 0) &&
        !(globalStats.muscleGroupCounts?.length || 0));

    if (isEmpty) {
      renderBasicStats({});
      StatsState.transition("empty");
      return;
    }

    renderBasicStats(globalStats);
    renderMuscleUpvoteChart(globalStats);
    renderMuscleCountChart(globalStats);
    StatsState.transition("ready");
  } catch (err) {
    console.error("Stats load failed:", err);
    StatsState.transition("error");
  }
});
