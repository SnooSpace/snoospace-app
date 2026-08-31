'use strict';
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { createPool } = require('../config/db');

async function checkEventsAndOppsStatus() {
  const pool = createPool();
  console.log('================================================================');
  console.log('AUDIT: Events & Opportunities Status Check');
  console.log('================================================================\n');

  try {
    const nowRes = await pool.query('SELECT NOW() as current_db_time');
    console.log(`Current DB Timestamp (NOW()): ${nowRes.rows[0].current_db_time}\n`);

    // 1. Opportunities Check
    const opps = await pool.query(`
      SELECT 
        id, 
        title, 
        creator_type, 
        creator_id, 
        status, 
        expires_at, 
        closed_at, 
        created_at,
        (expires_at < NOW()) as is_expired,
        (closed_at < NOW()) as is_closed_past
      FROM opportunities
      ORDER BY id
    `);
    console.log(`════ 1. Opportunities in Database (${opps.rows.length} total) ════`);
    if (opps.rows.length === 0) {
      console.log('  (No opportunities exist in the database — all were purged during synthetic data cleanup)');
    } else {
      opps.rows.forEach(r => {
        console.log(`  [Opp ID ${r.id}] "${r.title}": status=${r.status} | expires_at=${r.expires_at} (is_expired=${r.is_expired}) | closed_at=${r.closed_at} (is_closed_past=${r.is_closed_past})`);
      });
    }

    // 2. Events Check
    const events = await pool.query(`
      SELECT 
        id, 
        title, 
        community_id, 
        status, 
        is_past,
        start_datetime, 
        end_datetime, 
        event_date,
        created_at,
        (end_datetime < NOW() OR (end_datetime IS NULL AND event_date < CURRENT_DATE)) as is_ended,
        (start_datetime < NOW() OR (start_datetime IS NULL AND event_date < CURRENT_DATE)) as is_started
      FROM events
      ORDER BY id
    `);
    console.log(`\n════ 2. Events in Database (${events.rows.length} total) ════`);
    if (events.rows.length === 0) {
      console.log('  (No events exist in the database — all were purged during synthetic data cleanup)');
    } else {
      events.rows.forEach(r => {
        console.log(`  [Event ID ${r.id}] "${r.title}": status=${r.status} | is_past=${r.is_past} | start=${r.start_datetime || r.event_date} (is_started=${r.is_started}) | end=${r.end_datetime} (is_ended=${r.is_ended})`);
      });
    }

    // 3. Check seed scripts to see how synthetic events & opps were originally defined
    console.log(`\n════ 3. Synthetic Seed Scripts Status Check ════`);
    const seedCheck = await pool.query(`
      SELECT COUNT(*) as synthetic_post_count 
      FROM posts 
      WHERE caption LIKE '%SNOOSPACE_SYNTHETIC_FEED_V1%'
    `);
    console.log(`  Synthetic posts marked with SNOOSPACE_SYNTHETIC_FEED_V1: ${seedCheck.rows[0].synthetic_post_count}`);

  } catch (err) {
    console.error('Audit failed:', err);
  } finally {
    await pool.end();
  }
}

checkEventsAndOppsStatus();
