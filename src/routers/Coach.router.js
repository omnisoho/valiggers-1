const express = require("express");
const router = express.Router();

const authMiddleware = require("../middlewares/authMiddleware");

const {
  getAllCoaches,
  getCoachById,
  createCoachProfile,
  updateCoachProfile,
  upsertReview,
  deleteReview,
  canUserReviewCoach,
} = require("../models/Coach.model");

// Helper: adapt to whatever your authMiddleware sets
function getAuthUserId(req) {
  return req.user?.userId ?? null;
}
// Public: list coaches (filters + sorting + aggregation)
router.get("/", (req, res, next) => {
  getAllCoaches(req.query)
    .then((coaches) => res.status(200).json(coaches))
    .catch(next);
});

// Public: coach detail (includes reviews + avg/count)
router.get("/:id", (req, res, next) => {
  getCoachById(req.params.id)
    .then((coach) => {
      if (!coach) return res.status(404).json({ message: "Coach not found" });
      res.status(200).json(coach);
    })
    .catch(next);
});

// Auth: create coach profile (for logged-in user)
router.post("/", authMiddleware, (req, res, next) => {
  const userId = getAuthUserId(req);
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  createCoachProfile(userId, req.body)
    .then((coach) => res.status(201).json(coach))
    .catch(next);
});

// Auth: update coach profile (only owner)
router.put("/:id", authMiddleware, (req, res, next) => {
  const userId = getAuthUserId(req);
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  updateCoachProfile(req.params.id, userId, req.body)
    .then((coach) => {
      if (!coach) return res.status(403).json({ message: "Not allowed" });
      res.status(200).json(coach);
    })
    .catch(next);
});

// Auth: deactivate coach profile (soft delete)
router.delete("/:id", authMiddleware, (req, res, next) => {
  const userId = getAuthUserId(req);
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  deactivateCoachProfile(req.params.id, userId)
    .then((ok) => {
      if (!ok) return res.status(403).json({ message: "Not allowed" });
      res.status(204).send();
    })
    .catch(next);
});

// Auth: create/update review for a coach (upsert)
router.post("/:id/reviews", authMiddleware, (req, res, next) => {
  const userId = getAuthUserId(req);
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  upsertReview(req.params.id, userId, req.body)
    .then((review) => res.status(201).json(review))
    .catch(next);
});

// Auth: delete own review by reviewId
router.delete("/:id/reviews/:reviewId", authMiddleware, (req, res, next) => {
  const userId = getAuthUserId(req);
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  deleteReview(req.params.reviewId, userId)
    .then((ok) => {
      if (!ok) return res.status(403).json({ message: "Not allowed" });
      res.status(204).send();
    })
    .catch(next);
});

// Auth: check if logged-in user can review this coach
router.get("/:id/reviews/eligibility", authMiddleware, async (req, res, next) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const ok = await canUserReviewCoach(req.params.id, userId);

    if (!ok) {
      return res.status(200).json({
        canReview: false,
        reason: "You can only review after completing a booking with this coach.",
      });
    }

    return res.status(200).json({ canReview: true });
  } catch (err) {
    next(err);
  }
});
module.exports = router;