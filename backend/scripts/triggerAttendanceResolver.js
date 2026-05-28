/**
 * triggerAttendanceResolver.js — Manually trigger post-event attendance resolution
 *
 * Usage:
 *   node scripts/triggerAttendanceResolver.js             → runs all recently ended events
 *   node scripts/triggerAttendanceResolver.js --event=42  → runs for a specific event ID
 *
 * "Recently ended" = end_datetime between 1h and 72h ago with unresolved registrations.
 * Use --event to force-run on any past event regardless of its end time.
 */
'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { createPool } = require('../config/db');
const { resolvePostEventAttendance } = require('../utils/postEventAttendanceResolver');
const p = createPool();

async function run() {
  const args = process.argv.slice(2);
  const eventArg = args.find(a => a.startsWith('--event='));
  const specificEventId = eventArg ? parseInt(eventArg.split('=')[1]) : null;

  if (specificEventId) {
    // ── Single event mode ──────────────────────────────────────────────────────
    console.log(`[ManualResolver] Running for event ${specificEventId}...`);

    // Verify event exists and has ended
    const eventCheck = await p.query(
      `SELECT id, title, start_datetime,
              COALESCE(end_datetime, start_datetime + INTERVAL '2 hours') AS effective_end
       FROM events WHERE id = $1`,
      [specificEventId]
    );
    if (eventCheck.rows.length === 0) {
      console.error(`Event ${specificEventId} not found.`);
      await p.end();
      process.exit(1);
    }
    const event = eventCheck.rows[0];
    const endTime = new Date(event.effective_end);
    const isEnded = endTime < new Date();
    console.log(`Event: "${event.title}"`);
    console.log(`Effective end: ${event.effective_end}`);
    if (!isEnded) {
      console.warn(`⚠  Event has not ended yet (ends ${event.effective_end}). Proceeding anyway...`);
    }

    // Show unresolved registrations
    const unresolved = await p.query(
      `SELECT COUNT(*) AS cnt FROM event_registrations
       WHERE event_id = $1 AND attendance_status = 'registered'`,
      [specificEventId]
    );
    console.log(`Unresolved registrations: ${unresolved.rows[0].cnt}`);

    await resolvePostEventAttendance(p, specificEventId);
    console.log(`\n✅ Done.`);

  } else {
    // ── Auto mode: all events ended in the last 72h with unresolved registrations ──
    console.log('[ManualResolver] Scanning for recently ended events with unresolved registrations...\n');

    const recentlyEnded = await p.query(`
      SELECT DISTINCT e.id, e.title,
             COALESCE(e.end_datetime, e.start_datetime + INTERVAL '2 hours') AS effective_end
      FROM events e
      WHERE COALESCE(e.end_datetime, e.start_datetime + INTERVAL '2 hours')
            BETWEEN NOW() - INTERVAL '72 hours' AND NOW() - INTERVAL '1 hour'
        AND EXISTS (
          SELECT 1 FROM event_registrations er
          WHERE er.event_id = e.id
            AND er.attendance_status = 'registered'
          LIMIT 1
        )
      ORDER BY effective_end DESC
    `);

    if (recentlyEnded.rows.length === 0) {
      console.log('No events found with unresolved registrations in the last 72 hours.');
      await p.end();
      return;
    }

    console.log(`Found ${recentlyEnded.rows.length} event(s):\n`);
    recentlyEnded.rows.forEach(e => {
      console.log(`  Event ${e.id}: "${e.title}" (ended ${e.effective_end})`);
    });
    console.log('');

    let resolved = 0;
    let errors = 0;
    for (const row of recentlyEnded.rows) {
      try {
        await resolvePostEventAttendance(p, row.id);
        resolved++;
      } catch (err) {
        console.error(`  ✗ Event ${row.id} failed: ${err.message}`);
        errors++;
      }
    }

    console.log(`\n✅ Resolved: ${resolved} event(s)${errors > 0 ? `, ⚠ Errors: ${errors}` : ''}`);
  }

  // Show final state of any registrations modified in the last 5 minutes
  const recentlyResolved = await p.query(`
    SELECT er.id, er.member_id, er.event_id, er.attendance_status,
           er.attendance_inference_reason, er.attendance_resolved_at
    FROM event_registrations er
    WHERE er.attendance_resolved_at >= NOW() - INTERVAL '5 minutes'
    ORDER BY er.attendance_resolved_at DESC
  `);

  if (recentlyResolved.rows.length > 0) {
    console.log('\n── Recently resolved registrations ──');
    recentlyResolved.rows.forEach(r => {
      console.log(`  reg ${r.id} | user ${r.member_id} | event ${r.event_id} | ${r.attendance_status} | reason: ${r.attendance_inference_reason}`);
    });
  }

  await p.end();
}

run().catch(e => { console.error(e.message); p.end(); process.exit(1); });
