const apiUrl = ".";
const token = localStorage.getItem("token");

if (!token) {
  alert("You must be logged in to view meals.");
}

/* =========================
   GLOBAL STATE
========================= */
const state = {
  meals: [],
  ingredientsById: {},
  token,
  mealCurtains: {}, // only shopping curtain now
  shoppingQuantities: {}, // { [ingredientId]: value }
};
//for efficiecyy in quantity unit updates
const QUANTITY_UNITS = [
  "GRAM",
  "KILOGRAM",
  "MILLILITER",
  "LITER",
  "TABLESPOON",
  "TEASPOON",
  "CUP",
  "PIECE",
];

let shoppingStartTime = null;

/* =========================
   DOM REFERENCES
========================= */
const mealContainer = document.querySelector(".meal-container");

/* =========================
   FETCH MEALS
========================= */
async function fetchMeals() {
  try {
    const response = await fetch(`${apiUrl}/nutrition/meals`, {
      headers: { Authorization: `Bearer ${state.token}` },
    });
    const data = await response.json();

    state.meals = data.meals || [];

    // normalize ingredients
    state.ingredientsById = {};
    state.meals.forEach((meal) => {
      meal.mealIngredients.forEach((mi) => {
        state.ingredientsById[mi.ingredient.id] = mi.ingredient;
      });
    });

    console.log(state);

    renderMeals();

    // Render low stock panel
    renderLowStockPanel();
  } catch (err) {
    console.error("Error fetching meals:", err);
  }
}

