function getCoachIdFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  return id ? String(id) : null;
}

function getCoachId() {
  const idFromQuery = getCoachIdFromQuery();
  if (idFromQuery) {
    localStorage.setItem("lastCoachId", idFromQuery);
    return idFromQuery;
  }

  const idFromCache = localStorage.getItem("lastCoachId");
  return idFromCache ? String(idFromCache) : null;
}

function getToken() {
  return localStorage.getItem("token");
}

function fmtMoney(n) {
  if (n === null || n === undefined) return "-";
  const num = Number(n);
  if (Number.isNaN(num)) return String(n);
  return `$${num.toFixed(0)}/hr`;
}

function specialtyLabel(s) {
  const map = {
    STRENGTH: "Strength",
    HYPERTROPHY: "Hypertrophy",
    WEIGHT_LOSS: "Weight Loss",
    REHAB: "Rehab",
    MOBILITY: "Mobility",
  };
  return map[s] || s;
}

function setStatus(msg) {
  document.getElementById("status").textContent = msg || "";
}

function renderCoach(coach) {
  const card = document.getElementById("coachCard");
  card.style.display = "block";

  const avatarEl = document.getElementById("coachAvatar");
  const nameEl = document.getElementById("coachName");
  const metaEl = document.getElementById("coachMeta");
  const bioEl = document.getElementById("coachBio");
  const pillsEl = document.getElementById("coachPills");

  // avatar
  avatarEl.innerHTML = "";
  const avatarUrl = coach.avatarUrl || coach.user?.pfpUrl || "";
  if (avatarUrl) {
    const img = document.createElement("img");
    img.src = avatarUrl;
    img.alt = "avatar";
    avatarEl.appendChild(img);
  } else {
    avatarEl.textContent = "👤";
  }

  const username = coach.user?.username ? `@${coach.user.username}` : "";
  nameEl.textContent = coach.displayName || "Coach";

  metaEl.textContent = `${username} • ${fmtMoney(coach.hourlyRate)} • ${coach.reviewCount ? `${Number(coach.avgRating).toFixed(1)}★ (${coach.reviewCount})` : "No reviews"}`;

  bioEl.textContent = coach.bio || coach.user?.bio || "No bio yet.";

  // pills
  pillsEl.innerHTML = "";
  const specs = Array.isArray(coach.specialties) ? coach.specialties : [];
  for (const s of specs) {
    const pill = document.createElement("span");
    pill.className = "pill";
    pill.textContent = specialtyLabel(s);
    pillsEl.appendChild(pill);
  }
}

function renderReviews(coach) {
  const list = document.getElementById("reviewsList");
  const summary = document.getElementById("reviewSummary");

  const count = Number(coach.reviewCount || 0);
  if (!count) {
    summary.textContent = "No reviews yet.";
    list.innerHTML = `<div class="hint">Be the first to leave a review after completing a booking.</div>`;
    return;
  }

  summary.textContent = `${Number(coach.avgRating).toFixed(2)}★ average from ${count} review(s)`;

  list.innerHTML = "";
  const reviews = Array.isArray(coach.reviews) ? coach.reviews : [];
  for (const r of reviews) {
    const el = document.createElement("div");
    el.className = "review";

    const user = r.user?.username ? `@${r.user.username}` : "User";
    const stars = `${"★".repeat(Number(r.rating || 0))}${"☆".repeat(5 - Number(r.rating || 0))}`;
    const when = r.createdAt ? new Date(r.createdAt).toLocaleString() : "";

    el.innerHTML = `
      <div class="review-top">
        <div class="review-user">${user}</div>
        <div class="review-meta">${stars} ${when ? "• " + when : ""}</div>
      </div>
      <div class="review-comment">${r.comment ? escapeHtml(r.comment) : "<span style='color:rgba(255,255,255,0.65)'>No comment.</span>"}</div>
    `;

    list.appendChild(el);
  }
}

// safe escaping for comment display
function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
    .replaceAll("\n", "<br/>");
}

async function fetchCoach(id) {
  const res = await fetch(`/coaches/${id}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Failed to load coach (${res.status})`);
  }
  return res.json();
}

