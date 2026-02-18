const express = require("express");
const router = express.Router();

const {
  getAllPresets,
  getPresetById,
  createPreset,
  updatePreset,
  deletePreset
} = require("../models/Preset.model");

const authMiddleware = require("../middlewares/authMiddleware");

// GET all
router.get("/", authMiddleware, (req, res, next) => {
  getAllPresets(req.user.userId)
    .then(presets => res.json(presets))
    .catch(next);
});

// GET one
router.get("/:id", authMiddleware, (req, res, next) => {
  getPresetById(Number(req.params.id))
    .then(preset => res.json(preset))
    .catch(next);
});

// CREATE
router.post("/", authMiddleware, (req, res, next) => {
  createPreset(req.body, req.user.userId)
    .then(p => res.status(201).json(p))
    .catch(next);
});

// UPDATE
router.put("/:id", authMiddleware, (req, res, next) => {
  updatePreset(Number(req.params.id), req.body, req.user.userId)
    .then(p => res.json(p))
    .catch(next);
});

// DELETE
router.delete("/:id", authMiddleware, (req, res, next) => {
  deletePreset(Number(req.params.id), req.user.userId)
    .then(p => res.json(p))
    .catch(next);
});

module.exports = router;
