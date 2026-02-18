const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

module.exports.addIngredientToMeal = async function (userId, mealId, ingredientName) {
  // 1️⃣ Check if ingredient already exists for this user
  let ingredient = await prisma.ingredient.findFirst({
    where: { userId, name: ingredientName },
  });

  // 2️⃣ If ingredient doesn't exist, create it
  let message;
  if (!ingredient) {
    ingredient = await prisma.ingredient.create({
      data: {
        userId,
        name: ingredientName,
        status: "OUT_OF_STOCK",
        purchaseStatus: "PENDING",
      },
    });
    message = "Ingredient created and added to meal.";
  } else {
    message = "Ingredient already exists for this user.";
  }

  // 3️⃣ Check if this ingredient is already assigned to the meal
  let mealIngredient = await prisma.mealIngredient.findUnique({
    where: {
      mealId_ingredientId: {
        mealId,
        ingredientId: ingredient.id,
      },
    },
  });

  // 4️⃣ If not, create MealIngredient
  if (!mealIngredient) {
    mealIngredient = await prisma.mealIngredient.create({
      data: {
        mealId,
        ingredientId: ingredient.id,
        quantity: 0, // default
      },
    });
    message += " Added to this meal.";
  } else {
    message += " Already assigned to this meal.";
  }

  return {
  ingredient,          // 👈 THIS is the missing piece
  mealIngredient,
  message,
};
};



module.exports.updateMealIngredientQuantity = async function (userId, mealId, ingredientId, quantity) {
  // Optional: check if the meal belongs to the user
  const meal = await prisma.meal.findFirst({
    where: {
      id: mealId,
      userMeal: {
        userId: userId,
      },
    },
  });

  if (!meal) {
    throw new Error("Meal not found or does not belong to user.");
  }

  // Update the quantity
  const updatedMealIngredient = await prisma.mealIngredient.update({
    where: {
      mealId_ingredientId: {
        mealId,
        ingredientId,
      },
    },
    data: {
      quantity,
    },
    include: {
      ingredient: true, // optional: return ingredient details
    },
  });

  return updatedMealIngredient;
};

module.exports.updateIngredientStatus = async function (userId, ingredientId, status) {
  // Ensure ingredient belongs to the user
  const ingredient = await prisma.ingredient.findFirst({
    where: { id: ingredientId, userId },
  });

  if (!ingredient) throw new Error("Ingredient not found or does not belong to user.");

  // Update ingredient status AND reset purchaseStatus to "PENDING"
  const updatedIngredient = await prisma.ingredient.update({
    where: { id: ingredientId },
    data: {
      status,
      purchaseStatus: "PENDING",
    },
  });

  return updatedIngredient;
};


module.exports.updateIngredientPurchaseStatus = async function(userId, ingredientId, purchaseStatus) {
  console.log(purchaseStatus)
  // Ensure ingredient belongs to user
  console.log("Updating purchase status:", { userId, ingredientId, purchaseStatus });
  const ingredient = await prisma.ingredient.findFirst({ where: { id: ingredientId, userId }});
  if (!ingredient) throw new Error("Ingredient not found or does not belong to user.");

  const updated = await prisma.ingredient.update({
    where: { id: ingredientId },
    data: { purchaseStatus },
  });

  console.log("Updated ingredient:", updated);

  return updated;
};


module.exports.deleteIngredientFromMeal = async function (userId, mealId, ingredientId) {

  // 1️⃣ Ensure the meal belongs to the user
  const meal = await prisma.meal.findFirst({
    where: {
      id: mealId,
      userMeal: { userId },
    },
  });

  if (!meal) throw new Error("Meal not found or does not belong to user.");

  // 2️⃣ Delete the MealIngredient row
  await prisma.mealIngredient.delete({
    where: {
      mealId_ingredientId: {
        mealId,
        ingredientId,
      },
    },
  });

  return {
    success: true,
    message: "Ingredient removed from meal"
  };
};

