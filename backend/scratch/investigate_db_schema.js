const { createPool } = require('../config/db');
const pool = createPool();

async function run() {
  try {
    const schema = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'discover_categories'
    `);
    console.log('DISCOVER_CATEGORIES COLUMNS:', schema.rows);

    const rows = await pool.query(`
      SELECT id, name, slug, icon_name, display_order, parent_id, is_active
      FROM discover_categories 
      WHERE is_active = true
      ORDER BY display_order ASC, id ASC
      LIMIT 25
    `);
    console.log('TOP DISCOVER_CATEGORIES:', rows.rows);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

run();
