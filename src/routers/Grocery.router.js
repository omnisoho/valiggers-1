const express = require("express");
const router = express.Router();
const groceryModel = require("../models/Grocery.model");
const authMiddleware = require("../middlewares/authMiddleware");

// POST /grocery/add-meal-ingredients
router.post("/add-meal-ingredients", authMiddleware, async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { mealId, ingredientName } = req.body;

    if (!mealId || !ingredientName) {
      return res
        .status(400)
        .json({ error: "mealId and ingredientName are required" });
    }

    const result = await groceryModel.addIngredientToMeal(
      userId,
      mealId,
      ingredientName,
    );
    res.json(result); // includes { mealIngredient, message }
  } catch (err) {
    next(err);
  }
});

// PUT /grocery/update-quantity/:mealId
router.put(
  "/update-quantity/:mealId",
  authMiddleware,
  async (req, res, next) => {
    try {
      const userId = req.user.userId;
      const mealId = parseInt(req.params.mealId, 10);
      const { ingredientId, quantity } = req.body;

      if (!ingredientId || quantity === undefined) {
        return res
          .status(400)
          .json({ error: "ingredientId and quantity are required" });
      }

      const updatedMealIngredient =
        await groceryModel.updateMealIngredientQuantity(
          userId,
          mealId,
          ingredientId,
          quantity,
        );

      res.json({ success: true, updatedMealIngredient });
    } catch (err) {
      next(err);
    }
  },
);

// PUT /grocery/update-purchase-status/:ingredientId
router.put(
  "/update-purchase-status/:ingredientId",
  authMiddleware,
  async (req, res, next) => {
    try {
      const ingredientId = parseInt(req.params.ingredientId, 10);
      const userId = req.user.userId;
      const { purchaseStatus } = req.body;

      if (!["PENDING", "PURCHASED", "NOT_PURCHASED"].includes(purchaseStatus)) {
        return res.status(400).json({ error: "Invalid purchase status" });
      }

      const ingredient = await groceryModel.updateIngredientPurchaseStatus(
        userId,
        ingredientId,
        purchaseStatus,
      );

      res.json({ success: true, ingredient });
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /grocery/delete-ingredient
router.delete("/delete-meal-ingredient", authMiddleware, async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { mealId, ingredientId } = req.body;

    if (!mealId || !ingredientId) {
      return res
        .status(400)
        .json({ error: "mealId and ingredientId are required" });
    }

    const result = await groceryModel.deleteIngredientFromMeal(
      userId,
      mealId,
      ingredientId,
    );

    res.json(result); // { success: true, message: "...", ingredientDeleted: boolean }
  } catch (err) {
    next(err);
  }
});

// GET /grocery/end-shopping
router.get("/end-shopping", authMiddleware, async (req, res, next) => {
  try {
    const userId = req.user.userId;

    const ingredients = await groceryModel.endShoppingSession(userId);

    res.json({
      success: true,
      ingredients, // ✅ directly send the array
    });
  } catch (err) {
    next(err);
  }
});

// PUT /grocery/update-unit/:ingredientId
router.put(
  "/update-unit/:ingredientId",
  authMiddleware,
  async (req, res, next) => {
    try {
      const userId = req.user.userId;
      const ingredientId = parseInt(req.params.ingredientId, 10);
      const { quantityUnit } = req.body;

      const ingredient = await groceryModel.updateIngredientUnit(
        userId,
        ingredientId,
        quantityUnit,
      );

      res.json({ success: true, ingredient });
    } catch (err) {
      next(err);
    }
  },
);

// GET /grocery/all-ingredients
router.get("/all-ingredients", authMiddleware, async (req, res, next) => {
  try {
    const userId = req.user.userId;

    const ingredients = await groceryModel.getAllIngredients(userId);

    res.json({ success: true, ingredients });
  } catch (err) {
    next(err);
  }
});

// POST /grocery/add-ingredients
router.post("/add-ingredients", authMiddleware, async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { ingredientName } = req.body;

    if (!ingredientName) {
      return res.status(400).json({ error: "ingredientName is required" });
    }

    const result = await groceryModel.addIngredient(userId, ingredientName);

    res.json({
      success: true,
      ingredient: result.ingredient,
      message: result.message,
    });
  } catch (err) {
    next(err);
  }
});

// PUT /grocery/update-ingredient-quantity/:ingredientId
router.put(
  "/update-ingredient-quantity/:ingredientId",
  authMiddleware,
  async (req, res, next) => {
    try {
      const userId = req.user.userId;
      const ingredientId = parseInt(req.params.ingredientId, 10);
      const { quantity } = req.body;

      if (!ingredientId || quantity === undefined) {
        return res
          .status(400)
          .json({ error: "ingredientId and quantity are required" });
      }

      // 1️⃣ Update quantity
      await groceryModel.updateIngredientQuantity(userId, ingredientId, quantity);

      // 2️⃣ Check limits & update status
      const updatedIngredient = await groceryModel.checkAndUpdateIngredientStatus(userId, ingredientId);

      res.json({
        success: true,
        message: "Ingredient quantity updated",
        ingredient: updatedIngredient,
      });
    } catch (err) {
      next(err);
    }
  },
);

