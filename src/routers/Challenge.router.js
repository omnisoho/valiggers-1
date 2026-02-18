const express = require("express");
const router = express.Router();

const authMiddleware = require("../middlewares/authMiddleware");
router.use(authMiddleware);

const { getMySingleChallenge, acceptMySingleChallenge, startMySingleChallenge } = require("../models/Challenge.model");
const { getUserRewards } = require("../models/Rewards.model");

// Single daily challenge view (Complete 1 Session)
router.get("/me", async (req, res, next) => {
  try {
    const userId = req.user.userId;

    const { userChallenge, previousDayStatus } = await getMySingleChallenge(userId);
    const rewards = await getUserRewards(userId);

    res.json({
      userChallenge,
      previousDayStatus: previousDayStatus || null,
      totalPoints: rewards?.totalPoints ?? 0,
    });
  } catch (err) {
    next(err);
  }
});

// Accept today's challenge (AVAILABLE -> ACCEPTED)
router.post("/me/accept", async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const userChallenge = await acceptMySingleChallenge(userId);
    const rewards = await getUserRewards(userId);

    res.json({
      userChallenge,
      totalPoints: rewards?.totalPoints ?? 0,
    });
  } catch (err) {
    next(err);
  }
});

// Start challenge (ACCEPTED -> IN_PROGRESS)
router.post("/me/start", async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const userChallenge = await startMySingleChallenge(userId);
    const rewards = await getUserRewards(userId);

    res.json({
      userChallenge,
      totalPoints: rewards?.totalPoints ?? 0,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
