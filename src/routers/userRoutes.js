const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const {
  findUserByUsername,
  findUserByEmail,
  createUser,
} = require('../models/userModels.js');

const router = express.Router();

// POST /api/users/register
router.post('/register', async (req, res, next) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'username, email and password are required' });
    }

    // Check if username or email already exists
    const existingByUsername = await findUserByUsername(username);
    const existingByEmail = await findUserByEmail(email);

    if (existingByUsername || existingByEmail) {
      return res.status(400).json({ error: 'Username or email already in use' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const user = await createUser({ username, email, passwordHash });

    return res.status(201).json({
      message: 'User registered successfully',
      userId: user.user_id || user.id,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/users/login
router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'username and password are required' });
    }

    const user = await findUserByUsername(username);
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Create JWT
    const token = jwt.sign(
      {
        userId: user.user_id || user.id,
        username: user.username,
      },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    return res.status(200).json({
      message: 'Login successful',
      token,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