// PUT /grocery/update-ingredient-name/:ingredientId
router.put(
  "/update-ingredient-name/:ingredientId",
  authMiddleware,
  async (req, res, next) => {
    try {
      const userId = req.user.userId;
      const ingredientId = parseInt(req.params.ingredientId, 10);
      const { name } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({ error: "Name is required" });
      }

      const result = await groceryModel.updateIngredientName(
        userId,
        ingredientId,
        name.trim(),
      );

      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

// PUT /grocery/deduct-ingredients/:mealId
router.put(
  "/deduct-ingredients/:mealId",
  authMiddleware,
  async (req, res, next) => {
    try {
      const userId = req.user.userId;
      const mealId = parseInt(req.params.mealId, 10);
      const { preparedIngredientIds } = req.body;

        // 1️⃣ Deduct ingredients
      const result = await groceryModel.deductMealIngredients(userId, mealId, preparedIngredientIds || []);

      // 2️⃣ Check each ingredient's limits & update status
      if (preparedIngredientIds && preparedIngredientIds.length > 0) {
        for (const ingredientId of preparedIngredientIds) {
          await groceryModel.checkAndUpdateIngredientStatus(userId, ingredientId);
        }
      }

      res.json({
        success: true,
        ...result,
      });
    } catch (err) {
      next(err);
    }
  },
);


// PUT /grocery/update-ingredient-limits/:ingredientId
router.put(
  "/update-ingredient-limits/:ingredientId",
  authMiddleware,
  async (req, res, next) => {
    try {
      const userId = req.user.userId;
      const ingredientId = parseInt(req.params.ingredientId, 10);
      const { runningOutLimit, outOfStockLimit } = req.body;

      if (
        runningOutLimit === undefined ||
        outOfStockLimit === undefined
      ) {
        return res.status(400).json({ error: "Both limits are required" });
      }

        // 1️⃣ Update limits
      await groceryModel.updateIngredientLimits(
        userId,
        ingredientId,
        runningOutLimit,
        outOfStockLimit
      );

      // 2️⃣ Check status after limits update
      const updatedIngredient = await groceryModel.checkAndUpdateIngredientStatus(
        userId,
        ingredientId
      );

      res.json({ success: true, ingredient: updatedIngredient });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /grocery/delete-ingredient
router.delete("/delete-ingredient", authMiddleware, async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { ingredientId } = req.body;

    if (!ingredientId) {
      return res.status(400).json({ error: "ingredientId is required" });
    }

    const result = await groceryModel.deleteIngredient(userId, ingredientId);
    res.json(result); // { success: true, message: "..." }
  } catch (err) {
    next(err);
  }
});


// GET /grocery/check-ingredient-status/:ingredientId
router.get("/check-ingredient-status/:ingredientId", authMiddleware, async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const ingredientId = parseInt(req.params.ingredientId, 10);

    const ingredient = await groceryModel.checkAndUpdateIngredientStatus(userId, ingredientId);

    res.json({ success: true, ingredient });
  } catch (err) {
    next(err);
  }
});



// PUT /grocery/update-expiry/:ingredientId
router.put(
  "/update-expiry/:ingredientId",
  authMiddleware,
  async (req, res, next) => {
    try {
      const userId = req.user.userId;
      const ingredientId = parseInt(req.params.ingredientId, 10);
      const { expiryDate } = req.body;

      if (!ingredientId) {
        return res.status(400).json({ error: "ingredientId required" });
      }

      const ingredient = await groceryModel.updateIngredientExpiry(
        userId,
        ingredientId,
        expiryDate
      );

      res.json({
        success: true,
        ingredient,
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /grocery/smart-suggestions
router.get(
  "/smart-suggestions",
  authMiddleware,
  async (req, res, next) => {
    try {
      const userId = req.user.userId;

      const suggestions =
        await groceryModel.getSmartIngredientSuggestions(userId);

      res.json({
        success: true,
        suggestions,
      });
    } catch (err) {
      next(err);
    }
  }
);

router.post("/save-shopping-session",  authMiddleware, async (req, res) => {
  const userId = req.user.userId;
  console.log("saving shopping session",userId)
  const { durationSeconds, items } = req.body;

  const session = await groceryModel.saveShoppingSession(
    userId,
    durationSeconds,
    items
  );

  res.json({ success: true, session });
});


router.post("/save-preparation-session",  authMiddleware, async (req, res) => {
 const userId = req.user.userId;
  const { mealId, durationSec, items } = req.body;

  const session = await groceryModel.savePreparationSession(
    userId,
    mealId,
    durationSec,
    items
  );

  res.json({ success: true, session });
});


// GET /grocery/shopping-history
router.get("/shopping-history", authMiddleware, async (req, res, next) => {
  try {
    const userId = req.user.userId;

    const sessions = await groceryModel.getShoppingHistory(userId);

    res.json({ success: true, sessions });
  } catch (err) {
    next(err);
  }
});

// GET /grocery/meal-prep-history
router.get("/meal-prep-history", authMiddleware, async (req, res, next) => {
  try {
    const userId = req.user.userId;

    const sessions = await groceryModel.getMealPrepHistory(userId);

    res.json({ success: true, sessions });
  } catch (err) {
    next(err);
  }
});


module.exports = router;
