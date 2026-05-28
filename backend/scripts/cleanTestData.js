require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { createPool } = require('../config/db');
const { recalculateAqiAsync } = require('../utils/signalEmitter');
const p = createPool();

async function run() {
  // Restore rsvp/attended counts to real values from event_registrations (backfill)
  await p.query(`
    UPDATE user_aqi_signals s SET
      total_rsvps          = sub.rsvp_count,
      total_attended       = sub.attended_count,
      rsvp_to_attend_ratio = CASE WHEN sub.rsvp_count > 0
        THEN sub.attended_count::float / sub.rsvp_count ELSE 0 END
    FROM (
      SELECT member_id AS user_id,
        COUNT(*) AS rsvp_count,
        SUM(CASE WHEN registration_status IN ('attended','registered') THEN 1 ELSE 0 END) AS attended_count
      FROM event_registrations GROUP BY member_id
    ) sub
    WHERE s.user_id = sub.user_id
  `);
  console.log('✓ RSVP/attended counts restored from event_registrations');

  // Also delete the 7 fake behavior events we injected during testing
  // (3x qr_checkin, 1x poll_vote, 1x content_watched_long × 2 test runs, plus qr_checkin extras)
  // Since we don't have a test-run marker, delete ALL qr_checkin events for user 51
  // (they have 0 real QR scans — only 1 registration which was registered status)
  const del = await p.query(`
    DELETE FROM user_behavior_events
    WHERE user_id = 51
      AND event_type = 'qr_checkin'
  `);
  console.log('✓ Removed', del.rowCount, 'fake qr_checkin events from user 51');

  // Reset total_behavior_events to match actual clean event count
  await p.query(`
    UPDATE user_aqi_signals SET
      total_behavior_events = (
        SELECT COUNT(*) FROM user_behavior_events WHERE user_id = 51
      ),
      onboarding_weight = GREATEST(0.02, 0.90 * EXP(-0.008 * (
        SELECT COUNT(*) FROM user_behavior_events WHERE user_id = 51
      ))),
      behavior_weight = 1.0 - GREATEST(0.02, 0.90 * EXP(-0.008 * (
        SELECT COUNT(*) FROM user_behavior_events WHERE user_id = 51
      )))
    WHERE user_id = 51
  `);
  console.log('✓ total_behavior_events resynced');

  // Force AQI recalculation to get fresh score + reset trajectory
  await recalculateAqiAsync(p, 51);
  await new Promise(r => setTimeout(r, 500));

  // Reset snapshot to current score so trajectory starts clean
  await p.query(`
    UPDATE user_aqi_signals
    SET aqi_score_4w_ago = aqi_score
    WHERE user_id = 51
  `);
  console.log('✓ Snapshot reset to current score');

  const result = await p.query(
    `SELECT aqi_score, aqi_tier, aqi_trajectory, aqi_score_4w_ago,
            total_rsvps, total_attended, rsvp_to_attend_ratio, content_depth_score,
            total_behavior_events
     FROM user_aqi_signals WHERE user_id = 51`
  );
  console.log('\nFinal clean state for user 51:', JSON.stringify(result.rows[0], null, 2));
  await p.end();
}
run().catch(e => { console.error(e.message); p.end(); });
