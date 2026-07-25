/**
 * sync_all_poll_counts.js
 * Recalculates and updates type_data (options.vote_count and total_votes)
 * for all poll posts in the database to match actual rows in poll_votes.
 */

require('dotenv').config();
const { createPool } = require('../config/db');

const pool = createPool();

async function syncAllPolls() {
  try {
    const pollsRes = await pool.query("SELECT id, type_data FROM posts WHERE post_type = 'poll'");
    console.log(`[syncAllPolls] Found ${pollsRes.rows.length} poll posts`);

    for (const post of pollsRes.rows) {
      const postId = post.id;
      const typeData = post.type_data || {};

      // Aggregate counts per option from poll_votes
      const optionCountsResult = await pool.query(
        `SELECT option_index, COUNT(*)::int as count
         FROM poll_votes
         WHERE post_id = $1
         GROUP BY option_index`,
        [postId]
      );

      const optionCountsMap = {};
      optionCountsResult.rows.forEach(r => {
        optionCountsMap[r.option_index] = r.count;
      });

      // Aggregate total unique voters from poll_votes
      const totalVotersResult = await pool.query(
        `SELECT COUNT(DISTINCT (voter_id, voter_type))::int as total_voters
         FROM poll_votes
         WHERE post_id = $1`,
        [postId]
      );
      const totalVotes = totalVotersResult.rows[0]?.total_voters || 0;

      // Update option counts in type_data
      const updatedOptions = (typeData.options || []).map(opt => ({
        ...opt,
        vote_count: optionCountsMap[opt.index] || 0,
      }));

      const updatedTypeData = {
        ...typeData,
        options: updatedOptions,
        total_votes: totalVotes,
      };

      await pool.query(
        `UPDATE posts SET type_data = $1 WHERE id = $2`,
        [JSON.stringify(updatedTypeData), postId]
      );

      console.log(`[syncAllPolls] Synced poll ${postId}: total_votes = ${totalVotes}, options =`, JSON.stringify(updatedOptions));
    }

    console.log('[syncAllPolls] ✅ Done syncing all polls.');
  } catch (err) {
    console.error('[syncAllPolls] Error:', err);
  } finally {
    await pool.end();
  }
}

syncAllPolls();
