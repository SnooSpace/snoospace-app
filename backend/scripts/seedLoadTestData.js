'use strict';
/**
 * Load Test Synthetic Data Seeder
 * 
 * Generates realistic synthetic members, posts, follows, likes, and comments
 * for load testing the Home Feed query (GET /api/posts/feed) with ~2000 virtual users.
 * 
 * All synthetic rows are explicitly tagged with `is_load_test = true`
 * and can be 100% cleanly purged using `scripts/cleanupLoadTestData.js`.
 * 
 * Usage:
 *   node scripts/seedLoadTestData.js
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { createPool } = require('../config/db');

// ── Configuration Constants ──────────────────────────────────────────────────
const CONFIG = {
  TOTAL_MEMBERS: 2000,
  TOTAL_POSTS: 3000,
  TARGET_FOLLOWS: 15000,
  TARGET_LIKES: 8000,
  TARGET_COMMENTS: 5000,
  BATCH_SIZE: 500, // Rows per SQL INSERT
};

// ── Seed Pools for Realistic Distributions ──────────────────────────────────
const FIRST_NAMES = [
  'Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh', 'Ayaan', 'Krishna', 'Ishaan',
  'Dhruv', 'Kabir', 'Rudra', 'Ananya', 'Diya', 'Gauri', 'Isha', 'Kavya', 'Khushi', 'Myra',
  'Navya', 'Pooja', 'Priya', 'Riya', 'Saanvi', 'Tanvi', 'Vanya', 'Zoya', 'Aditi', 'Rohan',
  'Harsh', 'Siddharth', 'Nikhil', 'Dev', 'Shreya', 'Meera', 'Tarun', 'Vikram', 'Neha', 'Pooja'
];

const LAST_NAMES = [
  'Sharma', 'Verma', 'Gupta', 'Patel', 'Kumar', 'Singh', 'Reddy', 'Mehta', 'Nair', 'Chopra',
  'Iyer', 'Kapoor', 'Malhotra', 'Bhatia', 'Joshi', 'Deshmukh', 'Saxena', 'Pandey', 'Mishra', 'Rao',
  'Menon', 'Pillai', 'Banerjee', 'Chatterjee', 'Dutta', 'Ghosh', 'Das', 'Sen', 'Roy', 'Agarwal'
];

const INTERESTS_POOL = [
  'Music', 'Tech & AI', 'Fitness & Gym', 'Design & UI/UX', 'Photography',
  'Gaming', 'Startups', 'Travel', 'Cinema & Films', 'Books & Literature',
  'Food & Culinary', 'Art & Craft', 'Standup Comedy', 'Dance', 'Outdoor Sports'
];

const GENDERS = ['Male', 'Female', 'Non-binary'];

const SAMPLE_IMAGES = [
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800',
  'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=800',
  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=800',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=800',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800',
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=800'
];

const SAMPLE_CAPTIONS = [
  'Exploring new soundscapes in the city tonight 🎵',
  'Late night build session on the next iteration. Thoughts?',
  'Quick coffee break before diving into the weekend project ☕',
  'Weekend vibes with the community. Grateful for this energy ✨',
  'Testing out new creative techniques. What do you think?',
  'Excited to announce our upcoming collaboration session next week!',
  'Caught this golden hour view right outside the studio.',
  'Great conversations with amazing creators today.'
];

const SAMPLE_COMMENTS = [
  'Looks fantastic! Great work.',
  'Super clean setup 🔥',
  'Totally agree with this take.',
  'Would love to collaborate on something similar!',
  'Which tools did you use for this?',
  'Incredible vibe 🚀',
  'Count me in for the next one!',
  'Solid progress!'
];

// ── Helper Functions ─────────────────────────────────────────────────────────
function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomInterests() {
  const count = getRandomInt(3, 5); // Must be BETWEEN 3 AND 7 for interests_len constraint
  const shuffled = [...INTERESTS_POOL].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

function getRandomDate(daysBackStart, daysBackEnd) {
  const now = Date.now();
  const startMs = now - (daysBackStart * 24 * 60 * 60 * 1000);
  const endMs = now - (daysBackEnd * 24 * 60 * 60 * 1000);
  const randomMs = startMs + Math.random() * (endMs - startMs);
  return new Date(randomMs);
}

// ── Main Seeder Logic ────────────────────────────────────────────────────────
async function runSeeder() {
  const startTime = Date.now();
  const pool = createPool();

  console.log('================================================================');
  console.log('🌱 Starting Synthetic Load Test Data Seeding');
  console.log('   Target: ~2,000 Members, ~3,000 Posts, ~15,000 Follows');
  console.log('   Tag: is_load_test = true');
  console.log('================================================================\n');

  try {
    // ── Phase 0: Check if column exists ──────────────────────────────────────
    const colCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'members' AND column_name = 'is_load_test'
    `);
    if (colCheck.rows.length === 0) {
      throw new Error(
        'Column `is_load_test` does not exist on `members` table. ' +
        'Please run migration `075_add_load_test_marker_columns.sql` first.'
      );
    }

    // ── Phase 1: Seed Synthetic Members (2,000) ──────────────────────────────
    console.log(`[1/5] Seeding ${CONFIG.TOTAL_MEMBERS} synthetic members...`);
    const memberIds = [];
    
    for (let batchStart = 0; batchStart < CONFIG.TOTAL_MEMBERS; batchStart += CONFIG.BATCH_SIZE) {
      const currentBatchSize = Math.min(CONFIG.BATCH_SIZE, CONFIG.TOTAL_MEMBERS - batchStart);
      const rows = [];

      for (let i = 0; i < currentBatchSize; i++) {
        const index = batchStart + i + 1;
        const firstName = getRandomElement(FIRST_NAMES);
        const lastName = getRandomElement(LAST_NAMES);
        const name = `${firstName} ${lastName}`;
        const email = `loadtest_${index}@snoospace-test.internal`;
        const phone = `99000${String(index).padStart(5, '0')}`;
        const dobYear = getRandomInt(1995, 2005);
        const dobMonth = String(getRandomInt(1, 12)).padStart(2, '0');
        const dobDay = String(getRandomInt(1, 28)).padStart(2, '0');
        const dob = `${dobYear}-${dobMonth}-${dobDay}`;
        const gender = getRandomElement(GENDERS);
        const interests = JSON.stringify(getRandomInterests());
        const username = `loadtest_user_${index}`;
        const isCreator = Math.random() < 0.15; // 15% creators
        const createdAt = getRandomDate(35, 1);

        rows.push([
          name, email, phone, dob, gender, interests,
          username, isCreator, true, createdAt
        ]);
      }

      // Build multi-row parameter placeholders: ($1,$2,...), ($11,$12,...)
      const numCols = 10;
      const valuePlaceholders = rows.map((_, rIdx) => {
        const offset = rIdx * numCols;
        const placeholders = Array.from({ length: numCols }, (_, cIdx) => `$${offset + cIdx + 1}`);
        return `(${placeholders.join(', ')})`;
      }).join(', ');

      const flatValues = rows.flat();

      const insertRes = await pool.query(`
        INSERT INTO members (
          name, email, phone, dob, gender, interests,
          username, is_creator_mode_enabled, is_load_test, created_at
        ) VALUES ${valuePlaceholders}
        RETURNING id
      `, flatValues);

      insertRes.rows.forEach(r => memberIds.push(r.id));
      console.log(`  ✓ Seeded ${memberIds.length}/${CONFIG.TOTAL_MEMBERS} members...`);
    }

    // ── Phase 2: Seed Synthetic Posts (3,000) ────────────────────────────────
    console.log(`\n[2/5] Seeding ${CONFIG.TOTAL_POSTS} synthetic posts across members...`);
    const postIds = [];
    
    // Choose ~500 active authors among the 2,000 members
    const authorPool = memberIds.slice(0, 500);

    for (let batchStart = 0; batchStart < CONFIG.TOTAL_POSTS; batchStart += CONFIG.BATCH_SIZE) {
      const currentBatchSize = Math.min(CONFIG.BATCH_SIZE, CONFIG.TOTAL_POSTS - batchStart);
      const rows = [];

      for (let i = 0; i < currentBatchSize; i++) {
        const authorId = getRandomElement(authorPool);
        const authorType = 'member';
        const postTypeRoll = Math.random();
        
        let postType = 'media';
        let imageUrls = '[]';
        let caption = getRandomElement(SAMPLE_CAPTIONS);
        let typeData = '{}';

        if (postTypeRoll < 0.35) {
          // 35% Media post
          postType = 'media';
          imageUrls = JSON.stringify([getRandomElement(SAMPLE_IMAGES)]);
        } else if (postTypeRoll < 0.55) {
          // 20% Community Voice
          postType = 'community_voice';
          typeData = JSON.stringify({ is_anonymous: false, community_voice: true });
        } else if (postTypeRoll < 0.75) {
          // 20% Poll
          postType = 'poll';
          typeData = JSON.stringify({
            question: 'What is your primary focus for this quarter?',
            options: [
              { text: 'Building & Launching', index: 0, vote_count: getRandomInt(2, 20) },
              { text: 'Audience & Networking', index: 1, vote_count: getRandomInt(1, 15) },
              { text: 'Skill Learning', index: 2, vote_count: getRandomInt(0, 10) }
            ],
            total_votes: getRandomInt(5, 45)
          });
        } else if (postTypeRoll < 0.90) {
          // 15% Q&A
          postType = 'qna';
          typeData = JSON.stringify({
            title: 'Ask me anything about scaling content & tech',
            description: 'Open for questions from creators and builders.'
          });
        } else {
          // 10% Prompt
          postType = 'prompt';
          typeData = JSON.stringify({
            prompt_text: 'Share the most impactful lesson you learned this month.'
          });
        }

        const createdAt = getRandomDate(30, 0); // Past 30 days
        const publicViewCount = getRandomInt(10, 500);
        const likeCount = getRandomInt(0, 50);
        const commentCount = getRandomInt(0, 20);

        rows.push([
          authorId, authorType, caption, imageUrls,
          postType, 'active', typeData, publicViewCount,
          likeCount, commentCount, true, createdAt
        ]);
      }

      const numCols = 12;
      const valuePlaceholders = rows.map((_, rIdx) => {
        const offset = rIdx * numCols;
        const placeholders = Array.from({ length: numCols }, (_, cIdx) => `$${offset + cIdx + 1}`);
        return `(${placeholders.join(', ')})`;
      }).join(', ');

      const flatValues = rows.flat();

      const insertRes = await pool.query(`
        INSERT INTO posts (
          author_id, author_type, caption, image_urls,
          post_type, status, type_data, public_view_count,
          like_count, comment_count, is_load_test, created_at
        ) VALUES ${valuePlaceholders}
        RETURNING id
      `, flatValues);

      insertRes.rows.forEach(r => postIds.push(r.id));
      console.log(`  ✓ Seeded ${postIds.length}/${CONFIG.TOTAL_POSTS} posts...`);
    }

    // ── Phase 3: Seed Synthetic Follows (~15,000) ────────────────────────────
    console.log(`\n[3/5] Generating and seeding ~${CONFIG.TARGET_FOLLOWS} follow relationships...`);
    const followPairs = new Set();
    const followRows = [];

    // Each member follows 5 to 25 random members
    for (const followerId of memberIds) {
      const followCount = getRandomInt(5, 20);
      for (let f = 0; f < followCount; f++) {
        const followingId = getRandomElement(memberIds);
        if (followerId !== followingId) {
          const key = `${followerId}_${followingId}`;
          if (!followPairs.has(key)) {
            followPairs.add(key);
            const createdAt = getRandomDate(35, 1);
            followRows.push([
              followerId, 'member', followingId, 'member',
              false, true, createdAt
            ]);
          }
        }
      }
    }

    let insertedFollows = 0;
    for (let batchStart = 0; batchStart < followRows.length; batchStart += CONFIG.BATCH_SIZE) {
      const chunk = followRows.slice(batchStart, batchStart + CONFIG.BATCH_SIZE);
      const numCols = 7;
      const valuePlaceholders = chunk.map((_, rIdx) => {
        const offset = rIdx * numCols;
        const placeholders = Array.from({ length: numCols }, (_, cIdx) => `$${offset + cIdx + 1}`);
        return `(${placeholders.join(', ')})`;
      }).join(', ');

      const flatValues = chunk.flat();

      await pool.query(`
        INSERT INTO follows (
          follower_id, follower_type, following_id, following_type,
          is_superseded_by_circle, is_load_test, created_at
        ) VALUES ${valuePlaceholders}
        ON CONFLICT (follower_id, follower_type, following_id, following_type) DO NOTHING
      `, flatValues);

      insertedFollows += chunk.length;
      if (insertedFollows % 2500 === 0 || insertedFollows >= followRows.length) {
        console.log(`  ✓ Seeded ${insertedFollows}/${followRows.length} follows...`);
      }
    }

    // ── Phase 4: Seed Synthetic Post Likes (~8,000) ───────────────────────────
    console.log(`\n[4/5] Generating and seeding ~${CONFIG.TARGET_LIKES} post likes...`);
    const likePairs = new Set();
    const likeRows = [];

    for (let i = 0; i < CONFIG.TARGET_LIKES; i++) {
      const postId = getRandomElement(postIds);
      const likerId = getRandomElement(memberIds);
      const key = `${postId}_${likerId}`;

      if (!likePairs.has(key)) {
        likePairs.add(key);
        const createdAt = getRandomDate(25, 0);
        likeRows.push([postId, likerId, 'member', true, createdAt]);
      }
    }

    let insertedLikes = 0;
    for (let batchStart = 0; batchStart < likeRows.length; batchStart += CONFIG.BATCH_SIZE) {
      const chunk = likeRows.slice(batchStart, batchStart + CONFIG.BATCH_SIZE);
      const numCols = 5;
      const valuePlaceholders = chunk.map((_, rIdx) => {
        const offset = rIdx * numCols;
        const placeholders = Array.from({ length: numCols }, (_, cIdx) => `$${offset + cIdx + 1}`);
        return `(${placeholders.join(', ')})`;
      }).join(', ');

      const flatValues = chunk.flat();

      await pool.query(`
        INSERT INTO post_likes (
          post_id, liker_id, liker_type, is_load_test, created_at
        ) VALUES ${valuePlaceholders}
        ON CONFLICT (post_id, liker_id, liker_type) DO NOTHING
      `, flatValues);

      insertedLikes += chunk.length;
      console.log(`  ✓ Seeded ${insertedLikes}/${likeRows.length} post likes...`);
    }

    // ── Phase 5: Seed Synthetic Post Comments (~5,000) ────────────────────────
    console.log(`\n[5/5] Generating and seeding ~${CONFIG.TARGET_COMMENTS} post comments...`);
    const commentRows = [];

    for (let i = 0; i < CONFIG.TARGET_COMMENTS; i++) {
      const postId = getRandomElement(postIds);
      const commenterId = getRandomElement(memberIds);
      const commentText = getRandomElement(SAMPLE_COMMENTS);
      const createdAt = getRandomDate(25, 0);
      commentRows.push([postId, commenterId, 'member', commentText, true, createdAt]);
    }

    let insertedComments = 0;
    for (let batchStart = 0; batchStart < commentRows.length; batchStart += CONFIG.BATCH_SIZE) {
      const chunk = commentRows.slice(batchStart, batchStart + CONFIG.BATCH_SIZE);
      const numCols = 6;
      const valuePlaceholders = chunk.map((_, rIdx) => {
        const offset = rIdx * numCols;
        const placeholders = Array.from({ length: numCols }, (_, cIdx) => `$${offset + cIdx + 1}`);
        return `(${placeholders.join(', ')})`;
      }).join(', ');

      const flatValues = chunk.flat();

      await pool.query(`
        INSERT INTO post_comments (
          post_id, commenter_id, commenter_type, comment_text, is_load_test, created_at
        ) VALUES ${valuePlaceholders}
      `, flatValues);

      insertedComments += chunk.length;
      console.log(`  ✓ Seeded ${insertedComments}/${commentRows.length} comments...`);
    }

    // ── Summary & Planner Statistics Update ──────────────────────────────────
    console.log('\n🔍 Updating PostgreSQL planner statistics (ANALYZE)...');
    await pool.query('ANALYZE members;');
    await pool.query('ANALYZE posts;');
    await pool.query('ANALYZE follows;');
    await pool.query('ANALYZE post_likes;');
    await pool.query('ANALYZE post_comments;');
    console.log('✓ ANALYZE complete.');

    const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('\n================================================================');
    console.log(`🎉 Seeding Completed Successfully in ${elapsedSeconds}s!`);
    console.log(`   Members Seeded : ${memberIds.length}`);
    console.log(`   Posts Seeded   : ${postIds.length}`);
    console.log(`   Follows Seeded : ${insertedFollows}`);
    console.log(`   Likes Seeded   : ${insertedLikes}`);
    console.log(`   Comments Seeded: ${insertedComments}`);
    console.log('================================================================\n');

  } catch (err) {
    console.error('\n❌ Seeding failed with error:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runSeeder();
