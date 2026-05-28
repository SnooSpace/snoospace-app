require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { createPool } = require('../config/db');
const pool = createPool();

async function run() {
  // Add columns
  await pool.query('ALTER TABLE user_aqi_signals ADD COLUMN IF NOT EXISTS total_rsvps INT DEFAULT 0');
  await pool.query('ALTER TABLE user_aqi_signals ADD COLUMN IF NOT EXISTS total_attended INT DEFAULT 0');
  console.log('✓ Columns added: total_rsvps, total_attended');

  // Backfill from event_registrations
  const res = await pool.query(`
    UPDATE user_aqi_signals s SET
      total_rsvps          = sub.rsvp_count,
      total_attended       = sub.attended_count,
      rsvp_to_attend_ratio = CASE WHEN sub.rsvp_count > 0
        THEN sub.attended_count::float / sub.rsvp_count ELSE 0 END
    FROM (
      SELECT member_id AS user_id,
        COUNT(*)  AS rsvp_count,
        SUM(CASE WHEN registration_status IN ('attended','registered') THEN 1 ELSE 0 END) AS attended_count
      FROM event_registrations
      GROUP BY member_id
    ) sub
    WHERE s.user_id = sub.user_id
    RETURNING s.user_id, s.total_rsvps, s.total_attended, s.rsvp_to_attend_ratio
  `);
  console.log(`✓ Backfilled ${res.rowCount} user(s):`);
  res.rows.forEach(r => console.log(`  user ${r.user_id}: rsvps=${r.total_rsvps} attended=${r.total_attended} ratio=${r.rsvp_to_attend_ratio}`));

  await pool.end();
}

run().catch(e => { console.error(e.message); pool.end(); });
