require('dotenv').config();
const { createPool } = require('../config/db');
const pool = createPool();

async function verify() {
  const client = await pool.connect();
  try {
    const t1 = await client.query(
      "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'event_quality_scores'"
    );
    console.log('event_quality_scores exists:', t1.rows[0].count === '1' ? 'YES' : 'NO');

    const cols = await client.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'event_quality_scores' ORDER BY ordinal_position"
    );
    console.log('Columns:', cols.rows.map(r => r.column_name).join(', '));

    const ev = await client.query(
      "SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'quality_score_id'"
    );
    console.log('events.quality_score_id exists:', ev.rows[0].count === '1' ? 'YES' : 'NO');

    const idx = await client.query(
      "SELECT indexname FROM pg_indexes WHERE tablename = 'event_quality_scores' ORDER BY indexname"
    );
    console.log('Indexes:', idx.rows.map(r => r.indexname).join(', '));

    console.log('\nVerification complete!');
  } finally {
    client.release();
    pool.end();
  }
}

verify().catch(e => { console.error(e.message); process.exit(1); });
