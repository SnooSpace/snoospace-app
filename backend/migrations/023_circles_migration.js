/**
 * Migration 023: Circles — Data Migration
 *
 * One-time script to migrate existing member↔member follows:
 *  - Mutual pairs (A→B AND B→A) → insert into circles
 *  - One-way pairs               → discard (delete from follows)
 *
 * After migration, all member↔member rows are removed from follows.
 * Member→Community/Sponsor/Venue rows are left completely untouched.
 *
 * Run: node backend/migrations/023_circles_migration.js
 */

'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { createPool } = require('../config/db');

async function run() {
  const pool = createPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('[Migration 023] Starting circles data migration...');

    // ------------------------------------------------------------------
    // 1. Fetch all member↔member follow pairs
    // ------------------------------------------------------------------
    const { rows: allFollows } = await client.query(`
      SELECT follower_id, following_id, created_at
      FROM follows
      WHERE follower_type = 'member'
        AND following_type = 'member'
      ORDER BY created_at ASC
    `);

    console.log(`[Migration 023] Found ${allFollows.length} member↔member follow rows`);

    // Build a quick lookup set: "A→B"
    const followSet = new Set(allFollows.map(r => `${r.follower_id}:${r.following_id}`));

    let mutualCount = 0;
    let discardedCount = 0;
    const processedPairs = new Set();

    for (const row of allFollows) {
      const { follower_id: a, following_id: b, created_at: createdA } = row;

      // Canonical pair key (smaller UUID first) — prevents double-processing
      const pairKey = a < b ? `${a}:${b}` : `${b}:${a}`;
      if (processedPairs.has(pairKey)) continue;
      processedPairs.add(pairKey);

      const isMutual = followSet.has(`${b}:${a}`);

      if (isMutual) {
        // Get the other direction's created_at to find the earlier timestamp
        const reverseRow = allFollows.find(r => r.follower_id === b && r.following_id === a);
        const createdB = reverseRow?.created_at || createdA;
        const earlierDate = createdA <= createdB ? createdA : createdB;

        // Sort IDs so user_a_id < user_b_id (required by CHECK constraint)
        const [userA, userB] = a < b ? [a, b] : [b, a];

        await client.query(`
          INSERT INTO circles (user_a_id, user_b_id, created_at)
          VALUES ($1, $2, $3)
          ON CONFLICT (user_a_id, user_b_id) DO NOTHING
        `, [userA, userB, earlierDate]);

        mutualCount++;
      } else {
        discardedCount++;
      }
    }

    // ------------------------------------------------------------------
    // 2. Backfill circle_count from the newly inserted circles rows
    // ------------------------------------------------------------------
    console.log('[Migration 023] Backfilling circle_count on members...');
    await client.query(`
      UPDATE members m
      SET circle_count = (
        SELECT COUNT(*)
        FROM circles c
        WHERE c.user_a_id = m.id OR c.user_b_id = m.id
      )
    `);

    // ------------------------------------------------------------------
    // 3. Delete all member↔member rows from follows
    //    (leave member→community/sponsor/venue rows untouched)
    // ------------------------------------------------------------------
    const deleteResult = await client.query(`
      DELETE FROM follows
      WHERE follower_type = 'member'
        AND following_type = 'member'
    `);

    await client.query('COMMIT');

    console.log('[Migration 023] ✅ Migration complete.');
    console.log(`  → Mutual pairs converted to circles: ${mutualCount}`);
    console.log(`  → One-way pairs discarded:           ${discardedCount}`);
    console.log(`  → Total rows removed from follows:   ${deleteResult.rowCount}`);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Migration 023] ❌ Migration FAILED — rolled back:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
