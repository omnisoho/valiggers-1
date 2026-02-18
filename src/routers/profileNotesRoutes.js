const express = require("express");
const jwt = require("jsonwebtoken");
const { getNotes, createNote, deleteNote, togglePin } = require("../models/profileNotesModel");

const router = express.Router();

// Authenticate
function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: "No token" });

  const token = header.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

// GET notes
router.get("/", auth, async (req, res) => {
  const sort = req.query.sort || "latest";
  const notes = await getNotes(req.userId, sort);
  res.json(notes);
});

// POST create note
router.post("/", auth, async (req, res) => {
  const { content } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: "Empty content" });

  const note = await createNote(req.userId, content);
  res.json(note);
});

// DELETE note
router.delete("/:id", auth, async (req, res) => {
  const id = parseInt(req.params.id);
  await deleteNote(id, req.userId);
  res.json({ message: "Deleted" });
});

// PATCH pin/unpin
router.patch("/:id/pin", auth, async (req, res) => {
  const id = parseInt(req.params.id);
  const note = await togglePin(id, req.userId);
  res.json(note);
});

module.exports = router;
