const apiUrl = ".";
const token = localStorage.getItem("token");

if (!token) {
  alert("Login required.");
}

const listContainer = document.getElementById("expiry-list");
const emptyMsg = document.getElementById("empty-msg");

init();

async function init() {
  try {
    const res = await fetch(`${apiUrl}/grocery/all-ingredients`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await res.json();
    console.log(data);

    renderIngredients(data.ingredients);
  } catch (err) {
    console.error(err);
  }
}
function renderIngredients(ingredients) {
  listContainer.innerHTML = "";

  if (!ingredients.length) {
    emptyMsg.classList.remove("hidden");
    return;
  }

  ingredients
    .map((ing) => ({
      ...ing,
      daysRemaining: calculateDaysRemaining(ing.expiryDate),
    }))
    .sort((a, b) => {
      if (a.daysRemaining < 0 && b.daysRemaining >= 0) return -1;
      if (a.daysRemaining >= 0 && b.daysRemaining < 0) return 1;
      return (a.daysRemaining ?? Infinity) - (b.daysRemaining ?? Infinity);
    })
    .forEach((ing) => {
      const item = document.createElement("div");

      const expiryText = ing.expiryDate
        ? new Date(ing.expiryDate).toLocaleDateString()
        : "No expiry";

      const { badgeClass, badgeText, stateClass } =
        getExpiryState(ing.daysRemaining);

      item.className = `expiry-item ${stateClass}`;

      item.innerHTML = `
        <div class="item-left">
          <div class="item-name">
            ${ing.name}
          </div>
          <div class="expiry-date">
            Expiry: ${expiryText}
          </div>
        </div>

        <div class="item-right">
          ${
            ing.daysRemaining < 0
              ? `<div class="expired-flag">!</div>`
              : ""
          }

          <div class="days-badge ${badgeClass}">
            ${badgeText}
          </div>
        </div>
      `;

      listContainer.appendChild(item);
    });
}

function getExpiryState(days) {
  if (days === null)
    return {
      badgeClass: "days-safe",
      badgeText: "No expiry",
      stateClass: "safe",
    };

  if (days < 0)
    return {
      badgeClass: "days-expired",
      badgeText: `Expired ${Math.abs(days)} day(s)`,
      stateClass: "expired",
    };

  if (days <= 2)
    return {
      badgeClass: "days-danger",
      badgeText: `${days} day(s) left`,
      stateClass: "danger",
    };

  if (days <= 5)
    return {
      badgeClass: "days-warning",
      badgeText: `${days} day(s) left`,
      stateClass: "warning",
    };

  return {
    badgeClass: "days-safe",
    badgeText: `${days} day(s) left`,
    stateClass: "safe",
  };
}


function calculateDaysRemaining(date) {
  if (!date) return null;

  const today = new Date();
  const expiry = new Date(date);

  today.setHours(0, 0, 0, 0);
  expiry.setHours(0, 0, 0, 0);

  const diff = expiry - today;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function createBadge(days) {
  if (days === null) return `<span class="badge none">No expiry</span>`;

  if (days < 0)
    return `<span class="badge danger">Expired ${Math.abs(days)} day(s) ago</span>`;

  if (days <= 2) return `<span class="badge danger">${days} day(s) left</span>`;

  if (days <= 5)
    return `<span class="badge warning">${days} day(s) left</span>`;

  return `<span class="badge safe">${days} day(s) left</span>`;
}

function sortByExpiry(a, b) {
  if (!a.expiryDate) return 1;
  if (!b.expiryDate) return -1;

  return new Date(a.expiryDate) - new Date(b.expiryDate);
}

/* =========================
   Sidebar Toggle
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
