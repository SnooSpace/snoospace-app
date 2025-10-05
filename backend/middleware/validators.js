function validateBody(requiredKeys) {
  return function(req, res, next) {
    const body = req.body || {};
    for (const key of requiredKeys) {
      if (typeof body[key] !== 'string' || body[key].trim() === '') {
        return res.status(400).json({ error: `${key} is required` });
      }
    }
    next();
  };
}

function normalizeEmail(req, res, next) {
  if (req.body && typeof req.body.email === 'string') {
    req.body.email = req.body.email.trim().toLowerCase();
  }
  next();
}

module.exports = { validateBody, normalizeEmail };