/* =========================
   RENDER MEALS
========================= */
function renderMeals() {
  mealContainer.innerHTML = "";

  state.meals.forEach((meal) => {
    const mealCard = document.createElement("section");
    mealCard.className = "meal-card";

    /* ---- Header ---- */
    const header = document.createElement("div");
    header.className = "meal-header";
    header.innerHTML = `
      <h2>${meal.mealName}</h2>
      <span class="meal-type">${meal.mealType}</span>
    `;
    mealCard.appendChild(header);

    /* ---- Ingredients ---- */
    const ingredientList = document.createElement("div");
    ingredientList.className = "ingredient-list";

    meal.mealIngredients.forEach((mi) => {
      const ingredient = state.ingredientsById[mi.ingredient.id];

      const row = document.createElement("div");
      row.className = "ingredient-row";
      row.dataset.ingredientId = ingredient.id; // ✅ ADD THIS
      row.dataset.mealId = meal.id; // ✅ ADD THIS
      const nameWrapper = document.createElement("div");
      nameWrapper.className = "ingredient-name-wrapper";

      const name = document.createElement("span");
      name.className = "ingredient-name";
      name.textContent = ingredient.name;

      nameWrapper.appendChild(name);

      /* ===========================
     EXPIRY CHECK BUBBLE
  ============================ */
      if (ingredient.expiryDate) {
        const today = new Date();
        const expiry = new Date(ingredient.expiryDate);
        today.setHours(0, 0, 0, 0);
        expiry.setHours(0, 0, 0, 0);

        if (expiry < today) {
          // Expired!
          const expiredBubble = document.createElement("span");
          expiredBubble.className = "expired-bubble";
          expiredBubble.textContent = "⚠ Expired";

          // Optional: tooltip
          const tooltip = document.createElement("div");
          tooltip.className = "expired-tooltip";
          tooltip.textContent = "Check Expiry List for details";

          expiredBubble.appendChild(tooltip);
          nameWrapper.appendChild(expiredBubble);

          // Optional: highlight row
          row.classList.add("ingredient-expired");
        }
      }

      // ⚠️ Quantity warning bubble
      if (
        ingredient.ingredientQuantity !== undefined &&
        ingredient.ingredientQuantity < mi.quantity
      ) {
        const warnBubble = document.createElement("span");
        warnBubble.className = "quantity-warning-bubble";
        warnBubble.textContent = "!";

        const tooltip = document.createElement("div");
        tooltip.className = "quantity-warning-tooltip";
        tooltip.textContent = "Ingredient quantity lower than recipe";

        warnBubble.appendChild(tooltip);
        nameWrapper.appendChild(warnBubble);
      }

      const input = document.createElement("input");
      input.type = "number";
      input.value = mi.quantity || 0;
      input.min = 0;
      input.className = "quantity-input";

      input.addEventListener("input", () => {
        const val = parseFloat(input.value) || 0;

        // Update the local meal ingredient quantity
        const mi = meal.mealIngredients.find(
          (m) => m.ingredient.id === ingredient.id,
        );
        if (mi) mi.quantity = val;

        // Refresh the bubble live
        refreshQuantityWarning(meal.id, ingredient.id);
      });

      input.addEventListener("change", () =>
        updateMealIngredientQuantity(
          meal.id,
          ingredient.id,
          parseFloat(input.value) || 0,
        ),
      );

      const unitSelect = document.createElement("select");
      unitSelect.className = "quantity-unit";

      QUANTITY_UNITS.forEach((unit) => {
        const opt = document.createElement("option");
        opt.value = unit;
        opt.textContent = unit;

        if (ingredient.quantityUnit === unit) opt.selected = true;

        unitSelect.appendChild(opt);
      });

      unitSelect.addEventListener("change", () =>
        updateIngredientUnit(ingredient.id, unitSelect.value),
      );

      /* ---- Status Badge (Read-Only) ---- */
      const statusBadge = document.createElement("div");
      statusBadge.className =
        "status-badge " + ingredientStatusClass(ingredient.status);
      statusBadge.textContent = formatStatusText(ingredient.status);

      /* ---- Delete Button ---- */
      const deleteBtn = document.createElement("button");
      deleteBtn.className = "btn delete-ingredient-btn";
      deleteBtn.textContent = "🗑️";
      deleteBtn.addEventListener("click", () =>
        deleteIngredientFromMeal(meal.id, ingredient.id, row),
      );

      row.appendChild(nameWrapper);

      row.appendChild(input);
      row.appendChild(unitSelect); // NEW
      row.appendChild(statusBadge);
      row.appendChild(deleteBtn);

      ingredientList.appendChild(row);
    });

    /* ---- Add Ingredient ---- */
    const addBtn = document.createElement("button");
    addBtn.className = "btn primary add-ingredient-btn";
    addBtn.textContent = "+ Add Ingredients";
    addBtn.addEventListener("click", () => {
      const ingredientName = prompt("Enter ingredient name:");
      if (ingredientName) addIngredientToMeal(meal.id, ingredientName);
    });

    ingredientList.appendChild(addBtn);
    mealCard.appendChild(ingredientList);

    /* ---- Actions: only shopping now ---- */
    const actions = document.createElement("div");
    actions.className = "meal-actions";
    actions.innerHTML = `
      <button class="btn primary shopping-btn">Start Shopping</button>
    `;
    mealCard.appendChild(actions);

    /* ---- Shopping Curtain ---- */
    const shoppingCurtain = createShoppingCurtain(meal);
    state.mealCurtains[meal.id] = { shopping: shoppingCurtain };
    mealCard.appendChild(shoppingCurtain);
    actions.querySelector(".shopping-btn").onclick = () =>
      toggleCurtain(shoppingCurtain);

    mealContainer.appendChild(mealCard);
  });
}

const searchInput = document.getElementById("meal-search-input");

searchInput.addEventListener("input", () => {
  const query = searchInput.value.toLowerCase().trim();
  const mealCards = document.querySelectorAll(".meal-card");

  mealCards.forEach((card) => {
    const mealName = card
      .querySelector(".meal-header h2")
      .textContent.toLowerCase();

    if (mealName.includes(query)) {
      card.style.border = "2px solid #2563eb"; // highlight
      card.style.transition = "border 0.3s";
      card.scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
      card.style.border = "none";
    }
  });
});

