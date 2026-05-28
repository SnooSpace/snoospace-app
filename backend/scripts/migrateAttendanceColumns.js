/**
 * Migration: Part 1 attendance resolution + no-show tracking columns
 *
 * attendance_status already exists on event_registrations (used by scheduler),
 * so we only add the two new columns + index.
 * The user_aqi_signals additions are new.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { createPool } = require('../config/db');
const p = createPool();

async function run() {
  const client = await p.connect();
  try {
    await client.query('BEGIN');

    // --- event_registrations ---
    await client.query(`
      ALTER TABLE event_registrations
        ADD COLUMN IF NOT EXISTS attendance_resolved_at    TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS attendance_inference_reason TEXT
    `);
    console.log('✓ Added attendance_resolved_at, attendance_inference_reason to event_registrations');

    // Index for the hourly post-event resolution job
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_registrations_unresolved
        ON event_registrations(attendance_status, attendance_resolved_at)
        WHERE attendance_status = 'registered'
    `);
    console.log('✓ Created idx_registrations_unresolved');

    // --- user_aqi_signals ---
    await client.query(`
      ALTER TABLE user_aqi_signals
        ADD COLUMN IF NOT EXISTS consecutive_paid_no_shows INT DEFAULT 0,
        ADD COLUMN IF NOT EXISTS total_paid_no_shows       INT DEFAULT 0
    `);
    console.log('✓ Added consecutive_paid_no_shows, total_paid_no_shows to user_aqi_signals');

    // Backfill attendance_status for existing QR-confirmed records
    // The QR checkin signal exists in user_behavior_events; use that as proxy
    await client.query(`
      UPDATE event_registrations er
      SET attendance_status = 'confirmed_attended',
          attendance_resolved_at = NOW()
      WHERE er.attendance_status = 'registered'
        AND EXISTS (
          SELECT 1 FROM user_behavior_events ube
          WHERE ube.user_id = er.member_id
            AND ube.event_type = 'qr_checkin'
            AND (ube.metadata->>'event_id')::int = er.event_id
        )
    `);
    console.log('✓ Backfilled confirmed_attended for existing QR check-in records');

    await client.query('COMMIT');
    console.log('\n✅ Migration complete');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err.message);
  } finally {
    client.release();
    await p.end();
  }
}
run();
