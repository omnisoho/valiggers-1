const express = require('express');
const jwt = require('jsonwebtoken');
const { getProfile, updateProfile } = require('../models/profileModel');
const multer = require("multer");
const path = require("path");

const router = express.Router();

// Storage config
const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `pfp_${req.userId}_${Date.now()}${ext}`);
  }
});

const upload = multer({ storage });

// Simple JWT auth middleware
function auth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader)
    return res.status(401).json({ error: 'No token provided' });

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// POST /api/profile/upload (image + data)
router.post("/upload", auth, upload.single("pfp"), async (req, res) => {
  try {
    const body = req.body;
    let pfpUrl = null;

    if (req.file) {
      pfpUrl = `/uploads/${req.file.filename}`;
    }

    const updatedUser = await updateProfile(req.userId, {
      ...body,
      pfpUrl
    });

    const profile = {
      username: updatedUser.username,
      bio: updatedUser.bio,
      weight: updatedUser.weight,
      bodyfat: updatedUser.bodyfat,
      height: updatedUser.height,
      pfpUrl: updatedUser.pfpUrl,
    };

    return res.status(200).json({
      message: "Profile updated",
      profile
    });
  } catch (err) {
    console.error("Upload error:", err);
    return res.status(500).json({ error: "Failed to upload profile picture" });
  }
});

// GET /api/profile  -> return profile data
router.get('/', auth, async (req, res) => {
  try {
    const profile = await getProfile(req.userId);
    if (!profile) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.status(200).json(profile);
  } catch (err) {
    console.error('GET /api/profile error:', err);
    return res.status(500).json({ error: 'Failed to load profile' });
  }
});

// PUT /api/profile  -> update profile + return new token if username changed
router.put('/', auth, async (req, res) => {
  try {
    const updatedUser = await updateProfile(req.userId, req.body);

    // Create a fresh JWT (in case username changed)
    const newToken = jwt.sign(
      {
        userId: updatedUser.user_id,
        username: updatedUser.username,
      },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const profile = {
      username: updatedUser.username,
      bio: updatedUser.bio,
      weight: updatedUser.weight,
      bodyfat: updatedUser.bodyfat,
      height: updatedUser.height,
      pfpUrl: updatedUser.pfpUrl,
    };

    return res.status(200).json({
      message: 'Profile updated successfully',
      profile,
      token: newToken,
    });
  } catch (err) {
    console.error('PUT /api/profile error:', err);

    // Handle unique constraint on username
    if (err.code === 'P2002') {
      return res.status(400).json({ error: 'Username already taken' });
    }

    return res.status(500).json({ error: 'Failed to update profile' });
  }
});

module.exports = router;
