'use strict';
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { createPool } = require('../config/db');

async function dryRunCleanup() {
  const pool = createPool();
  console.log('================================================================');
  console.log('🔍 DRY RUN: Synthetic Data Cleanup Analysis');
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
    console.log(`📌 Preserving ${preservedMemberIds.length} real developer account(s):`);
    preserveRes.rows.forEach(r => console.log(`   - ${r.name} (${r.email}, ID: ${r.id})`));

    const commPreserveRes = await pool.query(
      `SELECT id, name, email FROM communities WHERE LOWER(email) = 'snoospaceteam@gmail.com' OR id = 54`
    );
    const preservedCommunityIds = commPreserveRes.rows.map(r => String(r.id));
    console.log(`\n📌 Preserving ${preservedCommunityIds.length} real community account(s):`);
    commPreserveRes.rows.forEach(r => console.log(`   - ${r.name} (ID: ${r.id})`));

    // 1. Members to delete
    const membersToDelete = await pool.query(
      `SELECT id, name, username, email FROM members WHERE id NOT IN (${preservedMemberIds.join(',')})`
    );
    console.log(`\nMembers to delete: ${membersToDelete.rows.length}`);
    console.log(membersToDelete.rows.map(r => `${r.name} (@${r.username}, ID:${r.id})`));

    // 2. Communities to delete
    const commsToDelete = await pool.query(
      `SELECT id, name, username FROM communities WHERE id NOT IN (${preservedCommunityIds.join(',')})`
    );
    console.log(`\nCommunities to delete: ${commsToDelete.rows.length}`);
    console.log(commsToDelete.rows.map(r => `${r.name} (ID:${r.id})`));

    // 3. Posts to delete vs preserve
    const allowedAuthors = [];
    if (preservedMemberIds.length > 0) {
      allowedAuthors.push(`(author_type = 'member' AND author_id IN (${preservedMemberIds.join(',')}))`);
    }
    if (preservedCommunityIds.length > 0) {
      allowedAuthors.push(`(author_type = 'community' AND author_id IN (${preservedCommunityIds.join(',')}))`);
    }

    const postsToPreserve = await pool.query(
      `SELECT id, caption, author_type, author_id FROM posts WHERE ${allowedAuthors.join(' OR ')}`
    );
    const postsToDelete = await pool.query(
      `SELECT COUNT(*) FROM posts WHERE NOT (${allowedAuthors.join(' OR ')})`
    );
    console.log(`\nPosts to preserve (${postsToPreserve.rows.length}):`);
    postsToPreserve.rows.forEach(r => console.log(`   - [ID ${r.id}] (${r.author_type}-${r.author_id}): ${r.caption ? r.caption.slice(0, 50) : '(empty)'}`));
    console.log(`Posts to delete: ${postsToDelete.rows[0].count}`);

    // 4. Opportunities to delete
    const oppsCount = await pool.query(`SELECT COUNT(*) FROM opportunities`);
    console.log(`\nOpportunities to delete: ${oppsCount.rows[0].count}`);

    // 5. Events to delete
    const eventsCount = await pool.query(`SELECT COUNT(*) FROM events`);
    console.log(`\nEvents to delete: ${eventsCount.rows[0].count}`);

  } catch (err) {
    console.error('Dry run failed:', err);
  } finally {
    await pool.end();
  }
}

dryRunCleanup();
