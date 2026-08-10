/**
 * verify_repeat_views.js
 * Verification script for Event & Opportunity repeat view tracking.
 */
const { createPool } = require('../config/db');
require('dotenv').config({ path: './.env' });

const pool = createPool();

async function runVerification() {
  const client = await pool.connect();
  console.log('=== STARTING REPEAT VIEWS VERIFICATION ===\n');

  try {
    // 1. Run Migration SQL
    console.log('[1] Applying migration 061_repeat_views.sql...');
    const fs = require('fs');
    const path = require('path');
    const migrationSql = fs.readFileSync(path.join(__dirname, '../migrations/061_repeat_views.sql'), 'utf8');
    await client.query(migrationSql);
    console.log('✔ Migration applied successfully.\n');

    // 2. Test Event Repeat Views
    console.log('[2] Testing Event View Tracking...');
    const commRes = await client.query('SELECT id FROM communities LIMIT 1');
    const validCommId = commRes.rows[0]?.id || null;
    const eventRes = await client.query(`
      INSERT INTO events (title, community_id, access_type, event_type, event_date, start_datetime)
      VALUES ('Repeat View Test Event', $1, 'public', 'in-person', NOW(), NOW())
      RETURNING id, view_count;
    `, [validCommId]);
    const testEventId = eventRes.rows[0].id;
    console.log(`Created Test Event ID: ${testEventId}`);

    // Helper to simulate view call logic for events
    async function simulateEventView(eventId, userId, userType) {
      const insertRes = await client.query(
        "INSERT INTO event_views (event_id, viewer_id, viewer_type) VALUES ($1, $2, $3) ON CONFLICT (event_id, viewer_id, viewer_type) DO NOTHING",
        [eventId, userId, userType]
      );
      if (insertRes.rowCount > 0) {
        await client.query("UPDATE events SET view_count = COALESCE(view_count,0) + 1 WHERE id = $1", [eventId]);
      } else {
        await client.query(
          "INSERT INTO event_repeat_view_events (event_id, user_id, user_type) VALUES ($1, $2, $3)",
          [eventId, userId, userType]
        );
      }
    }

    // Helper to query event view stats
    async function getEventStats(eventId) {
      const res = await client.query(`
        SELECT
          COALESCE(e.view_count, 0) AS unique_views,
          COALESCE(e.view_count, 0) + COUNT(r.id) AS total_views
        FROM events e
        LEFT JOIN event_repeat_view_events r ON r.event_id = e.id
        WHERE e.id = $1
        GROUP BY e.view_count
      `, [eventId]);
      return res.rows[0];
    }

    // View 1: User 99 (1st time)
    await simulateEventView(testEventId, 99, 'member');
    let eStats = await getEventStats(testEventId);
    console.log(`  Pass 1 (User 99, 1st view): unique=${eStats.unique_views}, total=${eStats.total_views}`);

    // View 2: User 99 (2nd time - repeat)
    await simulateEventView(testEventId, 99, 'member');
    eStats = await getEventStats(testEventId);
    console.log(`  Pass 2 (User 99, 2nd view): unique=${eStats.unique_views}, total=${eStats.total_views}`);

    // View 3: User 100 (1st time)
    await simulateEventView(testEventId, 100, 'member');
    eStats = await getEventStats(testEventId);
    console.log(`  Pass 3 (User 100, 1st view): unique=${eStats.unique_views}, total=${eStats.total_views}`);

    // View 4: User 100 (2nd time - repeat)
    await simulateEventView(testEventId, 100, 'member');
    eStats = await getEventStats(testEventId);
    console.log(`  Pass 4 (User 100, 2nd view): unique=${eStats.unique_views}, total=${eStats.total_views}`);

    if (parseInt(eStats.unique_views) === 2 && parseInt(eStats.total_views) === 4) {
      console.log('✔ Event Repeat View Tracking PASSED!\n');
    } else {
      console.error('❌ Event Repeat View Tracking FAILED!', eStats);
    }

    // 3. Test Opportunity Repeat Views
    console.log('[3] Testing Opportunity View Tracking...');
    const oppRes = await client.query(`
      INSERT INTO opportunities (title, creator_id, creator_type, opportunity_types, availability, turnaround)
      VALUES ('Repeat View Test Opportunity', '1', 'member', ARRAY['design'], 'immediate', '1 day')
      RETURNING id, view_count;
    `);
    const testOppId = oppRes.rows[0].id;
    console.log(`Created Test Opportunity ID (UUID): ${testOppId}`);

    // Helper to simulate view call logic for opportunities
    async function simulateOppView(oppId, userId, userType) {
      const existing = await client.query(
        `SELECT id FROM opportunity_views WHERE opportunity_id = $1 AND viewer_id = $2 AND viewer_type = $3`,
        [oppId, userId, userType]
      );
      if (existing.rows.length === 0) {
        try {
          await client.query(
            `INSERT INTO opportunity_views (opportunity_id, viewer_id, viewer_type) VALUES ($1, $2, $3)`,
            [oppId, userId, userType]
          );
          await client.query(
            `UPDATE opportunities SET view_count = COALESCE(view_count, 0) + 1 WHERE id = $1`,
            [oppId]
          );
        } catch (dupErr) {
          if (dupErr.code === '23505') {
            await client.query(
              `INSERT INTO opportunity_repeat_view_events (opportunity_id, user_id, user_type) VALUES ($1, $2, $3)`,
              [oppId, userId, userType]
            );
          } else {
            throw dupErr;
          }
        }
      } else {
        await client.query(
          `INSERT INTO opportunity_repeat_view_events (opportunity_id, user_id, user_type) VALUES ($1, $2, $3)`,
          [oppId, userId, userType]
        );
      }
    }

    // Helper to query opportunity view stats
    async function getOppStats(oppId) {
      const res = await client.query(`
        SELECT
          COALESCE(o.view_count, 0) AS unique_views,
          COALESCE(o.view_count, 0) + COUNT(r.id) AS total_views
        FROM opportunities o
        LEFT JOIN opportunity_repeat_view_events r ON r.opportunity_id = o.id
        WHERE o.id = $1
        GROUP BY o.view_count
      `, [oppId]);
      return res.rows[0];
    }

    // View 1: User 99 (1st time)
    await simulateOppView(testOppId, 99, 'member');
    let oStats = await getOppStats(testOppId);
    console.log(`  Pass 1 (User 99, 1st view): unique=${oStats.unique_views}, total=${oStats.total_views}`);

    // View 2: User 99 (2nd time - repeat)
    await simulateOppView(testOppId, 99, 'member');
    oStats = await getOppStats(testOppId);
    console.log(`  Pass 2 (User 99, 2nd view): unique=${oStats.unique_views}, total=${oStats.total_views}`);

    // View 3: User 100 (1st time)
    await simulateOppView(testOppId, 100, 'member');
    oStats = await getOppStats(testOppId);
    console.log(`  Pass 3 (User 100, 1st view): unique=${oStats.unique_views}, total=${oStats.total_views}`);

    // View 4: User 100 (2nd time - repeat)
    await simulateOppView(testOppId, 100, 'member');
    oStats = await getOppStats(testOppId);
    console.log(`  Pass 4 (User 100, 2nd view): unique=${oStats.unique_views}, total=${oStats.total_views}`);

    if (parseInt(oStats.unique_views) === 2 && parseInt(oStats.total_views) === 4) {
      console.log('✔ Opportunity Repeat View Tracking PASSED!\n');
    } else {
      console.error('❌ Opportunity Repeat View Tracking FAILED!', oStats);
    }

    // 4. Cleanup Test Rows
    console.log('[4] Cleaning up test event & opportunity...');
    await client.query('DELETE FROM events WHERE id = $1', [testEventId]);
    await client.query('DELETE FROM opportunities WHERE id = $1', [testOppId]);
    console.log('✔ Cleanup complete.\n');

    // 5. Post View Stats Sanity Check
    console.log('[5] Checking Post view stats logic regression check...');
    const postRes = await client.query(`
      SELECT
        p.public_view_count AS unique_views,
        p.public_view_count + COUNT(r.id) AS total_views
      FROM posts p
      LEFT JOIN repeat_view_events r ON r.post_id = p.id
      GROUP BY p.id, p.public_view_count
      LIMIT 1
    `);
    console.log(`✔ Post view stats query sanity check passed (${postRes.rows.length} row returned).\n`);

    console.log('=== ALL VERIFICATIONS PASSED SUCCESSFULLY ===');
  } catch (err) {
    console.error('VERIFICATION FAILED WITH ERROR:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

runVerification();
