require('dotenv').config({ path: __dirname + '/../.env' });
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: +process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const c = await pool.connect();
  try {
    const postViews = await c.query("SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='post_views')");
    console.log('post_views exists:', postViews.rows[0].exists);
    if (postViews.rows[0].exists) {
      const cols = await c.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='post_views'");
      console.table(cols.rows);
    }

    // Check unique_view_events columns
    const uveCols = await c.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='unique_view_events'");
    console.table(uveCols.rows);

  } finally {
    c.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
