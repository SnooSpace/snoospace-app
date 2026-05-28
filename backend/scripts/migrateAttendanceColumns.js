/**
 * Migration: Attendance Resolution Columns + Historical Backfill
 *
 * Schema changes:
 *   - event_registrations: add attendance_resolved_at, attendance_inference_reason
 *   - user_aqi_signals: add consecutive_paid_no_shows, total_paid_no_shows
 *   - Index for hourly resolution job
 *
 * Data fixes:
 *   1. Normalise NULL attendance_status → 'registered' for all open registrations
 *   2. Backfill confirmed_attended for rows that have checked_in_at timestamp
 *   3. Downgrade bogus paid_event_attended signals (fired at RSVP time before
 *      the real architecture was fully wired) → event_rsvp + correct signal_strength
 *      Only downgrades events where attendance is NOT confirmed (no qr_checkin or
 *      confirmed_attended status) — leaves legitimate post-attendance signals alone.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { createPool } = require('../config/db');
const p = createPool();

async function run() {
  const client = await p.connect();
  try {
    await client.query('BEGIN');

    // ── Schema ────────────────────────────────────────────────────────────────

    await client.query(`
      ALTER TABLE event_registrations
        ADD COLUMN IF NOT EXISTS attendance_resolved_at      TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS attendance_inference_reason TEXT
    `);
    console.log('✓ attendance_resolved_at, attendance_inference_reason added');

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_registrations_unresolved
        ON event_registrations(attendance_status, attendance_resolved_at)
        WHERE attendance_status = 'registered'
    `);
    console.log('✓ idx_registrations_unresolved created');

    await client.query(`
      ALTER TABLE user_aqi_signals
        ADD COLUMN IF NOT EXISTS consecutive_paid_no_shows INT DEFAULT 0,
        ADD COLUMN IF NOT EXISTS total_paid_no_shows       INT DEFAULT 0
    `);
    console.log('✓ consecutive_paid_no_shows, total_paid_no_shows added to user_aqi_signals');

    // ── Data Fix 1: Normalise NULLs ───────────────────────────────────────────
    const norm = await client.query(`
      UPDATE event_registrations
      SET attendance_status = 'registered'
      WHERE attendance_status IS NULL
        AND registration_status = 'registered'
    `);
    console.log(`✓ Normalised ${norm.rowCount} NULL attendance_status → 'registered'`);

    // ── Data Fix 2: Backfill confirmed_attended from checked_in_at ───────────
    const qrBackfill = await client.query(`
      UPDATE event_registrations
      SET attendance_status        = 'confirmed_attended',
          attendance_resolved_at   = checked_in_at
      WHERE checked_in_at IS NOT NULL
        AND attendance_status = 'registered'
    `);
    console.log(`✓ Backfilled ${qrBackfill.rowCount} confirmed_attended from checked_in_at`);

    // ── Data Fix 3: Downgrade bogus paid_event_attended signals ──────────────
    // A paid_event_attended signal is "bogus" (fired at RSVP time) if:
    //   - The corresponding registration has attendance_status = 'registered'
    //     (i.e. the event hasn't happened or no check-in was confirmed)
    //   - There is no razorpay_payments row with status='captured' that would
    //     have gone through the correct webhook path (webhook path correctly
    //     emits event_rsvp, so its signals are clean)
    //
    // We downgrade: event_type → event_rsvp, signal_strength → 1.0
    // We do NOT delete — changing type preserves the timeline record.
    const downgrade = await client.query(`
      UPDATE user_behavior_events ube
      SET event_type      = 'event_rsvp',
          signal_strength = 1.0
      WHERE ube.event_type = 'paid_event_attended'
        AND EXISTS (
          SELECT 1 FROM event_registrations er
          WHERE er.member_id = ube.user_id
            AND er.event_id  = (ube.metadata->>'eventId')::int
            AND er.attendance_status NOT IN ('confirmed_attended','inferred_attended','manually_confirmed')
        )
        AND NOT EXISTS (
          -- If a QR checkin signal exists for the same user+event, it's a real attendance record
          SELECT 1 FROM user_behavior_events qr
          WHERE qr.user_id    = ube.user_id
            AND qr.event_type = 'qr_checkin'
            AND (qr.metadata->>'event_id')::int = (ube.metadata->>'eventId')::int
        )
    `);
    console.log(`✓ Downgraded ${downgrade.rowCount} bogus paid_event_attended → event_rsvp (signal_strength 1.0)`);

    // ── Data Fix 4: Recalculate AQI for affected users ────────────────────────
    // We log which users were affected so the caller can trigger recalc
    const affected = await client.query(`
      SELECT DISTINCT user_id FROM user_behavior_events
      WHERE event_type = 'event_rsvp'
        AND signal_strength = 1.0
        AND occurred_at >= NOW() - INTERVAL '30 days'
    `);
    const affectedIds = affected.rows.map(r => r.user_id);
    console.log(`\n⚠  ${affectedIds.length} user(s) need AQI recalculation: [${affectedIds.join(', ')}]`);
    console.log('   Run: node scripts/recalcAffectedUsers.js after this migration\n');

    await client.query('COMMIT');
    console.log('✅ Migration complete');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err.message);
    throw err;
  } finally {
    client.release();
    await p.end();
  }
}
run();
