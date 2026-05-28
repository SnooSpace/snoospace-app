require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { createPool } = require('../config/db');
const { emitSignal, recalculateAqiAsync } = require('../utils/signalEmitter');
const pool = createPool();

async function test() {
  const userId = 51;

  const before = await pool.query(
    'SELECT paid_events_attended, content_depth_score, professional_hours_ratio, total_rsvps, total_attended, rsvp_to_attend_ratio, aqi_score FROM user_aqi_signals WHERE user_id=$1',
    [userId],
  );
  console.log('BEFORE:', JSON.stringify(before.rows[0], null, 2));

  // Emit a QR checkin (verified attendance — now the strongest signal at 5.0)
  await emitSignal(pool, { userId, userType: 'member', eventType: 'qr_checkin', metadata: {} });
  // Emit a poll vote with category
  await emitSignal(pool, { userId, userType: 'member', eventType: 'poll_vote', category: 'networking', metadata: {} });
  // Emit a long video watch at 85% completion
  await emitSignal(pool, { userId, userType: 'member', eventType: 'content_watched_long', metadata: { completionRatio: 0.85 } });

  await new Promise(r => setTimeout(r, 800));

  const after = await pool.query(
    'SELECT paid_events_attended, content_depth_score, professional_hours_ratio, total_rsvps, total_attended, rsvp_to_attend_ratio, aqi_score, aqi_tier FROM user_aqi_signals WHERE user_id=$1',
    [userId],
  );
  console.log('AFTER:', JSON.stringify(after.rows[0], null, 2));

  // Force a full AQI recalc so we see the updated score
  await recalculateAqiAsync(pool, userId);
  await new Promise(r => setTimeout(r, 400));

  const final = await pool.query(
    'SELECT aqi_score, aqi_tier, aqi_trajectory, content_depth_score, professional_hours_ratio, total_attended FROM user_aqi_signals WHERE user_id=$1',
    [userId],
  );
  console.log('FINAL AQI:', JSON.stringify(final.rows[0], null, 2));
  await pool.end();
}

test().catch(e => { console.error(e.message, e.stack); pool.end(); });
