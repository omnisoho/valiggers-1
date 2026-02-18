const apiUrl = ".";
const token = localStorage.getItem("token");

const state = {
  meals: [],
  activeMeal: null,
  prepStatuses: {},
};

const grid = document.getElementById("meal-prep-grid");

/* =========================
   FETCH MEALS
========================= */
async function fetchMeals() {
  const res = await fetch(`${apiUrl}/nutrition/meals`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await res.json();
  state.meals = data.meals || [];

  renderMeals();
}

function renderMeals() {
  grid.innerHTML = "";

  state.meals.forEach(meal => {
    const col = document.createElement("div");
    col.className = "col-md-4";
col.innerHTML = `
  <div class="meal-prep-card shadow">
    <img src="${meal.photoUrl}" class="meal-img"/>
    
    <div class="meal-body">
      <div class="meal-header-row">
        <h3>${meal.mealName}</h3>
        <span class="badge">${meal.mealType}</span>
      </div>

      <div class="meal-details">
        <span>${meal.calories} kcal</span>
        <span>${meal.protein}g protein</span>
        <span>${meal.fat}g fats</span>
        <span>${meal.sugar}g sugar</span>
      </div>

      <button class="btn start-prep">
        Start Preparation
      </button>
    </div>
  </div>
`;


    col.querySelector(".start-prep")
       .onclick = () => openPreparation(meal);

    grid.appendChild(col);
  });
}

/* =========================
   PREPARATION MODAL
========================= */
const overlay = document.getElementById("prep-overlay");
const ingredientContainer = document.getElementById("prep-ingredients");
const mealTitle = document.getElementById("prep-meal-title");

function openPreparation(meal) {
  state.activeMeal = meal;
  mealTitle.textContent = meal.mealName;

  ingredientContainer.innerHTML = "";
  state.prepStatuses = {};

  if (!meal.mealIngredients || meal.mealIngredients.length === 0) {
    // Show placeholder if no ingredients
    const emptyRow = document.createElement("div");
    emptyRow.className = "prep-row";
    emptyRow.innerHTML = `<span colspan="4" style="text-align:center; width:100%; font-style:italic; color:#6b7280;">
      No ingredients for this meal
    </span>`;
    ingredientContainer.appendChild(emptyRow);
  } else {
    meal.mealIngredients.forEach(mi => {
      const ing = mi.ingredient;
      state.prepStatuses[ing.id] = "PENDING";

      const row = document.createElement("div");
      row.className = "prep-row";

    row.innerHTML = `
  <span>${ing.name}</span>
  <span>${mi.quantity} ${ing.quantityUnit}</span>
  <span class="badge ${ing.status}">${ing.status.replace("_", " ")}</span>
  <select>
    <option>PENDING</option>
    <option>PREPARED</option>
    <option>NOT_PREPARED</option>
  </select>
`;


      row.querySelector("select").onchange = e =>
        state.prepStatuses[ing.id] = e.target.value;

      ingredientContainer.appendChild(row);
    });
  }

  overlay.classList.remove("hidden");
  startTimer();
}


document.getElementById("close-prep").onclick = () => {
  overlay.classList.add("hidden");
  stopTimer();
};

/* =========================
   TIMER
========================= */
let timer = null;
let seconds = 0;

function startTimer() {
  seconds = 0;

  timer = setInterval(() => {
    seconds++;
    updateTimer();
  }, 1000);
}

function stopTimer() {
  clearInterval(timer);
}

function updateTimer() {
  const h = String(Math.floor(seconds / 3600)).padStart(2, "0");
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const s = String(seconds % 60).padStart(2, "0");

  document.getElementById("prep-timer").textContent =
    `${h}:${m}:${s}`;
}

/* =========================
   COMPLETE SESSION
========================= */
document.getElementById("complete-prep-btn")
.onclick = async () => {

  const meal = state.activeMeal;

    if (!meal.mealIngredients || meal.mealIngredients.length === 0) {
    // No ingredients, just close overlay and stop timer
    overlay.classList.add("hidden");
    stopTimer();
    return;
  }


  // collect prepared ingredients only
  const preparedIngredientIds = Object.entries(state.prepStatuses)
    .filter(([_, status]) => status === "PREPARED")
    .map(([id]) => Number(id));

  await fetch(`${apiUrl}/grocery/deduct-ingredients/${meal.id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      preparedIngredientIds
    })
  });

  await fetch(`${apiUrl}/grocery/save-preparation-session`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({
    mealId: meal.id,
    durationSec: seconds,
    items: meal.mealIngredients.map(mi => ({
      ingredientId: mi.ingredient.id,
      ingredientName: mi.ingredient.name,
      requiredQuantity: mi.quantity,
      stockStatus: mi.ingredient.status,
      preparationStatus:
        state.prepStatuses[mi.ingredient.id],
    })),
  }),
});


  overlay.classList.add("hidden");
  stopTimer();
};

fetchMeals();

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
