// ==========================================
// WORKOUTS PAGE – FULL BACKEND INTEGRATION
// ==========================================

let allWorkouts = [];
let currentWorkoutId = null;
let editingWorkoutId = null;

// ---------- AUTH HELPERS ----------

function getLoggedInUserId() {
  const token = localStorage.getItem("token");
  if (!token) return null;
  try {
    const payloadBase64 = token.split(".")[1];
    const payloadJson = atob(payloadBase64);
    const payload = JSON.parse(payloadJson);
    return payload.userId || null;
  } catch (err) {
    console.warn("Failed to decode JWT:", err);
    return null;
  }
}

const loggedInUserId = getLoggedInUserId();

function authFetch(url, options = {}) {
  const token = localStorage.getItem("token");
  const headers = options.headers ? { ...options.headers } : {};

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  if (options.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  return fetch(url, { ...options, headers });
}

// ---------- HELPER: RENDER COMMENTS ----------

function renderComments(workout) {
  const modalCommentsList = document.getElementById("modalCommentsList");
  if (!modalCommentsList) return;

  modalCommentsList.innerHTML = "";

  const comments = workout.comments || [];
  if (!comments.length) {
    modalCommentsList.innerHTML =
      '<div class="list-item"><div>No comments yet. Be the first to share your thoughts.</div></div>';
    return;
  }

  comments
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .forEach((c) => {
      let displayName = "Guest";
      let displayText = c.text || "";

      const idx = displayText.indexOf(": ");
      if (idx > 0) {
        displayName = displayText.slice(0, idx);
        displayText = displayText.slice(idx + 2);
      } else if (c.userId) {
        displayName = `User #${c.userId}`;
      }

      const dateStr = c.createdAt
        ? new Date(c.createdAt).toLocaleString()
        : "";

      const item = document.createElement("div");
      item.className = "list-item";
      item.innerHTML = `
        <div class="list-item-header">
          <div>
            <div class="list-title">${displayName}</div>
            <div class="list-meta">${dateStr}</div>
          </div>
        </div>
        <div class="list-body">${displayText}</div>
      `;
      modalCommentsList.appendChild(item);
    });
}

// ---------- HELPER: OPEN/CLOSE DETAIL MODAL ----------

function openWorkoutModal(id, options = {}) {
  const modalBackdrop = document.getElementById("workoutModalBackdrop");
  if (!modalBackdrop) return;

  const workout = allWorkouts.find((w) => w.id === id);
  if (!workout) return;

  currentWorkoutId = id;

  const modalWorkoutName = document.getElementById("modalWorkoutName");
  const modalWorkoutMeta = document.getElementById("modalWorkoutMeta");
  const modalWorkoutDescription = document.getElementById(
    "modalWorkoutDescription"
  );
  const modalWorkoutDetails = document.getElementById("modalWorkoutDetails");
  const modalUpvoteCount = document.getElementById("modalUpvoteCount");
  const modalDownvoteCount = document.getElementById("modalDownvoteCount");
  const modalViewStatsLink = document.getElementById("modalViewStatsLink");

  const difficultyLabel = workout.difficulty
    ? `Difficulty ${workout.difficulty}/5`
    : "Unrated";

  if (modalWorkoutName) modalWorkoutName.textContent = workout.name;

  if (modalWorkoutMeta)
    modalWorkoutMeta.textContent = `${workout.muscleGroup} · ${difficultyLabel} · ${
      workout.durationMin ? `${workout.durationMin} min` : "Duration N/A"
    }`;

  if (modalWorkoutDescription)
    modalWorkoutDescription.textContent = workout.description || "";

  const createdStr = workout.createdAt
    ? new Date(workout.createdAt).toLocaleString()
    : "Unknown";

  if (modalWorkoutDetails) {
    modalWorkoutDetails.innerHTML = `
      <div>Sets: ${workout.sets ?? "?"}</div>
      <div>Reps: ${workout.reps ?? "?"}</div>
      <div>Duration: ${workout.durationMin ?? "?"} min</div>
      <div>Created: ${createdStr}</div>
      <div>Created by userId: ${workout.createdById ?? "N/A"}</div>
    `;
  }

  if (modalUpvoteCount) modalUpvoteCount.textContent = workout.upvotes ?? 0;
  if (modalDownvoteCount)
    modalDownvoteCount.textContent = workout.downvotes ?? 0;

  if (modalViewStatsLink) {
    modalViewStatsLink.href = `/stats?workoutId=${encodeURIComponent(
      workout.id
    )}`;
  }

  renderComments(workout);

  if (!options.keepOpen) {
    modalBackdrop.classList.add("open");
  }
}

function closeWorkoutModal() {
  const modalBackdrop = document.getElementById("workoutModalBackdrop");
  if (!modalBackdrop) return;
  modalBackdrop.classList.remove("open");
  currentWorkoutId = null;
}

// ---------- EDIT MODAL HELPERS ----------

function openEditModal(workout) {
  const backdrop = document.getElementById("editWorkoutBackdrop");
  if (!backdrop) return;

  editingWorkoutId = workout.id;

  document.getElementById("editWorkoutName").value = workout.name || "";
  document.getElementById("editWorkoutMuscle").value =
    workout.muscleGroup || "";
  document.getElementById("editWorkoutDifficulty").value =
    workout.difficulty != null ? String(workout.difficulty) : "";
  document.getElementById("editWorkoutDuration").value =
    workout.durationMin != null ? String(workout.durationMin) : "";
  document.getElementById("editWorkoutSets").value =
    workout.sets != null ? String(workout.sets) : "";
  document.getElementById("editWorkoutReps").value =
    workout.reps != null ? String(workout.reps) : "";
  document.getElementById("editWorkoutDescription").value =
    workout.description || "";

  backdrop.classList.add("open");
}

function closeEditModal() {
  const backdrop = document.getElementById("editWorkoutBackdrop");
  if (!backdrop) return;
  backdrop.classList.remove("open");
  editingWorkoutId = null;
}

// ---------- RENDER WORKOUT CARDS ----------

function renderWorkouts() {
  const grid = document.getElementById("workoutGrid");
  const searchInput = document.getElementById("searchInput");
  const sortSelect = document.getElementById("sortSelect");

  if (!grid) {
    console.error("Missing #workoutGrid");
    return;
  }

  const term = searchInput ? searchInput.value.toLowerCase() : "";
  const sortMode = sortSelect ? sortSelect.value : "name-asc";

  let list = [...allWorkouts];

  // Filter
  list = list.filter((w) => {
    const difficultyLabel = w.difficulty ? `difficulty ${w.difficulty}` : "";
    const text = `${w.name} ${w.muscleGroup} ${difficultyLabel}`.toLowerCase();
    return text.includes(term);
  });

  // Sort
  list.sort((a, b) => {
    if (sortMode === "name-asc") return a.name.localeCompare(b.name);
    if (sortMode === "upvotes-desc")
      return (b.upvotes || 0) - (a.upvotes || 0);
    if (sortMode === "newest-desc") {
      const da = a.createdAt ? new Date(a.createdAt) : new Date(0);
      const db = b.createdAt ? new Date(b.createdAt) : new Date(0);
      return db - da;
    }
    return 0;
  });

  // Render
  grid.innerHTML = "";

  if (!list.length) {
    grid.innerHTML =
      "<div class='card'><div>No workouts match your search.</div></div>";
    return;
  }

  list.forEach((w) => {
    const card = document.createElement("article");
    card.className = "card workout-card-animate";
    grid.appendChild(card);
    requestAnimationFrame(() => card.classList.add("visible"));

    const commentCount = (w.comments || []).length;
    const score = (w.upvotes || 0) - (w.downvotes || 0);
    const difficultyStars = w.difficulty
      ? "⭐".repeat(Number(w.difficulty)) + ` (${w.difficulty}/5)`
      : "Unrated";

    const isOwner =
      loggedInUserId != null && w.createdById === loggedInUserId;

    card.innerHTML = `
      <div class="workout-card-header">
        <div>
          <div class="card-title">${w.name}</div>
          <div class="card-subtitle">
            ${w.muscleGroup} · ${difficultyStars} · ${
      w.durationMin ? `${w.durationMin} min` : "Duration N/A"
    }
          </div>
        </div>
        <span class="tag tag-accent">
          ${w.sets ?? "?"} sets × ${w.reps ?? "?"} reps
        </span>
      </div>

      <div style="margin-top:10px;font-size:12px;color:var(--text-muted);">
        ${w.description || ""}
      </div>

      <div style="margin-top:10px;font-size:11px;color:var(--text-muted);display:flex;gap:10px;align-items:center;">
        <span>👍 ${w.upvotes ?? 0}</span>
        <span>👎 ${w.downvotes ?? 0}</span>
        <span>💬 ${commentCount}</span>
        <span>Score: ${score}</span>
      </div>

      <div class="card-footer">
        <button class="btn-link btn-details">Details & comments</button>
        <div style="display:flex;gap:6px;align-items:center;">
          <button class="btn-pill btn-upvote" style="padding:4px 10px;font-size:11px;">👍</button>
          <button class="btn-pill btn-downvote" style="padding:4px 10px;font-size:11px;">👎</button>
          ${
            isOwner
              ? `
            <button class="btn-pill btn-edit" style="padding:4px 10px;font-size:11px;background:#38bdf8;">✏️ Edit</button>
            <button class="btn-pill btn-delete" style="padding:4px 10px;font-size:11px;background:#f97373;">🗑 Delete</button>
          `
              : ""
          }
        </div>
      </div>
    `;

    card
      .querySelector(".btn-details")
      .addEventListener("click", () => openWorkoutModal(w.id));

    card
      .querySelector(".btn-upvote")
      .addEventListener("click", () => voteWorkout(w.id, "up"));

    card
      .querySelector(".btn-downvote")
      .addEventListener("click", () => voteWorkout(w.id, "down"));

    if (isOwner) {
      const deleteBtn = card.querySelector(".btn-delete");
      const editBtn = card.querySelector(".btn-edit");

      if (deleteBtn) {
        deleteBtn.addEventListener("click", () => deleteWorkout(w.id));
      }
      if (editBtn) {
        editBtn.addEventListener("click", () => openEditModal(w));
      }
    }

    grid.appendChild(card);
    requestAnimationFrame(() => card.classList.add("visible"));
  });
}

// ---------- LOAD FROM BACKEND ----------

function loadWorkouts() {
  return fetch("/workouts-api")
    .then((res) => res.json())
    .then((data) => {
      console.log("Loaded workouts from backend:", data);
      allWorkouts = Array.isArray(data) ? data : [];
      renderWorkouts();
    })
    .catch((err) => {
      console.error("Error fetching workouts:", err);
    });
}

// ---------- CREATE WORKOUT ----------

function createWorkout(event) {
  event.preventDefault();

  const name = document.getElementById("newWorkoutName").value.trim();
  const muscle = document.getElementById("newWorkoutMuscle").value;
  const difficultyStr =
    document.getElementById("newWorkoutDifficulty").value.trim();
  const durationStr =
    document.getElementById("newWorkoutDuration").value.trim();
  const setsStr = document.getElementById("newWorkoutSets").value.trim();
  const repsStr = document.getElementById("newWorkoutReps").value.trim();
  const description = document
    .getElementById("newWorkoutDescription")
    .value.trim();

  if (!name || !muscle || !description) {
    return;
  }

  const difficulty = difficultyStr ? Number(difficultyStr) : null;
  const durationMin = durationStr ? Number(durationStr) : null;
  const sets = setsStr ? Number(setsStr) : null;
  const reps = repsStr ? Number(repsStr) : null;

  const payload = {
    name,
    muscleGroup: muscle,
    difficulty,
    durationMin,
    sets,
    reps,
    description,
  };

  authFetch("/workouts-api", {
    method: "POST",
    body: JSON.stringify(payload),
  })
    .then(async (res) => {
      if (res.status === 401) {
        alert("You must be logged in to create a workout.");
        return;
      }
      const w = await res.json();
      console.log("Workout created:", w);
      document.getElementById("addWorkoutBackdrop").classList.remove("open");
      document.getElementById("addWorkoutForm").reset();
      loadWorkouts();
    })
    .catch((err) => console.error("Create workout failed:", err));
}

// ---------- EDIT WORKOUT ----------

function editWorkout(event) {
  event.preventDefault();
  if (!editingWorkoutId) return;

  const name = document.getElementById("editWorkoutName").value.trim();
  const muscle = document.getElementById("editWorkoutMuscle").value;
  const difficultyStr =
    document.getElementById("editWorkoutDifficulty").value.trim();
  const durationStr =
    document.getElementById("editWorkoutDuration").value.trim();
  const setsStr = document.getElementById("editWorkoutSets").value.trim();
  const repsStr = document.getElementById("editWorkoutReps").value.trim();
  const description = document
    .getElementById("editWorkoutDescription")
    .value.trim();

  if (!name || !muscle || !description) {
    return;
  }

  const difficulty = difficultyStr ? Number(difficultyStr) : null;
  const durationMin = durationStr ? Number(durationStr) : null;
  const sets = setsStr ? Number(setsStr) : null;
  const reps = repsStr ? Number(repsStr) : null;

  const payload = {
    name,
    muscleGroup: muscle,
    difficulty,
    durationMin,
    sets,
    reps,
    description,
  };

  authFetch(`/workouts-api/${editingWorkoutId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  })
    .then(async (res) => {
      if (res.status === 401) {
        alert("You must be logged in to edit a workout.");
        return;
      }
      if (res.status === 403) {
        alert("You can only edit workouts you created.");
        return;
      }
      const w = await res.json();
      console.log("Workout updated:", w);
      closeEditModal();
      loadWorkouts();
    })
    .catch((err) => console.error("Edit workout failed:", err));
}

// ---------- DELETE WORKOUT ----------

function deleteWorkout(id) {
  if (!confirm("Delete this workout?")) return;

  authFetch(`/workouts-api/${id}`, { method: "DELETE" })
    .then(async (res) => {
      if (res.status === 401) {
        alert("You must be logged in to delete a workout.");
        return;
      }
      if (res.status === 403) {
        alert("You can only delete workouts you created.");
        return;
      }
      const data = await res.json();
      console.log("Workout deleted:", data);
      if (currentWorkoutId === id) {
        closeWorkoutModal();
      }
      loadWorkouts();
    })
    .catch((err) => console.error("Delete workout failed:", err));
}

// ---------- VOTE WORKOUT ----------

function voteWorkout(id, type) {
  const endpoint =
    type === "up"
      ? `/workouts-api/${id}/upvote`
      : `/workouts-api/${id}/downvote`;

  fetch(endpoint, { method: "POST" })
    .then((res) => res.json())
    .then(() =>
      loadWorkouts().then(() => {
        if (currentWorkoutId === id) {
          openWorkoutModal(id, { keepOpen: true });
        }
      })
    )
    .catch((err) => console.error("Vote failed:", err));
}

// ---------- ADD COMMENT ----------

function submitComment(event) {
  event.preventDefault();
  if (!currentWorkoutId) return;

  const usernameInput = document.getElementById("commentUsername");
  const textInput = document.getElementById("commentText");

  const rawName = usernameInput ? usernameInput.value.trim() : "";
  const rawText = textInput ? textInput.value.trim() : "";

  if (!rawText) return;

  const payloadText = rawName ? `${rawName}: ${rawText}` : rawText;

  fetch(`/workouts-api/${currentWorkoutId}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: payloadText }),
  })
    .then((res) => res.json())
    .then(() => {
      if (usernameInput) usernameInput.value = "";
      if (textInput) textInput.value = "";
      loadWorkouts().then(() => {
        if (currentWorkoutId) {
          openWorkoutModal(currentWorkoutId, { keepOpen: true });
        }
      });
    })
    .catch((err) => console.error("Create comment failed:", err));
}

