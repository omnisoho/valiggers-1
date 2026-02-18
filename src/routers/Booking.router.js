const express = require("express");
const router = express.Router();

const authMiddleware = require("../middlewares/authMiddleware");

const {
  createBooking,
  getMyBookings,
  getCoachBookingsForMe,
  coachUpdateStatus,
  studentCancelBooking,
} = require("../models/Booking.model");

// same style as your Coach.router helper :contentReference[oaicite:2]{index=2}
function getAuthUserId(req) {
  return req.user?.userId ?? null;
}

// Student: create booking
router.post("/", authMiddleware, (req, res, next) => {
  const userId = getAuthUserId(req);
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  createBooking(userId, req.body)
    .then((booking) => res.status(201).json(booking))
    .catch(next);
});

// Student: list my bookings
router.get("/me", authMiddleware, (req, res, next) => {
  const userId = getAuthUserId(req);
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  getMyBookings(userId)
    .then((rows) => res.status(200).json(rows))
    .catch(next);
});

// Student: cancel
router.put("/:id/cancel", authMiddleware, (req, res, next) => {
  const userId = getAuthUserId(req);
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  studentCancelBooking(req.params.id, userId)
    .then((row) => res.status(200).json(row))
    .catch(next);
});

// Coach: list bookings for my coach profile
router.get("/coach/me", authMiddleware, (req, res, next) => {
  const userId = getAuthUserId(req);
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  getCoachBookingsForMe(userId)
    .then((rows) => res.status(200).json(rows))
    .catch(next);
});

// Coach: update status (CONFIRMED | COMPLETED | CANCELLED)
router.put("/:id/status", authMiddleware, (req, res, next) => {
  const userId = getAuthUserId(req);
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  coachUpdateStatus(req.params.id, userId, req.body?.status)
    .then((row) => res.status(200).json(row))
    .catch(next);
});

module.exports = router;
