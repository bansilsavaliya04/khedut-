function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: `${roles.join(' or ')} access required` });
    }
    return next();
  };
}

module.exports = { requireRole };
