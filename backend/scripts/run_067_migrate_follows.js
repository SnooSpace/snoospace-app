/**
 * run_067_migrate_follows.js
 *
 * Executes migration 067: moves member→member rows from the `follows`
 * table into `creator_follows` for all creator-mode member accounts,
 * then reconciles the denormalized follower counts on both sides.
 *
 * Run once: node scripts/run_067_migrate_follows.js
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: '127.0.0.1',
  port: 5432,
  user: 'postgres',
  password: 'postgressql1234',
  database: 'snoospace',
});

async function run() {
  const client = await pool.connect();
  try {
    // ── Pre-flight: show what will be migrated ──────────────────────────────
    console.log('\n[Migration 067] Pre-flight check...');
    const preview = await client.query(`
      SELECT
        f.follower_id,
        fm.name   AS follower_name,
        f.following_id  AS creator_id,
        cm.name   AS creator_name
      FROM follows f
      JOIN members fm ON fm.id = f.follower_id
      JOIN members cm ON cm.id = f.following_id
      WHERE f.follower_type  = 'member'
        AND f.following_type = 'member'
        AND cm.is_creator_mode_enabled = true
        AND f.follower_id != f.following_id
      ORDER BY cm.name, fm.name
    `);

    if (preview.rows.length === 0) {
      console.log('[Migration 067] Nothing to migrate — no orphaned follows found. Exiting.');
      return;
    }

    console.log(`[Migration 067] Found ${preview.rows.length} orphaned follow(s) to migrate:`);
    preview.rows.forEach(r =>
      console.log(`  ${r.follower_name} (id=${r.follower_id}) → ${r.creator_name} (id=${r.creator_id})`)
    );

    // ── Run the SQL migration ───────────────────────────────────────────────
    const sqlPath = path.join(__dirname, '..', 'migrations', '067_migrate_member_follows_to_creator_follows.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('\n[Migration 067] Executing migration SQL...');
    await client.query(sql);
    console.log('[Migration 067] ✅ SQL executed successfully.');

    // ── Post-flight: verify counts ──────────────────────────────────────────
    console.log('\n[Migration 067] Post-migration verification:');
    const verify = await client.query(`
      SELECT
        m.id,
        m.name,
        m.follower_count,
        m.creator_follower_count,
        (SELECT COUNT(*) FROM creator_follows cf
         WHERE cf.creator_id = m.id AND cf.is_dormant = false
           AND cf.is_superseded_by_circle = false) AS live_creator_follows
      FROM members m
      WHERE m.is_creator_mode_enabled = true
      ORDER BY m.name
    `);

    verify.rows.forEach(r => {
      const match = Number(r.creator_follower_count) === Number(r.live_creator_follows) ? '✅' : '⚠️ MISMATCH';
      console.log(
        `  ${r.name} (id=${r.id}) | follower_count=${r.follower_count} | ` +
        `creator_follower_count=${r.creator_follower_count} | live_creator_follows=${r.live_creator_follows} ${match}`
      );
    });

    console.log('\n[Migration 067] Done.\n');
  } catch (err) {
    console.error('[Migration 067] ❌ Error — rolled back:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
