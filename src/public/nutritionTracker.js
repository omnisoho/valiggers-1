// ======================================================
//  STATE MANAGEMENT SETUP
// ======================================================

const state = {
  token: localStorage.getItem("token") || null,
  meals: [],
  totalCalories: 0,
  calorieLimit: 0,
  editingMealId: null,
};

// DOM references
const mealsSection = document.getElementById("meals-section");
const createMealBtn = document.querySelector(".create-meal-btn");
const limitBtn = document.querySelector(".limit-btn");
const intakeBtn = document.querySelector(".intake-btn");
const totalCaloriesValue = document.getElementById("totalCaloriesValue");
const calorieModal = document.getElementById("calorieModal");
const changePlanBtn = document.getElementById("changePlanBtn");
const itsFineBtn = document.getElementById("itsFineBtn");

// Edit modal
const editFormModal = document.getElementById("editFormModal");
const saveEditBtn = document.getElementById("saveEditBtn");
const cancelEditBtn = document.getElementById("cancelEditBtn");


// ======================================================
//  STATE SETTERS
// ======================================================

function setMeals(meals) {
  state.meals = meals;
  renderMeals();
}

function setCalories(total, limit) {
  state.totalCalories = total;
  state.calorieLimit = limit;
  renderCalories();
}

function setEditingMeal(id) {
  state.editingMealId = id;
}


// ======================================================
//  API LAYER (NO UI LOGIC HERE)
// ======================================================

const api = {
  fetchMeals: () =>
    fetch(`./nutrition/meals`, {
      headers: { Authorization: `Bearer ${state.token}` }
    }).then(res => res.json()),

  consumeMeal: (mealId) =>
    fetch(`./nutrition/consume`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${state.token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ mealId })
    }),

  updateMeal: (mealId, data) =>
    fetch(`./nutrition/meals/${mealId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${state.token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(data)
    }),

  deleteMeal: (mealId) =>
    fetch(`./nutrition/meals/${mealId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${state.token}` }
    })
};


// ======================================================
//  RENDERING FUNCTIONS
// ======================================================

function renderCalories() {
  totalCaloriesValue.textContent = state.totalCalories;

  if (state.totalCalories > state.calorieLimit) {
    totalCaloriesValue.style.color = "red";
    calorieModal.classList.add("visible");
  } else {
    totalCaloriesValue.style.color = "white";
    calorieModal.classList.remove("visible");
  }
}

function renderMeals() {
  const meals = state.meals;

  if (!meals.length) {
    mealsSection.innerHTML =
      '<div class="placeholder">No meals yet. Add your first meal!</div>';
    return;
  }

  mealsSection.innerHTML = "";

  meals.forEach((meal) => {
    const card = document.createElement("div");
    card.className = "meal-card";

    card.innerHTML = `
      <div class="meal-card-content">
        <div class="meal-image">
          <img src="${meal.photoUrl || "default.png"}" alt="${meal.mealName}">
          
          <button class="consumed-btn" data-id="${meal.id}">Consumed</button>

          <div class="edit-delete-buttons">
            <button class="edit-btn" data-id="${meal.id}">Edit</button>
            <button class="delete-btn" data-id="${meal.id}">Delete</button>
          </div>
        </div>

        <div class="meal-info">
          <h3>${meal.mealName}</h3>
          <p>Type: ${meal.mealType}</p>
          <p>Calories: ${meal.calories}</p>
          <p>Protein: ${meal.protein.toFixed(1)} g</p>
          <p>Fat: ${meal.fat.toFixed(1)} g</p>
          <p>Sugar: ${meal.sugar.toFixed(1)} g</p>
        </div>
      </div>
    `;

    mealsSection.appendChild(card);
  });

  attachMealEventListeners();
}


// ======================================================
//  EVENT HANDLERS
// ======================================================

function attachMealEventListeners() {
  document.querySelectorAll(".consumed-btn").forEach((btn) =>
    btn.addEventListener("click", () => handleConsume(btn.dataset.id))
  );

  document.querySelectorAll(".edit-btn").forEach((btn) =>
    btn.addEventListener("click", () => openEditModal(btn.dataset.id))
  );

  document.querySelectorAll(".delete-btn").forEach((btn) =>
    btn.addEventListener("click", () => handleDelete(btn.dataset.id))
  );
}

function handleConsume(mealId) {
  api.consumeMeal(mealId)
    .then(() => loadMeals())
    .catch(console.error);
}

function handleDelete(mealId) {
  api.deleteMeal(mealId)
    .then(() => loadMeals())
    .catch(console.error);
}


// ======================================================
//  EDIT MODAL LOGIC
// ======================================================

function openEditModal(id) {
  setEditingMeal(id);

  const meal = state.meals.find((m) => m.id == id);

  editFormModal.querySelector('input[name="mealName"]').value = meal.mealName;
  editFormModal.querySelector('select[name="mealType"]').value = meal.mealType;
  editFormModal.querySelector('input[name="calories"]').value = meal.calories;
  editFormModal.querySelector('input[name="protein"]').value = meal.protein;
  editFormModal.querySelector('input[name="fat"]').value = meal.fat;
  editFormModal.querySelector('input[name="sugar"]').value = meal.sugar;

  editFormModal.style.display = "flex";
}

// Save Edit
saveEditBtn.addEventListener("click", () => {
  const payload = {
    mealName: editFormModal.querySelector('input[name="mealName"]').value,
    mealType: editFormModal.querySelector('select[name="mealType"]').value,
    calories: Number(editFormModal.querySelector('input[name="calories"]').value),
    protein: parseFloat(editFormModal.querySelector('input[name="protein"]').value),
    fat: parseFloat(editFormModal.querySelector('input[name="fat"]').value),
    sugar: parseFloat(editFormModal.querySelector('input[name="sugar"]').value)
  };

  api.updateMeal(state.editingMealId, payload)
    .then(() => loadMeals())
    .catch(console.error);
});

cancelEditBtn.addEventListener("click", () => {
  editFormModal.style.display = "none";
});

editFormModal.addEventListener("click", (e) => {
  if (e.target === editFormModal) editFormModal.style.display = "none";
});


// ======================================================
//  CALORIE ALERT MODAL
// ======================================================

changePlanBtn.addEventListener("click", () => {
  window.location.href = "calorieLimit.html";
});

itsFineBtn.addEventListener("click", () => {
  calorieModal.style.display = "none";
});

calorieModal.addEventListener("click", (e) => {
  if (e.target === calorieModal) calorieModal.style.display = "none";
});


// ======================================================
//  NAVIGATION BUTTONS
// ======================================================

createMealBtn.addEventListener("click", () => {
  window.location.href = "nutritionMealForm.html";
});

limitBtn.addEventListener("click", () => {
  window.location.href = "calorieLimit.html";
});

intakeBtn.addEventListener("click", () => {
  window.location.href = "intake.html";
});


// ======================================================
//  LOAD MEALS USING STATE
// ======================================================

function loadMeals() {
  api.fetchMeals()
    .then((data) => {
      setMeals(data.meals);
      setCalories(data.totalCalories, data.calorieLimit);
    })
    .catch(() => {
      mealsSection.innerHTML =
        '<div class="placeholder">Failed to load meals.</div>';
    });
}


// ======================================================
//  INITIAL LOAD
// ======================================================

if (!state.token) {
  alert("You must be logged in.");
} else {
  loadMeals();
}
