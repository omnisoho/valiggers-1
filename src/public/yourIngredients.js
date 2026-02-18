const apiUrl = ".";
const token = localStorage.getItem("token");

if (!token) {
  alert("You must be logged in to view your ingredients.");
}

/* =========================
   GLOBAL STATE
========================= */
const state = {
  ingredients: [],
  currentIngredient: null,
  token,
};

/* =========================
   DOM REFERENCES
========================= */
const tableBody = document.querySelector("#ingredients-table tbody");
const addBtn = document.getElementById("add-ingredient-btn");
const deleteBtn = document.getElementById("delete-ingredient-btn");

const modal = new bootstrap.Modal(document.getElementById("ingredient-modal"));
const form = document.getElementById("ingredient-form");
const nameInput = document.getElementById("ingredient-name");
const quantityInput = document.getElementById("ingredient-quantity");
const unitSelect = document.getElementById("ingredient-unit");
const saveBtn = document.getElementById("save-ingredient-btn");
const runningOutInput = document.getElementById("ingredient-running-out-limit");
const outOfStockInput = document.getElementById(
  "ingredient-out-of-stock-limit",
);
const expiryInput = document.getElementById("ingredient-expiry");
const noExpiryInput = document.getElementById("ingredient-no-expiry");

const suggestionModal = new bootstrap.Modal(
  document.getElementById("suggestion-modal")
);
const suggestionList = document.getElementById("suggestion-list");

const customIngredientInput = document.getElementById(
  "custom-ingredient-input"
);
const customAddBtn = document.getElementById("custom-add-btn");



/* =========================
   FETCH INGREDIENTS
========================= */
async function fetchIngredients() {
  try {
    const res = await fetch(`${apiUrl}/grocery/all-ingredients`, {
      headers: { Authorization: `Bearer ${state.token}` },
    });
    const data = await res.json();
    console.log(data);
    if (data.success) {
      state.ingredients = data.ingredients || [];
      renderTable();
    }
  } catch (err) {
    console.error("Error fetching ingredients:", err);
  }
}

