const express = require("express");
const router = express.Router();

const authMiddleware = require("../middlewares/authMiddleware");
router.use(authMiddleware);

const {
  getUserRewards,
  redeemReward,
} = require("../models/Rewards.model");

// For front-end display
router.get("/me", async (req, res, next) => {
  try {
    const r = await getUserRewards(req.user.userId);
    res.json({ totalPoints: r?.totalPoints ?? 0 });
  } catch (err) {
    next(err);
  }
});

// Redeem a voucher with points (voucher ownership is stored client-side for now)
// Body: { rewardId: "voucher-1" | "voucher-3" | "voucher-5" }
router.post("/redeem", async (req, res, next) => {
  try {
    const rewardId = String(req.body?.rewardId || "").trim();
    if (!rewardId) return res.status(400).json({ error: "rewardId is required" });

    const voucher = await redeemReward(req.user.userId, rewardId);
    res.json({ ok: true, voucher, totalPoints: voucher.remainingPoints });
  } catch (err) {
    res.status(400).json({ error: err.message || "Unable to redeem" });
  }
});

module.exports = router;
