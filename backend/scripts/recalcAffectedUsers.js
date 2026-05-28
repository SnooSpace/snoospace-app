/**
 * After migrateAttendanceColumns.js, recalculate AQI for any user whose
 * paid_event_attended signals were downgraded to event_rsvp.
 * This resets their behavioral AQI to an honest value.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { createPool } = require('../config/db');
const { recalculateAqiAsync } = require('../utils/signalEmitter');
const p = createPool();

async function run() {
  // Find all users who had their signal downgraded (now have event_rsvp
  // where paid_event_attended used to be) and whose score may be stale
  const affected = await p.query(`
    SELECT DISTINCT ube.user_id
    FROM user_behavior_events ube
    JOIN user_aqi_signals s ON s.user_id = ube.user_id
    WHERE ube.event_type = 'event_rsvp'
      AND s.paid_events_attended > 0
      -- user_aqi_signals still shows paid_events_attended > 0 but no confirmed events
      AND NOT EXISTS (
        SELECT 1 FROM event_registrations er
        WHERE er.member_id = ube.user_id
          AND er.attendance_status IN ('confirmed_attended','inferred_attended','manually_confirmed')
      )
  `);

  console.log(`Recalculating AQI for ${affected.rows.length} user(s)...`);

  for (const row of affected.rows) {
    const userId = row.user_id;

    // Zero out the paid_events_attended sub-signal since there are no confirmed ones
    await p.query(`
      UPDATE user_aqi_signals
      SET paid_events_attended   = 0,
          avg_ticket_price_paid  = 0
      WHERE user_id = $1
    `, [userId]);

    await recalculateAqiAsync(p, userId);
    await new Promise(r => setTimeout(r, 200));
    console.log(`  ✓ User ${userId} AQI recalculated`);
  }

  // Show final state
  if (affected.rows.length > 0) {
    const ids = affected.rows.map(r => r.user_id);
    const result = await p.query(`
      SELECT user_id, aqi_score, aqi_tier, aqi_trajectory,
             paid_events_attended, total_behavior_events
      FROM user_aqi_signals WHERE user_id = ANY($1::int[])
    `, [ids]);
    console.log('\nFinal state:');
    result.rows.forEach(r => console.log(JSON.stringify(r)));
  }

  await p.end();
}
run().catch(e => { console.error(e.message); p.end(); });
