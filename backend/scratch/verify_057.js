require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASS,
  port: process.env.DB_PORT,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

async function verify() {
  const client = await pool.connect();
  try {
    // Query A: every group should have exactly 3 dimensions (27 rows, all count=3)
    console.log('=== Query A: category_group_dimensions row counts per group ===');
    const queryA = await client.query(
      'SELECT category_group, count(*)::int AS dim_count FROM category_group_dimensions GROUP BY category_group ORDER BY category_group'
    );
    let allThree = true;
    queryA.rows.forEach(r => {
      const flag = r.dim_count !== 3 ? ' ⚠️  WRONG' : '';
      console.log(' ', r.dim_count, 'dims |', r.category_group, flag);
      if (r.dim_count !== 3) allThree = false;
    });
    console.log('\nTotal groups:', queryA.rows.length, '(expected 27)');
    console.log('All have 3 dims:', allThree ? 'YES ✅' : 'NO ⚠️');

    // Query B: any events.category_group values missing from the mapping
    console.log('\n=== Query B: events.category_group values not covered by mapping ===');
    const queryB = await client.query(
      "SELECT DISTINCT e.category_group, COUNT(*)::int AS event_count FROM events e LEFT JOIN category_group_dimensions cgd ON cgd.category_group = e.category_group WHERE cgd.category_group IS NULL AND e.category_group IS NOT NULL GROUP BY e.category_group ORDER BY e.category_group"
    );
    if (queryB.rows.length === 0) {
      console.log('  None — all events are either NULL/general or have a mapped group ✅');
    } else {
      console.log('  ⚠️  UNMAPPED values found:');
      queryB.rows.forEach(r => console.log('   ', r.event_count, 'events |', r.category_group));
    }

    // Query C: show full dimension details per group for human review
    console.log('\n=== Query C: full mapping with dimension keys ===');
    const queryC = await client.query(
      'SELECT cgd.category_group, rd.key AS dimension_key, rd.label, cgd.display_order FROM category_group_dimensions cgd JOIN review_dimensions rd ON rd.id = cgd.dimension_id ORDER BY cgd.category_group, cgd.display_order'
    );
    let lastGroup = null;
    queryC.rows.forEach(r => {
      if (r.category_group !== lastGroup) {
        if (lastGroup !== null) console.log('');
        console.log('[' + r.category_group + ']');
        lastGroup = r.category_group;
      }
      console.log('  ' + r.display_order + '. ' + r.dimension_key + ' (' + r.label + ')');
    });

    // Query D: events.category_group distribution
    console.log('\n=== Query D: events.category_group distribution ===');
    const queryD = await client.query(
      "SELECT COALESCE(category_group, '(NULL)') AS category_group, COUNT(*)::int AS event_count FROM events GROUP BY category_group ORDER BY event_count DESC LIMIT 40"
    );
    queryD.rows.forEach(r => console.log(' ', r.event_count, '|', r.category_group));

    // Query E: review data submitted so far
    console.log('\n=== Query E: review data submitted so far ===');
    const e1 = await client.query('SELECT COUNT(*)::int AS n FROM event_reviews');
    const e2 = await client.query('SELECT COUNT(*)::int AS n FROM event_review_dimension_ratings');
    const e3 = await client.query('SELECT COUNT(*)::int AS n FROM open_plan_reviews');
    console.log('  event_reviews:', e1.rows[0].n);
    console.log('  event_review_dimension_ratings:', e2.rows[0].n);
    console.log('  open_plan_reviews:', e3.rows[0].n);

  } finally {
    client.release();
    await pool.end();
  }
}

verify().catch(e => { console.error(e.message); process.exit(1); });
