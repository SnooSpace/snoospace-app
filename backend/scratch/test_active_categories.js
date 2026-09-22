require('dotenv').config();
const { createPool } = require('../config/db');
const pool = createPool();

async function run() {
  const r = await pool.query(`
    SELECT 
      dc.id, 
      dc.name, 
      dc.slug, 
      dc.icon_name as "iconName", 
      dc.display_order as "displayOrder",
      COUNT(DISTINCT e.id)::int as "eventCount"
    FROM discover_categories dc
    INNER JOIN event_discover_categories edc ON dc.id = edc.category_id
    INNER JOIN events e ON edc.event_id = e.id
    WHERE dc.is_active = true
      AND (dc.visible_from IS NULL OR dc.visible_from <= NOW())
      AND (dc.visible_until IS NULL OR dc.visible_until >= NOW())
      AND (e.end_datetime > NOW() OR (e.end_datetime IS NULL AND e.start_datetime > NOW() - INTERVAL '4 hours'))
      AND (e.is_published = true OR e.is_published IS NULL)
      AND e.is_cancelled IS NOT TRUE
    GROUP BY dc.id, dc.name, dc.slug, dc.icon_name, dc.display_order
    HAVING COUNT(DISTINCT e.id) > 0
    ORDER BY "displayOrder" ASC, dc.id ASC
  `);
  console.log(r.rows);
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