module.exports.endShoppingSession = async function (userId) {
  const result = await prisma.$transaction(async (tx) => {

    // 1️⃣ Get summary ingredients (what summary page shows)
    const ingredientsToReport = await tx.ingredient.findMany({
      where: {
           status: {
          in: ["RUNNING_OUT", "OUT_OF_STOCK"], // <-- filter by stock status
        },
        mealIngredients: {
          some: {
            meal: {
              userMeal: {
                userId: userId,
              },
            },
          },
        },
      },
      select: {
        id: true,
        name: true,
        status: true,
        purchaseStatus: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    // 2️⃣ Reset purchaseStatus for NEXT shopping session
    await tx.ingredient.updateMany({
      where: {
        mealIngredients: {
          some: {
            meal: {
              userMeal: {
                userId: userId,
              },
            },
          },
        },
      },
      data: {
        purchaseStatus: "PENDING",
      },
    });

    // 3️⃣ Return summary data
    return ingredientsToReport;
  });

  return result;
};


module.exports.updateIngredientUnit = async function (
  userId,
  ingredientId,
  quantityUnit
) {
  const ingredient = await prisma.ingredient.findFirst({
    where: { id: ingredientId, userId },
  });

  if (!ingredient)
    throw new Error("Ingredient not found or not owned by user");

  return prisma.ingredient.update({
    where: { id: ingredientId },
    data: { quantityUnit },
  });
};

// This is for your ingredient list

// Get all ingredients for a user
module.exports.getAllIngredients = async function (userId) {
  const ingredients = await prisma.ingredient.findMany({
    where: { userId },
    orderBy: { name: "asc" },
  });

  return ingredients.map((ing) => ({
    id: ing.id,
    name: ing.name,
    ingredientQuantity: ing.ingredientQuantity,      // ✅ from Ingredient table now
    quantityUnit: ing.quantityUnit || "GRAM",
    status: ing.status,
    purchaseStatus: ing.purchaseStatus,
    runningOutLimit: ing.runningOutLimit,
    outOfStockLimit: ing.outOfStockLimit,
    expiryDate: ing.expiryDate // ✅ ADD THIS
  }));
};


module.exports.addIngredient = async function (userId, ingredientName) {
  // Check if ingredient already exists for this user
  let ingredient = await prisma.ingredient.findFirst({
    where: { userId, name: ingredientName },
  });

    if (ingredient) {
    // Ingredient exists, return message
    return { ingredient, message: "Ingredient already exists" };
  }


  if (!ingredient) {
    // Create new ingredient
    ingredient = await prisma.ingredient.create({
      data: {
        userId,
        name: ingredientName,
        status: "OUT_OF_STOCK",
        purchaseStatus: "PENDING",
        quantityUnit: "GRAM", // default
        ingredientQuantity: 0,   // default
      },
    });
  }


  return { ingredient, message: "Ingredient added successfully" };
};

module.exports.updateIngredientQuantity = async function (userId, ingredientId, quantity) {
  // Ensure ingredient belongs to user
  const ingredient = await prisma.ingredient.findFirst({
    where: { id: ingredientId, userId },
  });

  if (!ingredient) throw new Error("Ingredient not found or not owned by user");

  // Update the quantity
  const updated = await prisma.ingredient.update({
    where: { id: ingredientId },
    data: { ingredientQuantity: quantity },
  });

  return updated;
};


module.exports.updateIngredientName = async function (userId, ingredientId, newName) {
  // 1️⃣ Check if ingredient belongs to user
  const ingredient = await prisma.ingredient.findFirst({
    where: { id: ingredientId, userId },
  });
  if (!ingredient) throw new Error("Ingredient not found or not owned by user");

  // 2️⃣ Check if new name already exists for the same user
  const existing = await prisma.ingredient.findFirst({
    where: { userId, name: newName },
  });
  if (existing) {
    return { success: false, message: "Ingredient name already exists" };
  }

  // 3️⃣ Update ingredient name
  const updated = await prisma.ingredient.update({
    where: { id: ingredientId },
    data: { name: newName },
  });

  return { success: true, message: "Ingredient name updated", ingredient: updated };
};



module.exports.deductMealIngredients = async function (
  userId,
  mealId,
  preparedIngredientIds
) {
  return prisma.$transaction(async (tx) => {

    const meal = await tx.meal.findFirst({
      where: {
        id: mealId,
        userMeal: { userId },
      },
      include: {
        mealIngredients: {
          include: { ingredient: true },
        },
      },
    });

    if (!meal)
      throw new Error("Meal not found or not owned by user");

    const updatedIngredients = [];

    for (const mi of meal.mealIngredients) {

      // skip unprepared ingredients
      if (!preparedIngredientIds.includes(mi.ingredientId))
        continue;

      const ingredient = mi.ingredient;

      const newQuantity = Math.max(
        0,
        (ingredient.ingredientQuantity || 0) - mi.quantity
      );

      const updated = await tx.ingredient.update({
        where: { id: ingredient.id },
        data: {
          ingredientQuantity: newQuantity,
        },
      });

      updatedIngredients.push(updated);
    }
console.log("Deducted ingredients, updated:", updatedIngredients);
    return {
      message: "Prepared ingredients deducted",
      updatedIngredients,
    };
  });
};


module.exports.updateIngredientLimits = async function (
  userId,
  ingredientId,
  runningOutLimit,
  outOfStockLimit
) {
  // 1️⃣ Ensure ingredient belongs to user
  const ingredient = await prisma.ingredient.findFirst({
    where: { id: ingredientId, userId },
  });

  if (!ingredient) throw new Error("Ingredient not found or not owned by user");

  // 2️⃣ Update the limits
  const updated = await prisma.ingredient.update({
    where: { id: ingredientId },
    data: {
      runningOutLimit,
      outOfStockLimit,
    },
  });
  return updated;
};


module.exports.deleteIngredient = async function (userId, ingredientId) {
  // 1️⃣ Ensure ingredient belongs to user
  const ingredient = await prisma.ingredient.findFirst({
    where: { id: ingredientId, userId },
  });
  if (!ingredient) throw new Error("Ingredient not found or not owned by user");

  // 2️⃣ Delete ingredient (will also cascade delete MealIngredient if Prisma schema has cascade)
  await prisma.ingredient.delete({
    where: { id: ingredientId },
  });

  return { success: true, message: "Ingredient deleted successfully" };
};

module.exports.checkAndUpdateIngredientStatus = async function (userId, ingredientId) {
  // 1️⃣ Get current ingredient data
  const ingredient = await prisma.ingredient.findFirst({
    where: { id: ingredientId, userId },
  });
  if (!ingredient) throw new Error("Ingredient not found");

  const { ingredientQuantity, runningOutLimit, outOfStockLimit, status } = ingredient;

  // 2️⃣ Determine new status
  let newStatus = status;

  if (ingredientQuantity <= outOfStockLimit) {
    newStatus = "OUT_OF_STOCK";
  } else if (ingredientQuantity <= runningOutLimit) {
    newStatus = "RUNNING_OUT";
  } else {
    newStatus = "IN_STOCK";
  }

  // 3️⃣ Update status if it changed
  if (newStatus !== status) {
    const updated = await prisma.ingredient.update({
      where: { id: ingredientId },
      data: {
        status: newStatus
      },
    });
    return updated;
  }

  return ingredient;
};


module.exports.updateIngredientExpiry = async function (
  userId,
  ingredientId,
  expiryDate
) {
  // Ensure ingredient belongs to user
  const ingredient = await prisma.ingredient.findFirst({
    where: { id: ingredientId, userId },
  });

  if (!ingredient)
    throw new Error("Ingredient not found or not owned by user");

  // Convert or null
  const parsedDate = expiryDate ? new Date(expiryDate) : null;

  const updated = await prisma.ingredient.update({
    where: { id: ingredientId },
    data: {
      expiryDate: parsedDate,
    },
  });

  return updated;
};




// Get smart ingredient suggestions
module.exports.getSmartIngredientSuggestions = async function (userId) {
  const grouped = await prisma.ingredient.groupBy({
    by: ["name"],
    _count: {
      name: true,
    },
    orderBy: {
      _count: {
        name: "desc",
      },
    },
  });

  console.log("Grouped:", grouped);

  // Filter manually
  const suggestions = grouped.filter(
    g => g._count.name >= 5
  );

  const userIngredients = await prisma.ingredient.findMany({
    where: { userId },
    select: { name: true },
  });

  const userNames = userIngredients.map(i =>
    i.name.toLowerCase()
  );

  const filtered = suggestions
    .map(s => s.name)
    .filter(name => !userNames.includes(name.toLowerCase()));

  return filtered;
};

module.exports.saveShoppingSession = async function (
  userId,
  durationSec,
  items
) {
  console.log(userId)
  return prisma.shoppingSession.create({
    data: {
      userId,
      durationSec,
      items: {
        create: items,
      },
    },
  });
};


module.exports.savePreparationSession = async function (
  userId,
  mealId,
  durationSec,
  items
)
{
  return prisma.mealPreparationSession.create({
    data: {
      userId,
      mealId,
      durationSec,
      items: {
        create: items,
      },
    },
  });
};


// Get all shopping sessions for a user with items
module.exports.getShoppingHistory = async function (userId) {
  const sessions = await prisma.shoppingSession.findMany({
    where: { userId },
    include: {
      items: true, // includes ShoppingSessionItem
    },
    orderBy: {
      createdAt: "desc", // latest first
    },
  });

  return sessions.map(s => ({
    id: s.id,
    durationSec: s.durationSec,
    createdAt: s.createdAt,
    items: s.items.map(i => ({
      ingredientId: i.ingredientId,
      ingredientName: i.ingredientName,
      quantityAdded: i.quantityAdded,
      purchaseStatus: i.purchaseStatus,
      stockStatus: i.stockStatus,
    })),
  }));
};
module.exports.getMealPrepHistory = async function (userId) {
  const sessions = await prisma.mealPreparationSession.findMany({
    where: { userId },
    include: {
      items: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const mealIds = [...new Set(sessions.map((s) => s.mealId).filter(Boolean))];
  const meals = mealIds.length
    ? await prisma.meal.findMany({
        where: { id: { in: mealIds } },
        select: { id: true, mealName: true },
      })
    : [];

  const mealNameById = new Map(meals.map((m) => [m.id, m.mealName]));

  return sessions.map(s => ({
    id: s.id,
    mealId: s.mealId,
    mealName: mealNameById.get(s.mealId) || null,
    durationSec: s.durationSec,
    createdAt: s.createdAt,
    items: s.items.map(i => ({
      ingredientId: i.ingredientId,
      ingredientName: i.ingredientName,
      requiredQuantity: i.requiredQuantity,
      stockStatus: i.stockStatus,
      preparationStatus: i.preparationStatus,
    })),
  }));
};
