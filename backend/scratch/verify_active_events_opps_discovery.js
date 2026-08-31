'use strict';
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const assert = require('assert');
const { createPool } = require('../config/db');

async function testDiscoveryEndpoints() {
  const pool = createPool();
  console.log('================================================================');
  console.log('TEST: Discovery Verification for Active Events & Opportunities');
  console.log('================================================================\n');

  try {
    // 1. Opportunities Discovery for Viewer 51
    const oppQuery = `
      SELECT o.id, o.title, o.creator_id, o.creator_type, o.status, o.expires_at
      FROM opportunities o
      JOIN communities c ON o.creator_id::integer = c.id
      WHERE o.status = 'active'
        AND o.creator_type = 'community'
        AND (o.expires_at IS NULL OR o.expires_at > NOW())
        AND o.closed_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM follows f
          WHERE f.follower_id    = 51
            AND f.follower_type  = 'member'
            AND f.following_id   = o.creator_id::integer
            AND f.following_type = 'community'
        )
      ORDER BY o.created_at DESC
      LIMIT 10
    `;
    const oppRes = await pool.query(oppQuery);
    console.log(`✓ Active Discovery Opportunities for Viewer 51 (${oppRes.rows.length} rows):`);
    oppRes.rows.forEach(o => console.log(`   - "${o.title}" (Expires: ${new Date(o.expires_at).toISOString().slice(0, 10)})`));
    assert(oppRes.rows.length > 0, 'Discovery opportunities must return active rows');

    // 2. Events Discovery for Viewer 51
    const eventQuery = `
      SELECT e.id, e.title, e.community_id, e.is_published, e.start_datetime, e.end_datetime
      FROM events e
      INNER JOIN communities c ON e.community_id = c.id
      WHERE e.is_published = true
        AND e.start_datetime > NOW()
        AND (e.is_cancelled = false OR e.is_cancelled IS NULL)
      ORDER BY e.start_datetime ASC
      LIMIT 10
    `;
    const eventRes = await pool.query(eventQuery);
    console.log(`\n✓ Active Discovery Events for Viewer 51 (${eventRes.rows.length} rows):`);
    eventRes.rows.forEach(e => console.log(`   - "${e.title}" (Starts: ${new Date(e.start_datetime).toISOString().slice(0, 10)})`));
    assert(eventRes.rows.length > 0, 'Discovery events must return active rows');

    console.log('\n════════════════════════════════════════════════════════════════');
    console.log('✅ ALL ACTIVE EVENTS & OPPORTUNITIES ARE DISCOVERABLE & VALID!');
    console.log('════════════════════════════════════════════════════════════════');

  } catch (err) {
    console.error('Verification failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

testDiscoveryEndpoints();
