const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];

  // Expecting: "Bearer <token>"
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Missing token' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { userId, username, iat, exp }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'AUTH_REQUIRED' });
  }
}

module.exports = authMiddleware;
