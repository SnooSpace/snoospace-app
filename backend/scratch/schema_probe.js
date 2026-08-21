require('dotenv').config({ path: __dirname + '/../.env' });
const { Pool } = require('pg');
const pool = new Pool({ host: process.env.DB_HOST, port: +process.env.DB_PORT, user: process.env.DB_USER, password: process.env.DB_PASS, database: process.env.DB_NAME, ssl: { rejectUnauthorized: false } });
async function main() {
  const c = await pool.connect();
  try {
    const r = await c.query(`SELECT column_name, is_nullable, column_default FROM information_schema.columns WHERE table_name='post_impression_state' ORDER BY ordinal_position`);
    console.log('post_impression_state columns:');
    r.rows.forEach(row => console.log(`  ${row.column_name}  nullable=${row.is_nullable}  default=${row.column_default}`));
  } finally { c.release(); await pool.end(); }
}
main().catch(e => { console.error(e.message); process.exit(1); });
