const express = require("express");
const router = express.Router();

const {
  getWeeklyPlan,
  createEmptyWeeklyPlan,
  updateDay,
  reset
} = require("../models/WeeklyPlan.model");

const authMiddleware = require("../middlewares/authMiddleware");

// GET weekly plan
router.get("/", authMiddleware, async (req, res, next) => {
  try {
    const userId = req.user.userId;

    let plan = await getWeeklyPlan(userId);

    if (!plan) {
      plan = await createEmptyWeeklyPlan(userId);
    }

    res.json(plan);
  } catch (err) {
    next(err);
  }
});

// UPDATE single day
router.put("/day/:day", authMiddleware, async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const day = req.params.day;
    const { presetId } = req.body;

    await updateDay(userId, day, presetId);

    res.json({ message: `${day} updated` });
  } catch (err) {
    next(err);
  }
});

// RESET weekly plan
router.delete("/", authMiddleware, async (req, res, next) => {
  try {
    const userId = req.user.userId;

    await reset(userId);

    res.json({ message: "Weekly plan reset" });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
