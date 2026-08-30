'use strict';
/**
 * Synthetic Data Cleanup Script
 * 
 * Safely removes existing synthetic/test data while preserving real developer accounts.
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { createPool } = require('../config/db');

async function cleanupSyntheticData() {
  const pool = createPool();
  console.log('================================================================');
  console.log('🧹 Starting Synthetic Data Cleanup');
  console.log('================================================================\n');

  try {
    // 1. Identify real members to preserve (e.g. harshiths440@gmail.com, veenas127@gmail.com, nexarc01@gmail.com)
    const preserveEmails = [
      'harshiths440@gmail.com',
      'veenas127@gmail.com',
      'nexarc01@gmail.com'
    ];

    const preserveRes = await pool.query(
      `SELECT id, name, email FROM members WHERE LOWER(email) = ANY($1::text[])`,
      [preserveEmails]
    );

    const preservedMemberIds = preserveRes.rows.map(r => String(r.id));
    console.log(`📌 Preserving ${preservedMemberIds.length} real developer account(s):`, preserveRes.rows.map(r => `${r.name} (${r.email}, ID:${r.id})`).join(', '));

    // Preserve real community: SnooSpace (snoospaceteam@gmail.com, ID 54 if present)
    const commPreserveRes = await pool.query(
      `SELECT id, name, email FROM communities WHERE LOWER(email) = 'snoospaceteam@gmail.com' OR id = 54`
    );
    const preservedCommunityIds = commPreserveRes.rows.map(r => String(r.id));
    console.log(`📌 Preserving ${preservedCommunityIds.length} real community account(s):`, commPreserveRes.rows.map(r => `${r.name} (ID:${r.id})`).join(', '));

    // 2. Delete synthetic members (all loadtest or synthetic test users not in preserve list)
    let deleteMembersQuery = `
      DELETE FROM members 
      WHERE (is_load_test = true 
         OR email LIKE 'loadtest_%' 
         OR email LIKE 'dummy.beta%' 
         OR email LIKE '%@snoospace-test.internal'
         OR email LIKE 'member_%@snoospace.dev'
         OR name LIKE 'Dummy Beta%'
         OR name LIKE 'Test User%')
    `;
    if (preservedMemberIds.length > 0) {
      deleteMembersQuery += ` AND id NOT IN (${preservedMemberIds.join(',')})`;
    }
    const deletedMembers = await pool.query(deleteMembersQuery);
    console.log(`🗑️ Deleted ${deletedMembers.rowCount} synthetic member rows.`);

    // 3. Delete synthetic communities (except preserved community IDs)
    let deleteCommsQuery = `
      DELETE FROM communities 
      WHERE (name LIKE 'Test Community%' 
         OR email LIKE 'community_%@snoospace.dev'
         OR email IS NULL)
    `;
    if (preservedCommunityIds.length > 0) {
      deleteCommsQuery += ` AND id NOT IN (${preservedCommunityIds.join(',')})`;
    }
    const deletedComms = await pool.query(deleteCommsQuery);
    console.log(`🗑️ Deleted ${deletedComms.rowCount} synthetic community rows.`);

    // 4. Delete synthetic events
    let deleteEventsQuery = `DELETE FROM events WHERE title LIKE 'Test %' OR title LIKE 'Suspicious %' OR description LIKE 'Synthetic %' OR description LIKE '%load test%'`;
    if (preservedCommunityIds.length > 0) {
      deleteEventsQuery += ` OR community_id NOT IN (${preservedCommunityIds.join(',')})`;
    }
    const deletedEvents = await pool.query(deleteEventsQuery);
    console.log(`🗑️ Deleted ${deletedEvents.rowCount} synthetic event rows.`);

    // 5. Delete synthetic opportunities
    const deletedOpps = await pool.query(`DELETE FROM opportunities`);
    console.log(`🗑️ Deleted ${deletedOpps.rowCount} synthetic opportunity rows.`);

    // 6. Delete synthetic posts (is_load_test = true or synthetic created)
    let deletePostsQuery = `DELETE FROM posts WHERE is_load_test = true OR caption LIKE 'Synthetic %' OR caption LIKE 'Load test %'`;
    if (preservedMemberIds.length > 0 || preservedCommunityIds.length > 0) {
      const allowedAuthors = [];
      if (preservedMemberIds.length > 0) {
        allowedAuthors.push(`(author_type = 'member' AND author_id IN (${preservedMemberIds.join(',')}))`);
      }
      if (preservedCommunityIds.length > 0) {
        allowedAuthors.push(`(author_type = 'community' AND author_id IN (${preservedCommunityIds.join(',')}))`);
      }
      deletePostsQuery += ` OR NOT (${allowedAuthors.join(' OR ')})`;
    }
    const deletedPosts = await pool.query(deletePostsQuery);
    console.log(`🗑️ Deleted ${deletedPosts.rowCount} synthetic post rows.`);

    // 7. Clean up orphan engagement and follow records
    await pool.query(`DELETE FROM poll_votes WHERE voter_id NOT IN (${preservedMemberIds.join(',')})`);
    await pool.query(`DELETE FROM prompt_submissions WHERE author_id NOT IN (${preservedMemberIds.join(',')})`);
    await pool.query(`DELETE FROM challenge_participations WHERE participant_id NOT IN (${preservedMemberIds.join(',')})`);
    await pool.query(`DELETE FROM open_plans`);
    await pool.query(`DELETE FROM follows WHERE follower_id NOT IN (${preservedMemberIds.join(',')}) OR following_id NOT IN (${preservedMemberIds.join(',')}, ${preservedCommunityIds.join(',')})`);
    await pool.query(`DELETE FROM post_likes`);
    await pool.query(`DELETE FROM post_comments`);
    await pool.query(`DELETE FROM post_shares`);
    await pool.query(`DELETE FROM post_saves`);
    await pool.query(`DELETE FROM event_registrations`);
    await pool.query(`DELETE FROM opportunity_applications`);

    console.log('\n✅ Cleanup complete! Synthetic data purged cleanly.\n');
  } catch (err) {
    console.error('❌ Error during cleanup:', err);
    throw err;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  cleanupSyntheticData();
}

module.exports = { cleanupSyntheticData };