/* =========================
   SHOPPING CURTAIN
========================= */
function createShoppingCurtain(meal) {
  const curtain = document.createElement("div");
  curtain.className = "curtain shopping-curtain";

  const title = document.createElement("h3");
  title.textContent = "Shopping List";
  curtain.appendChild(title);

  buildShoppingItems(curtain, meal);

  return curtain;
}
function buildShoppingItems(curtain, meal) {
  const allIngredientIds = Object.values(state.ingredientsById)
    .filter(
      (ing) => ing.status === "RUNNING_OUT" || ing.status === "OUT_OF_STOCK",
    )
    .map((ing) => ing.id);

  let itemsAdded = 0;

  allIngredientIds.forEach((ingredientId) => {
    const ingredient = state.ingredientsById[ingredientId];

    const inCurrentMeal = meal.mealIngredients.some(
      (mi) => mi.ingredient.id === ingredient.id,
    );
    if (!inCurrentMeal) return;

    const item = document.createElement("div");
    item.className = "shopping-item";

    // ---- Name ----
    const name = document.createElement("span");
    name.textContent = ingredient.name;

    // ---- Quantity Input (temporary variable) ----
    const qtyInput = document.createElement("input");
    qtyInput.type = "number";
    qtyInput.min = 0;
    qtyInput.className = "shopping-quantity-input";

    // ✅ restore previous value if exists
    const savedQty = state.shoppingQuantities[ingredient.id] ?? 0;
    qtyInput.value = savedQty;

    let purchasedAmount = parseFloat(qtyInput.value) || 0;

    qtyInput.addEventListener("input", () => {
      purchasedAmount = parseFloat(qtyInput.value) || 0;

      // Sync duplicates
      document
        .querySelectorAll(
          `.shopping-item .status-badge[data-ingredient-id="${ingredient.id}"]`,
        )
        .forEach((b) => {
          if (b !== badge) {
            const input = b.parentElement.querySelector(
              ".shopping-quantity-input",
            );
            if (input) input.value = purchasedAmount;
          }
        });
    });

    // ---- Purchase Status Badge ----
    const badge = document.createElement("div");
    badge.className =
      "status-badge purchase-" + ingredient.purchaseStatus.toLowerCase();
    badge.textContent = ingredient.purchaseStatus;
    badge.dataset.ingredientId = ingredient.id;
    badge.tabIndex = 0;

    const options = document.createElement("div");
    options.className = "status-options shopping hidden";

    ["PENDING", "PURCHASED", "NOT_PURCHASED"].forEach((status) => {
      const option = document.createElement("div");
      option.className = "status-option shopping";
      option.textContent = status;

      option.onclick = async () => {
        try {
          const statusToSend = status;

          // 1️⃣ Update purchase status in DB
          const resStatus = await fetch(
            `${apiUrl}/grocery/update-purchase-status/${ingredient.id}`,
            {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${state.token}`,
              },
              body: JSON.stringify({ purchaseStatus: statusToSend }),
            },
          );
          const dataStatus = await resStatus.json();
          if (!dataStatus.success)
            throw new Error(dataStatus.message || "Failed");

          // Update local state only
          ingredient.purchaseStatus = statusToSend;
          badge.textContent = ingredient.purchaseStatus;
          badge.className =
            "status-badge purchase-" + ingredient.purchaseStatus.toLowerCase();

          // Refresh shopping curtain for visuals
          state.meals.forEach((m) => refreshShoppingCurtain(m.id));

          options.classList.add("hidden");
        } catch (err) {
          console.error("Error updating purchase status:", err);
        }
      };

      options.appendChild(option);
    });

    badge.onclick = (e) => {
      e.stopPropagation();
      options.classList.toggle("hidden");
    };

    document.addEventListener("click", (e) => {
      if (!item.contains(e.target)) options.classList.add("hidden");
    });

    item.append(name, qtyInput, badge, options);
    curtain.appendChild(item);
    itemsAdded++;
  });

  if (itemsAdded === 0) {
    const msg = document.createElement("div");
    msg.className = "text-center text-muted fw-bold my-3";
    msg.style.fontSize = "1.2rem";
    msg.textContent = "Empty Shopping List 🛒";
    curtain.appendChild(msg);
  }
}

function refreshShoppingCurtain(mealId) {
  const meal = state.meals.find((m) => m.id === mealId);
  if (!meal) return;
  const curtain = state.mealCurtains[mealId].shopping;

  // 1️⃣ Save current values
  curtain.querySelectorAll(".shopping-item").forEach((item) => {
    const badge = item.querySelector(".status-badge");
    const input = item.querySelector(".shopping-quantity-input");
    if (badge && input) {
      const ingredientId = parseInt(badge.dataset.ingredientId, 10);
      state.shoppingQuantities[ingredientId] = parseFloat(input.value) || 0;
    }
  });

  // 2️⃣ Clear and rebuild
  const title = curtain.querySelector("h3");
  curtain.innerHTML = "";
  curtain.appendChild(title);
  buildShoppingItems(curtain, meal);
}

//refresh meal ingredient quantity warning
function refreshQuantityWarning(mealId, ingredientId) {
  const meal = state.meals.find((m) => m.id === mealId);
  if (!meal) return;

  const mi = meal.mealIngredients.find((m) => m.ingredient.id === ingredientId);
  if (!mi) return;

  const ingredient = state.ingredientsById[ingredientId];
  if (!ingredient) return;

  const stockQty = ingredient.ingredientQuantity ?? 0;
  const shouldWarn = stockQty < mi.quantity;

  document
    .querySelectorAll(
      `.ingredient-row[data-ingredient-id="${ingredientId}"][data-meal-id="${mealId}"]`,
    )
    .forEach((row) => {
      const wrapper = row.querySelector(".ingredient-name-wrapper");
      if (!wrapper) return;

      let bubble = wrapper.querySelector(".quantity-warning-bubble");

      if (shouldWarn && !bubble) {
        bubble = document.createElement("span");
        bubble.className = "quantity-warning-bubble";
        bubble.textContent = "!";

        const tooltip = document.createElement("div");
        tooltip.className = "quantity-warning-tooltip";
        tooltip.textContent = "Ingredient quantity lower than recipe";

        bubble.appendChild(tooltip);
        wrapper.appendChild(bubble);
      }

      if (!shouldWarn && bubble) {
        bubble.remove();
      }
    });
}

/* =========================
   LOW STOCK PANEL
========================= */
function renderLowStockPanel() {
  const panel = document.querySelector(".low-stock-panel");
  const lowStockList = panel.querySelector(".low-stock-list");

  lowStockList.innerHTML = "";

  const lowStockIngredients = Object.values(state.ingredientsById).filter(
    (ing) => ing.status === "RUNNING_OUT" || ing.status === "OUT_OF_STOCK",
  );

  if (lowStockIngredients.length === 0) {
    panel.classList.add("all-stock");
    const msg = document.createElement("div");
    msg.textContent = "All ingredients are in stock!";
    msg.style.color = "#065f46";
    lowStockList.appendChild(msg);
    return;
  } else {
    panel.classList.remove("all-stock");
  }

  lowStockIngredients.forEach((ingredient) => {
    const item = document.createElement("div");
    item.className = "low-stock-item";

    const name = document.createElement("span");
    name.className = "low-stock-name";
    name.textContent = ingredient.name;

    const status = document.createElement("span");
    status.className =
      "low-stock-status " +
      (ingredient.status === "RUNNING_OUT" ? "running-out" : "out-of-stock");
    status.textContent =
      ingredient.status === "RUNNING_OUT" ? "Running Out" : "Out of Stock";

    item.append(name, status);
    lowStockList.appendChild(item);
  });
}

/* =========================
   API ACTIONS
========================= */

async function updateMealIngredientQuantity(mealId, ingredientId, quantity) {
  try {
    await fetch(`${apiUrl}/grocery/update-quantity/${mealId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${state.token}`,
      },
      body: JSON.stringify({ ingredientId, quantity }),
    });

    const meal = state.meals.find((m) => m.id === mealId);
    if (meal) {
      const mi = meal.mealIngredients.find(
        (m) => m.ingredient.id === ingredientId,
      );
      if (mi) mi.quantity = quantity;
    }

    refreshQuantityWarning(mealId, ingredientId);
  } catch (err) {
    console.error(err);
  }
}

async function addIngredientToMeal(mealId, ingredientName) {
  try {
    const res = await fetch(`${apiUrl}/grocery/add-meal-ingredients`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${state.token}`,
      },
      body: JSON.stringify({ mealId, ingredientName }),
    });

    const data = await res.json();
    if (data.message) alert(data.message);
    if (!data.ingredient) return;

    const meal = state.meals.find((m) => m.id === mealId);
    if (!meal) return;

    const duplicate = meal.mealIngredients.find(
      (mi) => mi.ingredient.id === data.ingredient.id,
    );
    if (duplicate) return;

    const newIngredient = data.ingredient;
    state.ingredientsById[newIngredient.id] = newIngredient;

    meal.mealIngredients.push({
      ingredient: newIngredient,
      quantity: 0,
    });

    renderMeals();
    renderLowStockPanel();
  } catch (err) {
    console.error(err);
  }
}

async function deleteIngredientFromMeal(mealId, ingredientId, rowElement) {
  if (!confirm("Are you sure you want to delete this ingredient?")) return;

  try {
    const res = await fetch(`${apiUrl}/grocery/delete-meal-ingredient`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${state.token}`,
      },
      body: JSON.stringify({ mealId, ingredientId }),
    });

    const data = await res.json();
    if (!data.success) {
      alert(data.message || "Failed to delete ingredient");
      return;
    }

    const meal = state.meals.find((m) => m.id === mealId);
    if (meal) {
      meal.mealIngredients = meal.mealIngredients.filter(
        (mi) => mi.ingredient.id !== ingredientId,
      );
    }

    rowElement.remove();

    const isUsedInOtherMeals = state.meals.some((m) =>
      m.mealIngredients.some((mi) => mi.ingredient.id === ingredientId),
    );
    if (!isUsedInOtherMeals) {
      delete state.ingredientsById[ingredientId];
    }

    state.meals.forEach((m) => refreshShoppingCurtain(m.id));
    renderLowStockPanel();
  } catch (err) {
    console.error("Error deleting ingredient:", err);
  }
}

//update meal ingredient unit
async function updateIngredientUnit(ingredientId, quantityUnit) {
  await fetch(`${apiUrl}/grocery/update-unit/${ingredientId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${state.token}`,
    },
    body: JSON.stringify({ quantityUnit }),
  });

  // update state
  state.ingredientsById[ingredientId].quantityUnit = quantityUnit;

  // update ALL dropdowns in UI
  document
    .querySelectorAll(`.ingredient-row select.quantity-unit`)
    .forEach((select) => {
      const row = select.closest(".ingredient-row");
      const nameEl = row.querySelector(".ingredient-name");

      if (
        nameEl &&
        state.ingredientsById[ingredientId].name === nameEl.textContent
      ) {
        select.value = quantityUnit;
      }
    });
}

/* =========================
   GLOBAL SHOPPING TIMER
========================= */
let shoppingTimer = null;
let remainingSeconds = 0;

const startBtn = document.getElementById("global-shopping-btn");
const timePanel = document.getElementById("shopping-time-panel");
const timerPanel = document.getElementById("shopping-timer-panel");
const timerDisplay = document.getElementById("timer-display");

startBtn.onclick = () => {
  timePanel.classList.toggle("hidden");
};

document.getElementById("start-timer-btn").onclick = () => {
  const h = parseInt(document.getElementById("hours").value || 0);
  const m = parseInt(document.getElementById("minutes").value || 0);
  const s = parseInt(document.getElementById("seconds").value || 0);

  remainingSeconds = h * 3600 + m * 60 + s;
  if (remainingSeconds <= 0) return alert("Set a valid time");

  shoppingStartTime = Date.now(); // ✅ Record session start

  timePanel.classList.add("hidden");
  timerPanel.classList.remove("hidden");

  updateTimerUI();

  shoppingTimer = setInterval(() => {
    remainingSeconds--;
    updateTimerUI();

    if (remainingSeconds <= 0) endShoppingSession();
  }, 1000);
};

document.getElementById("end-shopping-btn").onclick = endShoppingSession;

function updateTimerUI() {
  const h = String(Math.floor(remainingSeconds / 3600)).padStart(2, "0");
  const m = String(Math.floor((remainingSeconds % 3600) / 60)).padStart(2, "0");
  const s = String(remainingSeconds % 60).padStart(2, "0");
  timerDisplay.textContent = `${h}:${m}:${s}`;
}

/* =========================
   END SHOPPING
========================= */
async function endShoppingSession() {
  clearInterval(shoppingTimer);
  timerPanel.classList.add("hidden");

  const shoppingEndTime = Date.now();
  let durationSeconds = 0;

  if (shoppingStartTime) {
    durationSeconds = Math.floor((shoppingEndTime - shoppingStartTime) / 1000);
  }

  const h = Math.floor(durationSeconds / 3600);
  const m = Math.floor((durationSeconds % 3600) / 60);
  const s = durationSeconds % 60;
  const formattedDuration = `${h}h ${m}m ${s}s`;

  try {
    // ✅ Read actual quantities from shopping curtain inputs
    const purchasedQuantities = [];
    const updatePromises = []; // To call the quantity API for purchased ingredients


    state.meals.forEach((meal) => {
      const curtain = state.mealCurtains[meal.id].shopping;
      const items = curtain.querySelectorAll(".shopping-item");
      items.forEach((item) => {
        const name = item.querySelector("span").textContent;
        const qtyInput = item.querySelector(".shopping-quantity-input");
        const qty = parseFloat(qtyInput.value) || 0;

        purchasedQuantities.push({ name, quantity: qty });

        const badge = item.querySelector(".status-badge");
        if (badge && badge.textContent === "PURCHASED" && qty > 0) {
          const ingredientId = parseInt(badge.dataset.ingredientId, 10);

          // Get current stock from local state
          const currentStock =
            state.ingredientsById[ingredientId]?.ingredientQuantity || 0;

          // Calculate new quantity = current stock + purchased quantity
          const newQuantity = currentStock + qty;

          updatePromises.push(
            fetch(
              `${apiUrl}/grocery/update-ingredient-quantity/${ingredientId}`,
              {
                method: "PUT",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${state.token}`,
                },
                body: JSON.stringify({ quantity: newQuantity }), // add qty to current stock
              },
            ),
          );

          
        }
      });
    });


    await fetch(`${apiUrl}/grocery/save-shopping-session`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${state.token}`,
  },
  body: JSON.stringify({
    durationSeconds,
    items: purchasedQuantities.map(p => {
      const ing = Object.values(state.ingredientsById)
        .find(i => i.name === p.name);

      return {
        ingredientId: ing?.id,
        ingredientName: p.name,
        quantityAdded: p.quantity,
        purchaseStatus: ing?.purchaseStatus,
        stockStatus: ing?.status,
      };
    }),
  }),
});

    

    // ✅ End shopping session (summary)
    const res = await fetch(`${apiUrl}/grocery/end-shopping`, {
      headers: { Authorization: `Bearer ${state.token}` },
    });
    const data = await res.json();

    showSummaryModal(
      data.ingredients || [],
      formattedDuration,
      purchasedQuantities,
    );

    // Wait for all updates
    await Promise.all(updatePromises);

    fetchMeals(); // Refresh meals and ingredients
    // Reset all purchase status locally
    Object.values(state.ingredientsById).forEach(
      (i) => (i.purchaseStatus = "PENDING"),
    );
    state.meals.forEach((m) => refreshShoppingCurtain(m.id));
  } catch (err) {
    console.error(err);
  }
}

/* =========================
   SUMMARY MODAL
========================= */
function showSummaryModal(
  ingredients,
  duration = "",
  purchasedQuantities = [],
) {
  const overlay = document.getElementById("shopping-summary-overlay");
  const list = document.getElementById("summary-list");

  list.innerHTML = "";

  // Show session duration at top
  if (duration) {
    const durationDiv = document.createElement("div");
    durationDiv.className = "text-center fw-bold mb-3";
    durationDiv.style.fontSize = "1.2rem";
    durationDiv.textContent = `Shopping Session Duration: ${duration}`;
    list.appendChild(durationDiv);
  }

  if (ingredients.length === 0) {
    const msg = document.createElement("div");
    msg.className = "text-center text-success fw-bold my-3";
    msg.style.fontSize = "1.5rem";
    msg.textContent = "All Shopping List Completed ✅";
    list.appendChild(msg);
  } else {
    ingredients.forEach((ing) => {
      const row = document.createElement("div");
      row.className = "summary-item";

      // Stock status badge
      let stockClass = "";
      if (ing.status === "IN_STOCK") stockClass = "in-stock";
      else if (ing.status === "RUNNING_OUT") stockClass = "running-out";
      else if (ing.status === "OUT_OF_STOCK") stockClass = "out-of-stock";

      // Purchase status badge
      let purchaseClass = "";
      if (ing.purchaseStatus === "PENDING") purchaseClass = "purchase-pending";
      else if (ing.purchaseStatus === "PURCHASED")
        purchaseClass = "purchase-purchased";
      else if (ing.purchaseStatus === "NOT_PURCHASED")
        purchaseClass = "purchase-not_purchased";

      // Find purchased quantity
      const pq = purchasedQuantities.find((pq) => pq.name === ing.name);
      const purchasedQty = pq ? pq.quantity : 0;

      const qtySpan = document.createElement("span");
      qtySpan.className = "purchased-qty";
      if (purchasedQty === 0) qtySpan.classList.add("zero");
      qtySpan.textContent = `To Purchase: ${purchasedQty}`;
      row.appendChild(qtySpan);

      row.innerHTML = `
        <span class="ingredient-name">${ing.name}</span>
        <span class="purchased-qty">Quantity To Purchase: ${purchasedQty}</span>
        <div>
          <span class="status-badge ${stockClass}">${formatStatusText(ing.status)}</span>
          <span class="status-badge ${purchaseClass}">${formatStatusText(ing.purchaseStatus)}</span>
        </div>
      `;

      list.appendChild(row);
    });
  }

  overlay.classList.remove("hidden");

  const exitBtn = document.getElementById("exit-summary-btn");
  exitBtn.onclick = () => overlay.classList.add("hidden");
}

/* =========================
   HELPERS
========================= */
function toggleCurtain(curtain) {
  curtain.style.display = curtain.style.display === "block" ? "none" : "block";
}

function ingredientStatusClass(status) {
  return {
    IN_STOCK: "in-stock",
    RUNNING_OUT: "running-out",
    OUT_OF_STOCK: "out-of-stock",
  }[status];
}

function formatStatusText(status) {
  switch (status) {
    case "IN_STOCK":
      return "In Stock";
    case "RUNNING_OUT":
      return "Running Out";
    case "OUT_OF_STOCK":
      return "Out of Stock";
    case "PENDING":
      return "Pending";
    case "PURCHASED":
      return "Purchased";
    case "NOT_PURCHASED":
      return "Not Purchased";
    default:
      return status;
  }
}

/* =========================
   INIT
========================= */
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
