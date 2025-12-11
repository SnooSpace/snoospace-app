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
      { table: 'members', role: 'member', column: 'email', hasSupabaseId: true },
      { table: 'communities', role: 'community', column: 'email', hasSupabaseId: true },
      { table: 'sponsors', role: 'sponsor', column: 'email', hasSupabaseId: true },
      { table: 'venues', role: 'venue', column: 'contact_email', hasSupabaseId: true }
    ];

    for (const { table, role, column, hasSupabaseId } of tables) {
      try {
        let result;
        
        // PRIORITY 1: Lookup by EMAIL first (most reliable - each account has unique email)
        // This ensures correct account is found even when multiple accounts share supabase_user_id
        if (user.email) {
          result = await pool.query(`SELECT id, supabase_user_id FROM ${table} WHERE ${column} = $1`, [user.email]);
          if (result.rows.length > 0) {
            const dbRow = result.rows[0];
            
            // Backfill supabase_user_id if missing
            if (hasSupabaseId && !dbRow.supabase_user_id && user.id) {
              await pool.query(`UPDATE ${table} SET supabase_user_id = $1 WHERE id = $2`, [user.id, dbRow.id]);
              console.log(`[Auth] Backfilled supabase_user_id for ${role} id=${dbRow.id}`);
            }
            
            console.log(`[Auth] Found ${role} by email:`, { id: dbRow.id, email: user.email });
            
            req.user = {
              ...user,
              id: dbRow.id,
              type: role
            };
            return next();
          }
        }
        
        // PRIORITY 2: Fallback to supabase_user_id lookup (for accounts without matching email)
        // This can return wrong account if multiple accounts share supabase_user_id!
        if (hasSupabaseId && user.id) {
          result = await pool.query(`SELECT id FROM ${table} WHERE supabase_user_id = $1`, [user.id]);
          if (result.rows.length > 0) {
            console.log(`[Auth] ⚠️ Found ${role} by supabase_user_id (email didn't match):`, { 
              id: result.rows[0].id, 
              supabaseUserId: user.id,
              tokenEmail: user.email 
            });
            
            req.user = {
              ...user,
              id: result.rows[0].id,
              type: role
            };
            return next();
          }
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


