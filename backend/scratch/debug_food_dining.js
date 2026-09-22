require('dotenv').config();
const { createPool } = require('../config/db');
const pool = createPool();

async function run() {
  const r = await pool.query(`
    SELECT e.id, e.title, e.start_datetime, e.end_datetime, e.is_published, e.is_cancelled, dc.name as cat_name, dc.slug as cat_slug
    FROM events e
    INNER JOIN event_discover_categories edc ON edc.event_id = e.id
    INNER JOIN discover_categories dc ON dc.id = edc.category_id
    WHERE dc.slug = 'food-dining' OR dc.name = 'Food & Dining'
  `);
  console.log('Food & dining events count:', r.rows.length);
  console.log(r.rows);
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
