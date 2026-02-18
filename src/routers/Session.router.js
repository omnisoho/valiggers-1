const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/authMiddleware");
router.use(authMiddleware); // ✅ protect all session routes

const {
  getTodayContext,
  switchToLatestPresetForToday,
  updateSessionState,
} = require("../models/Session.model");

const { onSessionCompleted } = require("../models/Challenge.model");

router.get("/today", (req, res, next) => {
  getTodayContext(req.user.userId).then(res.json.bind(res)).catch(next);
});

router.post("/today/switch", (req, res, next) => {
  switchToLatestPresetForToday(req.user.userId)
    .then((data) => {
      if (!data.ok) return res.status(400).json({ error: data.message });
      res.json(data);
    })
    .catch(next);
});

router.patch("/:id/state", (req, res, next) => {
  updateSessionState(Number(req.params.id), req.user.userId, req.body.state)
    .then(async (updated) => {
      // If session is completed, auto-complete the daily challenge (once/day)
      if (String(updated?.state || "").toUpperCase() === "COMPLETED") {
        try {
          await onSessionCompleted(req.user.userId);
        } catch (e) {
          console.error("[CHALLENGES] Failed to update daily challenge on session completion:", e);
        }
      }
      return updated;
    })
    .then((updated) => res.json(updated))
    .catch((err) => {
      res.status(err.status || 500).json({ error: err.message || "Server error" });
    });
});

module.exports = router;