async function fetchEligibility(id) {
  const token = getToken();
  if (!token) return { canReview: false, reason: "Log in to leave a review." };

  const res = await fetch(`/coaches/${id}/reviews/eligibility`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    // if auth fails, treat as logged out
    if (res.status === 401) return { canReview: false, reason: "Log in to leave a review." };
    const err = await res.json().catch(() => ({}));
    return { canReview: false, reason: err.message || "Unable to check eligibility." };
  }

  return res.json();
}

function applyEligibilityUI(elig) {
  const hintEl = document.getElementById("eligibilityHint");
  const form = document.getElementById("reviewForm");
  const blocked = document.getElementById("reviewBlocked");

  hintEl.textContent = elig.canReview
    ? "You can leave a review because you completed a booking with this coach."
    : elig.reason || "You are not eligible to review yet.";

  if (elig.canReview) {
    blocked.style.display = "none";
    form.style.display = "flex";
  } else {
    form.style.display = "none";
    blocked.style.display = "block";
    blocked.textContent = elig.reason || "You can only review after completing a booking.";
  }
}

async function submitReview(coachId, rating, comment) {
  const token = getToken();
  if (!token) throw new Error("Not logged in");

  const res = await fetch(`/coaches/${coachId}/reviews`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ rating, comment }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Failed to submit review (${res.status})`);
  }

  return res.json();
}

function setBookingHint(msg) {
  document.getElementById("bookingHint").textContent = msg || "";
}

async function createBooking(coachId, startAtIso, endAtIso, notes) {
  const token = getToken();
  if (!token) throw new Error("Log in to book a lesson.");

  const res = await fetch("/bookings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      coachId: Number(coachId),
      startAt: startAtIso,
      endAt: endAtIso,
      notes,
    }),
  });

  if (res.status === 401) {
    localStorage.removeItem("token");
    throw new Error("Session expired. Please log in again.");
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Failed to create booking (${res.status})`);
  }

  return res.json();
}

function addMinutes(iso, mins) {
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() + Number(mins || 0));
  return d.toISOString();
}


async function main() {
  const coachId = getCoachId();
  if (!coachId) {
    setStatus("Missing coach id in URL. Example: /coach-detail?id=1");
    return;
  }

  // Wire booking immediately so submit is always intercepted, even if coach fetch is still in-flight.
  const bookingForm = document.getElementById("bookingForm");
  bookingForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const startLocal = document.getElementById("bookingStart").value; // datetime-local
    const duration = Number(document.getElementById("bookingDuration").value);
    const notes = document.getElementById("bookingNotes").value.trim();

    if (!startLocal) return;

    // convert datetime-local to ISO
    const startIso = new Date(startLocal).toISOString();
    const endIso = addMinutes(startIso, duration);

    try {
      setStatus("Creating booking...");
      await createBooking(coachId, startIso, endIso, notes);

      setStatus("Booking requested. Waiting for coach confirmation.");
      setBookingHint("Requested! You can view it in My Bookings (if you build that page).");
    } catch (err) {
      setStatus(err.message || "Failed to create booking.");
      setBookingHint(err.message || "Failed.");
    }
  });

  setStatus("Loading coach details...");
  try {
    const coach = await fetchCoach(coachId);
    renderCoach(coach);
    renderReviews(coach);

    const elig = await fetchEligibility(coachId);
    applyEligibilityUI(elig);

    setStatus("");
  } catch (e) {
    setStatus(e.message || "Something went wrong.");
  }

  // review form wiring
  const form = document.getElementById("reviewForm");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const rating = Number(document.getElementById("ratingInput").value);
    const comment = document.getElementById("commentInput").value.trim();

    try {
      setStatus("Submitting review...");
      await submitReview(coachId, rating, comment);

      // refresh coach + reviews
      const coach = await fetchCoach(coachId);
      renderCoach(coach);
      renderReviews(coach);

      setStatus("Review saved.");
      setTimeout(() => setStatus(""), 1200);
    } catch (err) {
      setStatus(err.message || "Failed to submit review.");
    }
  });

}

main();
