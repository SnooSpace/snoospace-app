// Run from backend dir: node scratch/db_audit_query.js
const { Pool } = require('pg');
const pool = new Pool({
  host: 'aws-1-ap-south-1.pooler.supabase.com',
  port: 6543,
  user: 'postgres.ujtoywnkodshtprqojap',
  password: 'wiH6gAz4tc5aYeMZ',
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
});

pool.query(
  `SELECT id, name, is_verified, verification_tier, verified_reference_photos::text, appear_in_discover
   FROM members WHERE verification_tier = 'plans_verified' LIMIT 5`
).then(r => {
  console.log('=== plans_verified members ===');
  console.log(JSON.stringify(r.rows, null, 2));
  return pool.end();
}).catch(e => {
  console.error('Error:', e.message);
  pool.end();
});
