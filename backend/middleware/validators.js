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

/**
 * Check if an email is already in use across all user roles
 * @param {Object} pool - Database pool
 * @param {string} email - Email to check
 * @param {string} excludeTable - Table to exclude from check (e.g., 'members')
 * @param {number} excludeId - ID to exclude from check (current user)
 * @returns {Promise<boolean>} - True if email exists, false otherwise
 */
async function isEmailInUse(pool, email, excludeTable = null, excludeId = null) {
  const emailTrimmed = email.trim().toLowerCase();
  
  const tables = [
    { table: 'members', column: 'email' },
    { table: 'communities', column: 'email' },
    { table: 'sponsors', column: 'email' },
    { table: 'venues', column: 'contact_email' }
  ];

  for (const { table, column } of tables) {
    // Skip the table/id combination we're excluding (current user)
    if (table === excludeTable) {
      const result = await pool.query(
        `SELECT 1 FROM ${table} WHERE ${column} = $1 AND id <> $2 LIMIT 1`,
        [emailTrimmed, excludeId]
      );
      if (result.rows.length > 0) return true;
    } else {
      const result = await pool.query(
        `SELECT 1 FROM ${table} WHERE ${column} = $1 LIMIT 1`,
        [emailTrimmed]
      );
      if (result.rows.length > 0) return true;
    }
  }
  
  return false;
}

module.exports = { validateBody, normalizeEmail, isEmailInUse };


