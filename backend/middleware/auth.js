const jwt = require('jsonwebtoken');
const User = require('../models/user');

module.exports = async (req, res, next) => {
  try {
    const authorization = req.headers.authorization || '';
    const [scheme, token] = authorization.split(' ');

    if (scheme !== 'Bearer' || !token) {
      return res.status(401).json({ message: 'Authentication token required' });
    }
    if (!process.env.JWT_SECRET) {
      return res.status(503).json({ message: 'Server authentication is not configured' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('role isActive');
    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'Account is unavailable' });
    }

    req.user = { userId: String(user._id), role: user.role };
    return next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};
