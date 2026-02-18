const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/authMiddleware");

const {
  createOrGetConversation,
  listMyConversations,
  getMessages,
  sendMessage,
} = require("../models/Chat.model");

// same pattern as your other routers 
function getAuthUserId(req) {
  return req.user?.userId ?? null;
}

// Create/get conversation (student starts chat with coach)
router.post("/conversations", authMiddleware, async (req, res, next) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const coachId = Number(req.body?.coachId);
    if (!coachId) return res.status(400).json({ message: "coachId is required" });

    const convo = await createOrGetConversation(userId, coachId);
    res.status(201).json(convo);
  } catch (e) {
    next(e);
  }
});

// List my conversations (works for student OR coach owner)
router.get("/conversations", authMiddleware, async (req, res, next) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const rows = await listMyConversations(userId);
    res.status(200).json(rows);
  } catch (e) {
    next(e);
  }
});

// Get messages
router.get("/conversations/:id/messages", authMiddleware, async (req, res, next) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const take = req.query.take ? Number(req.query.take) : 50;
    const cursor = req.query.cursor ? Number(req.query.cursor) : null;

    const data = await getMessages(req.params.id, userId, take, cursor);
    res.status(200).json(data);
  } catch (e) {
    next(e);
  }
});

// Send message
router.post("/conversations/:id/messages", authMiddleware, async (req, res, next) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const msg = await sendMessage(req.params.id, userId, req.body?.content);
    res.status(201).json(msg);
  } catch (e) {
    next(e);
  }
});

router.get("/_ping", (req, res) => res.json({ ok: true }));


module.exports = router;
