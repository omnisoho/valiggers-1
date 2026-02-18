const express = require("express");
const multer = require("multer");
const router = express.Router();
const nutritionModel = require("../models/nutrition.model");
const authMiddleware = require("../middlewares/authMiddleware");


// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + "-" + file.originalname;
    cb(null, uniqueName);
  },
});
const upload = multer({ storage });

// POST /meals - create meal (requires auth)
router.post("/", authMiddleware, upload.single("photo"), (req, res, next) => {
  nutritionModel.CreateMeal(req, res, next).catch(next);
});

// POST /nutrition/consume - increment totalCalories (requires auth)
router.post("/consume", authMiddleware, (req, res, next) => {
  nutritionModel.consumeMeal(req, res, next);
});

// PUT /updateLimit - update calorie limit (requires auth)
router.put("/updateLimit", authMiddleware, (req, res, next) => {
  nutritionModel.updateCalorieLimit(req, res, next);
});

// GET /nutrition/meals - fetch all meals for logged-in user (requires auth)
// Note: no userId in URL anymore, backend reads from JWT
router.get("/meals", authMiddleware, (req, res, next) => {
  nutritionModel.getUserMeal(req, res, next);
});

router.get("/intake", authMiddleware, (req, res, next) => {
  nutritionModel.getUserIntake(req, res, next);
});

// Update meal
router.put("/meals/:mealId", (req, res, next) => {
  nutritionModel.updateMeal(req, res, next);
});

// Delete meal
router.delete("/meals/:mealId", (req, res, next) => {
  nutritionModel.deleteMeal(req, res, next);
});


// Optional: global error handler
router.use((err, req, res, next) => {
  console.error("Route error:", err);
  res.status(500).json({ error: err.message || "Internal Server Error" });
});

module.exports = router;
