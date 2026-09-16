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
  `SELECT conname, pg_get_constraintdef(oid) as def
   FROM pg_constraint
   WHERE conrelid = 'members'::regclass
   ORDER BY conname`
).then(r => {
  r.rows.forEach(row => console.log(`${row.conname}: ${row.def}`));
  pool.end();
}).catch(e => { console.error(e.message); pool.end(); });