// ---------- BIND EVENTS ----------

document.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.getElementById("searchInput");
  const searchBtn = document.getElementById("searchBtn");
  const sortSelect = document.getElementById("sortSelect");

  const addWorkoutBtn = document.getElementById("addWorkoutBtn");
  const addWorkoutBackdrop = document.getElementById("addWorkoutBackdrop");
  const addWorkoutCloseBtn = document.getElementById("addWorkoutCloseBtn");
  const addWorkoutForm = document.getElementById("addWorkoutForm");

  const modalBackdrop = document.getElementById("workoutModalBackdrop");
  const modalCloseBtn = document.getElementById("modalCloseBtn");
  const commentForm = document.getElementById("commentForm");
  const modalUpvoteBtn = document.getElementById("modalUpvoteBtn");
  const modalDownvoteBtn = document.getElementById("modalDownvoteBtn");

  const editWorkoutBackdrop = document.getElementById("editWorkoutBackdrop");
  const editWorkoutCloseBtn = document.getElementById("editWorkoutCloseBtn");
  const editWorkoutForm = document.getElementById("editWorkoutForm");

  if (searchInput) {
    searchInput.addEventListener("input", renderWorkouts);
    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        renderWorkouts();
      }
    });
  }

  if (searchBtn) {
    searchBtn.addEventListener("click", renderWorkouts);
  }

  if (sortSelect) {
    sortSelect.addEventListener("change", renderWorkouts);
  }

  if (addWorkoutBtn && addWorkoutBackdrop) {
    addWorkoutBtn.addEventListener("click", () => {
      addWorkoutBackdrop.classList.add("open");
    });
  }

  if (addWorkoutCloseBtn && addWorkoutBackdrop) {
    addWorkoutCloseBtn.addEventListener("click", () => {
      addWorkoutBackdrop.classList.remove("open");
    });

    addWorkoutBackdrop.addEventListener("click", (e) => {
      if (e.target === addWorkoutBackdrop) {
        addWorkoutBackdrop.classList.remove("open");
      }
    });
  }

  if (addWorkoutForm) {
    addWorkoutForm.addEventListener("submit", createWorkout);
  }

  if (modalCloseBtn) {
    modalCloseBtn.addEventListener("click", closeWorkoutModal);
  }

  if (modalBackdrop) {
    modalBackdrop.addEventListener("click", (e) => {
      if (e.target === modalBackdrop) {
        closeWorkoutModal();
      }
    });
  }

  if (commentForm) {
    commentForm.addEventListener("submit", submitComment);
  }

  if (modalUpvoteBtn) {
    modalUpvoteBtn.addEventListener("click", () => {
      if (currentWorkoutId) voteWorkout(currentWorkoutId, "up");
    });
  }

  if (modalDownvoteBtn) {
    modalDownvoteBtn.addEventListener("click", () => {
      if (currentWorkoutId) voteWorkout(currentWorkoutId, "down");
    });
  }

  if (editWorkoutCloseBtn && editWorkoutBackdrop) {
    editWorkoutCloseBtn.addEventListener("click", closeEditModal);

    editWorkoutBackdrop.addEventListener("click", (e) => {
      if (e.target === editWorkoutBackdrop) {
        closeEditModal();
      }
    });
  }

  if (editWorkoutForm) {
    editWorkoutForm.addEventListener("submit", editWorkout);
  }

  // Initial load
  loadWorkouts();
});