/* =========================
   RENDER TABLE
========================= */
function renderTable() {
  tableBody.innerHTML = "";
  state.ingredients.forEach((ing) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${ing.name}</td>
      <td>${ing.ingredientQuantity || 0}</td>
      <td>${ing.quantityUnit}</td>
      <td>${formatStatusText(ing.status)}</td>
      <td>${ing.runningOutLimit ?? 50}</td>
      <td>${ing.outOfStockLimit ?? 0}</td>
      <td>${formatExpiry(ing.expiryDate)}</td>
      <td><button class="btn btn-sm btn-outline-primary">Details</button></td>
    `;

    row.querySelector("button").onclick = () => openModal(ing);

    tableBody.appendChild(row);
  });
}

/* =========================
   OPEN MODAL
========================= */
function openModal(ingredient) {
  state.currentIngredient = ingredient;

  nameInput.value = ingredient.name;
  quantityInput.value = ingredient.ingredientQuantity || 0;
  unitSelect.value = ingredient.quantityUnit || "GRAM";
  runningOutInput.value = ingredient.runningOutLimit || 50;
  outOfStockInput.value = ingredient.outOfStockLimit || 0;

  if (ingredient.expiryDate) {
    expiryInput.value = ingredient.expiryDate.split("T")[0];
    noExpiryInput.checked = false;
    expiryInput.disabled = false;
  } else {
    expiryInput.value = "";
    noExpiryInput.checked = true;
    expiryInput.disabled = true;
  }

  modal.show();
}

/* =========================
   SAVE CHANGES
========================= */
saveBtn.onclick = async () => {
  const ing = state.currentIngredient;
  if (!ing) return;

  const newName = nameInput.value.trim();
  const newQuantity = parseFloat(quantityInput.value) || 0;
  const newUnit = unitSelect.value;
  const newRunningOut = parseFloat(runningOutInput.value) || 50;
  const newOutOfStock = parseFloat(outOfStockInput.value) || 0;

  try {
    // 1️⃣ Update name if changed
    if (newName !== ing.name) {
      const resName = await fetch(
        `${apiUrl}/grocery/update-ingredient-name/${ing.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${state.token}`,
          },
          body: JSON.stringify({ name: newName }),
        },
      );
      const dataName = await resName.json();
      if (!dataName.success) {
        alert(dataName.message);
        return;
      }
    }

    // 2️⃣ Update quantity
    await fetch(`${apiUrl}/grocery/update-ingredient-quantity/${ing.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${state.token}`,
      },
      body: JSON.stringify({ quantity: newQuantity }),
    });

    // 3️⃣ Update limits
    await fetch(`${apiUrl}/grocery/update-ingredient-limits/${ing.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${state.token}`,
      },
      body: JSON.stringify({
        runningOutLimit: newRunningOut,
        outOfStockLimit: newOutOfStock,
      }),
    });

    // 4️⃣ Update unit if changed
    await fetch(`${apiUrl}/grocery/update-unit/${ing.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${state.token}`,
      },
      body: JSON.stringify({ quantityUnit: newUnit }),
    });

    //  Update expiry
    const expiryValue = noExpiryInput.checked
      ? null
      : expiryInput.value || null;

    await fetch(`${apiUrl}/grocery/update-expiry/${ing.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${state.token}`,
      },
      body: JSON.stringify({ expiryDate: expiryValue }),
    });

    // 5️⃣ Force server to check limits & status
    const resStatus = await fetch(
      `${apiUrl}/grocery/check-ingredient-status/${ing.id}`,
      {
        headers: { Authorization: `Bearer ${state.token}` },
      },
    );
    const { ingredient: updatedIngredient } = await resStatus.json();

    // 6️⃣ Update local state
    const index = state.ingredients.findIndex((i) => i.id === ing.id);
    if (index !== -1) state.ingredients[index] = updatedIngredient;

    renderTable();
    modal.hide();
  } catch (err) {
    console.error("Error updating ingredient:", err);
  }
};

/* =========================
   ADD NEW INGREDIENT
========================= */
addBtn.onclick = async () => {
  try {
    const res = await fetch(`${apiUrl}/grocery/smart-suggestions`, {
      headers: { Authorization: `Bearer ${state.token}` },
    });

    const data = await res.json();

    if (!data.success) return;

    renderSuggestions(data.suggestions);
    suggestionModal.show();

  } catch (err) {
    console.error("Error loading suggestions:", err);
  }
};


customAddBtn.onclick = () => {
  const name = customIngredientInput.value.trim();
  if (!name) return alert("Enter an ingredient name");

  addSuggestedIngredient(name);
  customIngredientInput.value = "";
};


//Delete Ingredient

deleteBtn.onclick = async () => {
  const ing = state.currentIngredient;
  if (!ing) return;

  if (!confirm(`Are you sure you want to delete "${ing.name}"?`)) return;

  try {
    const res = await fetch(`${apiUrl}/grocery/delete-ingredient`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${state.token}`,
      },
      body: JSON.stringify({
        ingredientId: ing.id,
      }),
    });

    const data = await res.json();
    if (data.success) {
      alert(data.message);
      // Remove from local state and re-render table
      state.ingredients = state.ingredients.filter((i) => i.id !== ing.id);
      renderTable();
      modal.hide();
    }
  } catch (err) {
    console.error("Error deleting ingredient:", err);
  }
};



function renderSuggestions(suggestions) {
  suggestionList.innerHTML = "";

  if (!suggestions.length) {
    suggestionList.innerHTML =
      "<li class='list-group-item'>No suggestions available</li>";
    return;
  }

  suggestions.forEach(name => {
    const li = document.createElement("li");
    li.className =
      "list-group-item d-flex justify-content-between align-items-center";

    li.innerHTML = `
      ${name}
      <button class="btn btn-sm btn-primary">Add</button>
    `;

    li.querySelector("button").onclick = () =>
      addSuggestedIngredient(name);

    suggestionList.appendChild(li);
  });
}


async function addSuggestedIngredient(name) {
  try {
    const res = await fetch(`${apiUrl}/grocery/add-ingredients`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${state.token}`,
      },
      body: JSON.stringify({ ingredientName: name }),
    });

    const data = await res.json();

    if (data.success && data.ingredient) {
      state.ingredients.push(data.ingredient);
      renderTable();
      suggestionModal.hide();
    }

    alert(data.message);
  } catch (err) {
    console.error("Error adding ingredient:", err);
  }
}

/* =========================
   HELPERS
========================= */
function formatStatusText(status) {
  switch (status) {
    case "IN_STOCK":
      return "In Stock";
    case "RUNNING_OUT":
      return "Running Out";
    case "OUT_OF_STOCK":
      return "Out of Stock";
    default:
      return status;
  }
}

function formatExpiry(date) {
  if (!date) return "No expiry";
  return new Date(date).toLocaleDateString();
}


/* =========================
   INIT
========================= */
fetchIngredients();

// Handle no expiry toggle
noExpiryInput.onchange = () => {
  expiryInput.disabled = noExpiryInput.checked;
  if (noExpiryInput.checked) expiryInput.value = "";
};
/* =========================
   Sidebar Toggle
========================= */
const sidebar = document.getElementById("sidebar");
const sidebarToggle = document.getElementById("sidebar-toggle");
const closeSidebar = document.getElementById("close-sidebar");
const mainLayout = document.querySelector(".main-layout");

// Safely handle cases where `.main-layout` is not present in the page
if (sidebarToggle) {
  sidebarToggle.onclick = () => {
    if (sidebar) sidebar.classList.toggle("open");
    if (mainLayout) mainLayout.classList.toggle("shifted");
  };
}

if (closeSidebar) {
  closeSidebar.onclick = () => {
    if (sidebar) sidebar.classList.remove("open");
    if (mainLayout) mainLayout.classList.remove("shifted");
  };
}
