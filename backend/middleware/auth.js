const supabase = require("../supabase");

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Find user in our database to get the correct ID and type
    const pool = req.app.locals.pool;
    if (!pool) {
      return res.status(500).json({ error: 'Server DB not ready' });
    }

    const tables = [
      { table: 'members', role: 'member', column: 'email', hasSupabaseId: false },
      { table: 'communities', role: 'community', column: 'email', hasSupabaseId: true },
      { table: 'sponsors', role: 'sponsor', column: 'email', hasSupabaseId: true },
      { table: 'venues', role: 'venue', column: 'contact_email', hasSupabaseId: false }
    ];

    for (const { table, role, column, hasSupabaseId } of tables) {
      try {
        let result;
        
        // First try to find by supabase_user_id if the table supports it
        if (hasSupabaseId && user.id) {
          result = await pool.query(`SELECT id FROM ${table} WHERE supabase_user_id = $1`, [user.id]);
          if (result.rows.length > 0) {
            req.user = {
              ...user,
              id: result.rows[0].id,
              type: role
            };
            return next();
          }
        }
        
        // Fall back to email lookup
        // Only select supabase_user_id if the table supports it
        const selectColumns = hasSupabaseId ? 'id, supabase_user_id' : 'id';
        result = await pool.query(`SELECT ${selectColumns} FROM ${table} WHERE ${column} = $1`, [user.email]);
        if (result.rows.length > 0) {
          const dbSupabaseUserId = result.rows[0].supabase_user_id;
          
          // Backfill supabase_user_id if missing and table supports it
          if (hasSupabaseId && !dbSupabaseUserId && user.id) {
            await pool.query(`UPDATE ${table} SET supabase_user_id = $1 WHERE id = $2`, [user.id, result.rows[0].id]);
          }
          
          req.user = {
            ...user,
            id: result.rows[0].id,
            type: role
          };
          return next();
        }
      } catch (err) {
        console.error(`Error checking ${table}:`, err);
        continue;
      }
    }

    return res.status(404).json({ error: 'User profile not found' });
  } catch (err) {
    console.error('Auth middleware error:', err);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

module.exports = { authMiddleware };


