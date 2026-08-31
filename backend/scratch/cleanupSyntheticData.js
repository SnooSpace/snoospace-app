'use strict';
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { createPool } = require('../config/db');

async function cleanupSyntheticData() {
  const pool = createPool();
  console.log('================================================================');
  console.log('🧹 Executing Synthetic Data Cleanup');
  console.log('================================================================\n');

  try {
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

    const commPreserveRes = await pool.query(
      `SELECT id, name, email FROM communities WHERE LOWER(email) = 'snoospaceteam@gmail.com' OR id = 54`
    );
    const preservedCommunityIds = commPreserveRes.rows.map(r => String(r.id));
    console.log(`📌 Preserving ${preservedCommunityIds.length} real community account(s):`, commPreserveRes.rows.map(r => `${r.name} (ID:${r.id})`).join(', '));

    const allowedAuthors = [];
    if (preservedMemberIds.length > 0) {
      allowedAuthors.push(`(author_type = 'member' AND author_id IN (${preservedMemberIds.join(',')}))`);
    }
    if (preservedCommunityIds.length > 0) {
      allowedAuthors.push(`(author_type = 'community' AND author_id IN (${preservedCommunityIds.join(',')}))`);
    }

    // 1. Delete engagements on synthetic posts or by synthetic members
    await pool.query(`
      DELETE FROM post_likes 
      WHERE liker_id NOT IN (${preservedMemberIds.join(',')})
         OR post_id IN (SELECT id FROM posts WHERE NOT (${allowedAuthors.join(' OR ')}))
    `);
    await pool.query(`
      DELETE FROM post_comments 
      WHERE commenter_id NOT IN (${preservedMemberIds.join(',')})
         OR post_id IN (SELECT id FROM posts WHERE NOT (${allowedAuthors.join(' OR ')}))
    `);
    await pool.query(`
      DELETE FROM post_shares 
      WHERE sharer_id NOT IN (${preservedMemberIds.join(',')})
         OR post_id IN (SELECT id FROM posts WHERE NOT (${allowedAuthors.join(' OR ')}))
    `);
    await pool.query(`
      DELETE FROM post_saves 
      WHERE saver_id NOT IN (${preservedMemberIds.join(',')})
         OR post_id IN (SELECT id FROM posts WHERE NOT (${allowedAuthors.join(' OR ')}))
    `);
    await pool.query(`
      DELETE FROM post_impression_state 
      WHERE user_id NOT IN (${preservedMemberIds.join(',')})
         OR post_id IN (SELECT id FROM posts WHERE NOT (${allowedAuthors.join(' OR ')}))
    `);
    await pool.query(`
      DELETE FROM event_impression_state 
      WHERE user_id NOT IN (${preservedMemberIds.join(',')})
    `);
    await pool.query(`
      DELETE FROM poll_votes 
      WHERE voter_id NOT IN (${preservedMemberIds.join(',')})
         OR post_id IN (SELECT id FROM posts WHERE NOT (${allowedAuthors.join(' OR ')}))
    `);
    await pool.query(`
      DELETE FROM prompt_submissions 
      WHERE author_id NOT IN (${preservedMemberIds.join(',')})
         OR post_id IN (SELECT id FROM posts WHERE NOT (${allowedAuthors.join(' OR ')}))
    `);
    await pool.query(`
      DELETE FROM challenge_participations 
      WHERE participant_id NOT IN (${preservedMemberIds.join(',')})
         OR post_id IN (SELECT id FROM posts WHERE NOT (${allowedAuthors.join(' OR ')}))
    `);

    // 2. Delete synthetic plans, events, opportunities
    await pool.query(`DELETE FROM open_plan_visible_communities`);
    await pool.query(`DELETE FROM open_plan_requests`);
    await pool.query(`DELETE FROM open_plan_likes`);
    await pool.query(`DELETE FROM open_plan_comments`);
    await pool.query(`DELETE FROM open_plan_views`);
    await pool.query(`DELETE FROM open_plan_interests`);
    await pool.query(`DELETE FROM open_plan_reviews`);
    await pool.query(`DELETE FROM open_plan_interaction_selections`);
    await pool.query(`DELETE FROM open_plan_attendee_ratings`);
    await pool.query(`DELETE FROM open_plans`);

    const delOpps = await pool.query(`DELETE FROM opportunities`);
    console.log(`🗑️ Deleted ${delOpps.rowCount} synthetic opportunity rows.`);

    const delEvents = await pool.query(`DELETE FROM events`);
    console.log(`🗑️ Deleted ${delEvents.rowCount} synthetic event rows.`);

    // 3. Delete synthetic posts
    const delPosts = await pool.query(`DELETE FROM posts WHERE NOT (${allowedAuthors.join(' OR ')})`);
    console.log(`🗑️ Deleted ${delPosts.rowCount} synthetic post rows.`);

    // 4. Clean up all FK tables referencing synthetic members
    const syntheticMemberFilter = `NOT IN (${preservedMemberIds.join(',')})`;
    const tablesToClean = [
      'razorpay_payments', 'member_photos', 'member_location_history',
      'member_profile_change_log', 'aqi_sessions', 'aqi_session_stats',
      'spotify_connections', 'spotify_top_artists', 'user_sparks',
      'user_privacy_consent', 'user_privacy_consent_audit', 'data_deletion_requests',
      'profile_views', 'connection_requests', 'video_watch_events',
      'video_follow_conversions', 'user_verifications', 'event_verifications',
      'circle_requests', 'circles', 'creator_profiles', 'creator_follows',
      'community_member_circle_invites', 'community_member_circles',
      'event_reviews', 'user_reputation_scores', 'reputation_pair_history',
      'user_trust_flags', 'review_prompts_queue', 'spotify_profile',
      'recommended_matches', 'dismissed_recommendations', 'community_hosts',
      'community_host_audit_log', 'ticket_gifts', 'event_interests',
      'event_registrations', 'ticket_reservations', 'invite_requests',
      'event_swipes', 'event_matches', 'next_event_requests', 'community_heads'
    ];

    for (const tbl of tablesToClean) {
      try {
        // Query columns for this table
        const cols = await pool.query(
          `SELECT column_name FROM information_schema.columns WHERE table_name = $1`,
          [tbl]
        );
        const colNames = cols.rows.map(r => r.column_name);
        const userCols = colNames.filter(c => 
          c.includes('user_id') || c.includes('member_id') || c.includes('follower_id') || 
          c.includes('creator_id') || c.includes('participant_id') || c.includes('blocker_id') ||
          c.includes('blocked_id') || c.includes('rater_id') || c.includes('ratee_id') ||
          c.includes('viewed_member_id') || c.includes('viewer_member_id') ||
          c.includes('from_member_id') || c.includes('to_member_id') || c.includes('people_id') ||
          c.includes('swiper_id') || c.includes('swiped_id') || c.includes('member1_id') ||
          c.includes('member2_id') || c.includes('requester_id') || c.includes('requested_id') ||
          c.includes('sender_id') || c.includes('receiver_id') || c.includes('candidate_id') ||
          c.includes('actor_user_id') || c.includes('target_user_id') || c.includes('recipient_id')
        );
        for (const uCol of userCols) {
          await pool.query(`DELETE FROM ${tbl} WHERE ${uCol} ${syntheticMemberFilter}`);
        }
      } catch (err) {
        // Ignore if table doesn't exist
      }
    }

    // 5. Delete synthetic follows & blocks
    await pool.query(`
      DELETE FROM follows 
      WHERE follower_id NOT IN (${preservedMemberIds.join(',')})
         OR following_id NOT IN (${preservedMemberIds.join(',')}, ${preservedCommunityIds.join(',')})
    `);
    await pool.query(`
      DELETE FROM user_blocks 
      WHERE blocker_id NOT IN (${preservedMemberIds.join(',')})
         OR blocked_id NOT IN (${preservedMemberIds.join(',')})
    `);
    await pool.query(`
      DELETE FROM community_blocks 
      WHERE blocker_id NOT IN (${preservedMemberIds.join(',')})
         OR blocked_community_id NOT IN (${preservedCommunityIds.join(',')})
    `);

    // 6. Delete synthetic communities & members
    const delComms = await pool.query(`DELETE FROM communities WHERE id NOT IN (${preservedCommunityIds.join(',')})`);
    console.log(`🗑️ Deleted ${delComms.rowCount} synthetic community rows.`);

    const delMembers = await pool.query(`DELETE FROM members WHERE id NOT IN (${preservedMemberIds.join(',')})`);
    console.log(`🗑️ Deleted ${delMembers.rowCount} synthetic member rows.`);

    console.log('\n✅ Cleanup complete! All synthetic entities purged safely.\n');
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
