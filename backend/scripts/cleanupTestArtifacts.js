/**
 * cleanupTestArtifacts.js — One-time cleanup of pre-fix data artifacts
 *
 * 1. Normalise registration 15 (member 52, event 32):
 *    attendance_status was left NULL despite registration_status = 'attended'
 *    The migration normalised all 'attended' → 'qr_checked_in' but this row
 *    was inserted after the migration ran.
 *
 * 2. Remove the bogus paid_event_attended signal for user 52:
 *    This was emitted directly at RSVP time (pre-fix, May 24).
 *    User 52's AQI row will be recalculated after removal.
 */
'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { createPool } = require('../config/db');
const { recalculateAqiAsync } = require('../utils/signalEmitter');
const p = createPool();

async function run() {
  // Fix 1: Normalise NULL attendance_status
  const fix1 = await p.query(`
    UPDATE event_registrations
    SET attendance_status = CASE
      WHEN registration_status = 'attended'  THEN 'qr_checked_in'
      WHEN registration_status = 'confirmed' THEN 'registered'
      WHEN registration_status = 'cancelled' THEN 'cancelled'
      ELSE 'registered'
    END
    WHERE attendance_status IS NULL
    RETURNING id, member_id, registration_status, attendance_status
  `);
  console.log('Fixed NULL attendance_status rows:');
  fix1.rows.forEach(r =>
    console.log(`  reg ${r.id} → attendance_status = ${r.attendance_status}`)
  );

  // Fix 2: Remove the pre-fix bogus paid_event_attended signal for user 52
  // This signal was emitted before the webhook-only RSVP fix (created_at = May 24)
  const fix2 = await p.query(`
    DELETE FROM user_behavior_events
    WHERE user_id = 52
      AND event_type = 'paid_event_attended'
      AND created_at < '2026-05-27'
    RETURNING id, event_type, created_at
  `);
  console.log(`\nRemoved ${fix2.rows.length} bogus paid_event_attended signal(s) for user 52`);

  // Fix 3: Recalculate AQI for user 52 after signal removal
  if (fix2.rows.length > 0) {
    console.log('Recalculating AQI for user 52...');
    await recalculateAqiAsync(p, 52);
    await new Promise(r => setTimeout(r, 500));
    const result = await p.query(
      'SELECT aqi_score, aqi_tier FROM user_aqi_signals WHERE user_id = 52'
    );
    console.log('User 52 AQI after fix:', result.rows[0]);
  }

  console.log('\nDone.');
  await p.end();
}

run().catch(e => { console.error(e.message); p.end(); process.exit(1); });
