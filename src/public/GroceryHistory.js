const apiUrl = ".";
const token = localStorage.getItem("token");

if (!token) alert("You must be logged in to view history.");

const mealPrepContainer = document.getElementById("mealPrepHistory");
const shoppingContainer = document.getElementById("shoppingHistory");

async function fetchMealPrepHistory() {
  try {
    const res = await fetch(`${apiUrl}/grocery/meal-prep-history`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    renderMealPrepHistory(data.sessions || []);
  } catch (err) {
    console.error("Error fetching meal prep history:", err);
  }
}

async function fetchShoppingHistory() {
  try {
    const res = await fetch(`${apiUrl}/grocery/shopping-history`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    renderShoppingHistory(data.sessions || []);
  } catch (err) {
    console.error("Error fetching shopping history:", err);
  }
}

/* =========================
   Render Meal Prep
========================= */
/* =========================
   Render Meal Prep
========================= */
function renderMealPrepHistory(sessions) {
  mealPrepContainer.innerHTML = "";

  if (!sessions.length) {
    mealPrepContainer.innerHTML = `<div class="text-center text-muted">No meal prep sessions yet.</div>`;
    return;
  }

  sessions.forEach((s) => {
    const card = document.createElement("div");
    card.className = "session-card";

    // Header with timestamp and duration
    const header = document.createElement("div");
    header.className = "session-header";
    header.innerHTML = `<span>${new Date(s.createdAt).toLocaleString()}</span>
                        <span>Duration: ${formatDuration(s.durationSec)}</span>`;
    card.appendChild(header);

    // Show meal name (fallback to meal ID if unavailable)
    const mealInfo = document.createElement("div");
    mealInfo.className = "meal-info";
    const mealLabel = s.mealName || (s.mealId ? `#${s.mealId}` : "Unknown");
    mealInfo.textContent = `Meal: ${mealLabel}`;
    card.appendChild(mealInfo);

    // List of items
    if (s.items && s.items.length) {
      const list = document.createElement("div");
      list.className = "ingredient-list";

      s.items.forEach((i) => {
        const row = document.createElement("div");
        row.className = "ingredient-item";

        // Only show fields that exist in backend response
        row.innerHTML = `
          <span class="ingredient-name">${i.ingredientName}</span>
          <span>Required: ${i.requiredQuantity || "-"} ${
          i.quantityUnit || "" // optional, only if backend adds it
        }</span>
          <span>Status: ${i.preparationStatus || "N/A"} | Stock: ${
          i.stockStatus || "N/A"
        }</span>
        `;
        list.appendChild(row);
      });

      card.appendChild(list);
    }

    mealPrepContainer.appendChild(card);
  });
}


/* =========================
   Render Shopping
========================= */
function renderShoppingHistory(sessions) {
  shoppingContainer.innerHTML = "";

  if (!sessions.length) {
    shoppingContainer.innerHTML = `<div class="text-center text-muted">No shopping sessions yet.</div>`;
    return;
  }

  sessions.forEach((s) => {
    const card = document.createElement("div");
    card.className = "session-card";

    // Header with timestamp and duration
    const header = document.createElement("div");
    header.className = "session-header";
    header.innerHTML = `<span>${new Date(s.createdAt).toLocaleString()}</span>
                        <span>Duration: ${formatDuration(s.durationSec)}</span>`;
    card.appendChild(header);

    // List of items
    if (s.items && s.items.length) {
      const list = document.createElement("div");
      list.className = "ingredient-list";

      s.items.forEach((i) => {
        const row = document.createElement("div");
        row.className = "ingredient-item";

        // Only display fields that exist in backend response
        row.innerHTML = `
          <span class="ingredient-name">${i.ingredientName}</span>
          <span>Quantity: ${i.quantityAdded || "-"} ${i.quantityUnit || ""}</span>
          <span>Status: ${i.purchaseStatus || "N/A"} | Stock: ${
          i.stockStatus || "N/A"
        }</span>
        `;

        list.appendChild(row);
      });

      card.appendChild(list);
    }

    shoppingContainer.appendChild(card);
  });
}


function formatDuration(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${h}h ${m}m ${s}s`;
}

/* =========================
   INIT
========================= */
fetchMealPrepHistory();
fetchShoppingHistory();

/* =========================
   Sidebar toggle logic (reuse from smartGrocery.js)
========================= */
const sidebar = document.getElementById("sidebar");
const sidebarToggle = document.getElementById("sidebar-toggle");
const closeSidebar = document.getElementById("close-sidebar");
const mainLayout = document.querySelector(".main-layout");

sidebarToggle.onclick = () => {
  sidebar.classList.toggle("open");
  mainLayout.classList.toggle("shifted");
};

closeSidebar.onclick = () => {
  sidebar.classList.remove("open");
  mainLayout.classList.remove("shifted");
};
