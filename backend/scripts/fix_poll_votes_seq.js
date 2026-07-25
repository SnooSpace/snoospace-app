/**
 * fix_poll_votes_seq.js
 * Resets the poll_votes_id_seq to be consistent with the actual max id in the table.
 * Run once to fix the "duplicate key value violates unique constraint poll_votes_pkey" error.
 */

require('dotenv').config();
const { createPool } = require('../config/db');

const pool = createPool();

async function fixSequence() {
  try {
    // Get current max id
    const maxResult = await pool.query('SELECT MAX(id) AS max_id FROM poll_votes');
    const maxId = maxResult.rows[0].max_id || 0;
    console.log(`[fix_poll_votes_seq] Current MAX(id) in poll_votes: ${maxId}`);

    // Reset sequence to max id (next val will be maxId + 1)
    const seqResult = await pool.query(
      `SELECT setval('public.poll_votes_id_seq', $1, true)`,
      [maxId]
    );
    console.log(`[fix_poll_votes_seq] Sequence reset to: ${seqResult.rows[0].setval}`);
    console.log(`[fix_poll_votes_seq] ✅ Done. Next INSERT will use id ${maxId + 1}`);
  } catch (err) {
    console.error('[fix_poll_votes_seq] Error:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

fixSequence();
