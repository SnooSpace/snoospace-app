/**
 * test:aqi:seed — Creates two test members with known AQI profiles
 * and seeds their behavioral signals manually.
 *
 * User A — high-intent member (should reach Tier 1 or 2):
 *   - 4 paid events attended (avg ₹800 ticket price)
 *   - 2 QR check-ins
 *   - High video watch completion ratios
 *   - Saves, searches with location context, followed organiser post-event
 *   - IST professional hours engagement
 *
 * User B — passive lurker (should settle at Tier 3 or 4):
 *   - 0 paid events
 *   - Only post_likes and short video watches
 *   - Low total_behavior_events
 *
 * Run: node scripts/test.aqi.seed.js
 * Outputs: seeds/aqi_test_users.json with user IDs for use by verify/decay/fraud tests
 */
'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { createPool } = require('../config/db');
const { emitSignal } = require('../utils/signalEmitter');
const { recalculateAqiAsync } = require('../utils/signalEmitter');
const fs = require('fs');
const path = require('path');
const p = createPool();

const SEED_EMAIL_PREFIX = 'aqi_test_';

async function clearExistingTestUsers() {
  // Remove any previous test run users
  const existing = await p.query(
    `SELECT id FROM members WHERE email LIKE $1`,
    [`${SEED_EMAIL_PREFIX}%`]
  );
  if (existing.rows.length === 0) return;

  const ids = existing.rows.map(r => r.id);
  await p.query(`DELETE FROM user_behavior_events WHERE user_id = ANY($1)`, [ids]);
  await p.query(`DELETE FROM user_aqi_signals WHERE user_id = ANY($1)`, [ids]);
  await p.query(`DELETE FROM user_interest_vectors WHERE user_id = ANY($1)`, [ids]);
  await p.query(`DELETE FROM user_privacy_consent WHERE user_id = ANY($1)`, [ids]);
  await p.query(`DELETE FROM members WHERE id = ANY($1)`, [ids]);
  console.log(`Cleared ${ids.length} existing test user(s)`);
}

async function createTestMember(name, email, city, gender, dob, interests) {
  // Phone must be exactly 10 digits (phone_10_digits constraint)
  const phone = `90${Math.floor(10000000 + Math.random() * 89999999)}`;

  const result = await p.query(
    `INSERT INTO members (name, email, phone, location, gender, dob, interests, created_at)
     VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7::jsonb, NOW())
     RETURNING id`,
    [
      name,
      email,
      phone,
      JSON.stringify({ city, lat: null, lng: null }),
      gender,
      dob,
      JSON.stringify(interests),
    ]
  );
  return result.rows[0].id;
}


async function emit(userId, eventType, category, metadata, signalStrength) {
  await emitSignal(p, {
    userId,
    userType: 'member',
    eventType,
    category,
    metadata: metadata || {},
    ...(signalStrength !== undefined ? { signalStrength } : {}),
  });
  await new Promise(r => setTimeout(r, 50));
}

async function run() {
  console.log('=== AQI Test Suite: SEED ===\n');

  await clearExistingTestUsers();

  // ── Create User A (high intent) ─────────────────────────────────────────────
  const userAId = await createTestMember(
    'AQI Test User A',
    `${SEED_EMAIL_PREFIX}user_a@test.snoospace.in`,
    'Bangalore',
    'Female',
    '1996-04-15',
    ['music', 'technology', 'dance'] // 3 interests — satisfies interests_len constraint
  );
  console.log(`User A created: ${userAId}`);

  // Consent: all enabled (default)
  await p.query(
    `INSERT INTO user_privacy_consent (user_id, user_type, behavioral_tracking_consent, brand_targeting_consent)
     VALUES ($1, 'member', true, true)
     ON CONFLICT (user_id, user_type) DO UPDATE
       SET behavioral_tracking_consent = true,
           brand_targeting_consent = true`,
    [userAId]
  );


  // Seed signals for User A
  // Paid events (2 QR check-ins + 2 paid_event_attended)
  for (let i = 0; i < 2; i++) {
    await emit(userAId, 'qr_checkin', 'music', { event_id: 100 + i, ticket_price: 1200 });
  }
  for (let i = 0; i < 2; i++) {
    await emit(userAId, 'paid_event_attended', 'technology', { event_id: 110 + i, ticket_price: 400 });
  }
  // High-completion video watches
  for (let i = 0; i < 5; i++) {
    await emit(userAId, 'content_watched_long', 'music', { completion_ratio: 0.92, completionRatio: 0.92 }, 1.5);
  }
  for (let i = 0; i < 3; i++) {
    await emit(userAId, 'content_watched_long', 'technology', { completion_ratio: 0.77, completionRatio: 0.77 }, 1.0);
  }
  // Saves, shares, Q&A
  for (let i = 0; i < 6; i++) await emit(userAId, 'post_save', 'music', {});
  for (let i = 0; i < 4; i++) await emit(userAId, 'content_shared', 'music', {});
  for (let i = 0; i < 3; i++) await emit(userAId, 'qna_question', 'technology', {});
  // Contextual searches (sophisticated — location + time context)
  await emit(userAId, 'search_performed', 'music', { query: 'live music events this weekend bangalore', query_word_count: 6 });
  await emit(userAId, 'search_performed', 'technology', { query: 'tech startup networking saturday koramangala', query_word_count: 5 });
  await emit(userAId, 'search_converted_to_rsvp', 'music', { event_id: 100 });
  // Post-event echo
  await emit(userAId, 'post_event_echo', 'music', { event_id: 100, echo_score: 1.8 }, 1.8);
  // RSVPs and event RSVPs
  for (let i = 0; i < 4; i++) await emit(userAId, 'event_rsvp', 'music', { eventId: 100 + i });
  // Polls and challenges
  for (let i = 0; i < 3; i++) await emit(userAId, 'poll_vote', 'music', {});
  for (let i = 0; i < 2; i++) await emit(userAId, 'challenge_submit', 'music', {});
  // Likes (lower signal)
  for (let i = 0; i < 8; i++) await emit(userAId, 'post_like', 'music', {});

  console.log('User A signals seeded');

  // ── Create User B (passive lurker) ───────────────────────────────────────────
  const userBId = await createTestMember(
    'AQI Test User B',
    `${SEED_EMAIL_PREFIX}user_b@test.snoospace.in`,
    'Patna',
    'Male',
    '2001-08-22',
    ['gaming', 'food', 'fitness'] // 3 interests
  );
  console.log(`User B created: ${userBId}`);

  await p.query(
    `INSERT INTO user_privacy_consent (user_id, user_type, behavioral_tracking_consent, brand_targeting_consent)
     VALUES ($1, 'member', true, true)
     ON CONFLICT (user_id, user_type) DO UPDATE
       SET behavioral_tracking_consent = true,
           brand_targeting_consent = true`,
    [userBId]
  );


  // Seed signals for User B — mostly passive
  for (let i = 0; i < 12; i++) await emit(userBId, 'post_like', null, {});
  for (let i = 0; i < 4; i++) {
    await emit(userBId, 'content_watched_short', null, { completion_ratio: 0.15, completionRatio: 0.15 }, 0.1);
  }
  await emit(userBId, 'event_rsvp', null, { eventId: 200 });
  console.log('User B signals seeded');

  // ── Trigger AQI recalculation ────────────────────────────────────────────────
  console.log('\nRecalculating AQI for both users...');
  await recalculateAqiAsync(p, userAId);
  await new Promise(r => setTimeout(r, 500));
  await recalculateAqiAsync(p, userBId);
  await new Promise(r => setTimeout(r, 500));

  // ── Fetch and display results ─────────────────────────────────────────────────
  const result = await p.query(
    `SELECT user_id, aqi_score, aqi_tier, aqi_trajectory,
            paid_events_attended, avg_ticket_price_paid,
            total_rsvps, total_attended, rsvp_to_attend_ratio,
            content_depth_score, network_quality_avg,
            total_behavior_events, professional_hours_ratio
     FROM user_aqi_signals WHERE user_id = ANY($1::int[])
     ORDER BY aqi_score DESC NULLS LAST`,
    [[userAId, userBId]]
  );

  console.log('\n=== SEED RESULTS ===');
  result.rows.forEach(r => {
    const label = r.user_id === userAId ? 'User A (high intent)' : 'User B (lurker)';
    console.log(`\n${label} [ID=${r.user_id}]:`);
    console.log(`  AQI Score:             ${r.aqi_score}`);
    console.log(`  Tier:                  ${r.aqi_tier}`);
    console.log(`  Trajectory:            ${r.aqi_trajectory}`);
    console.log(`  Paid Events:           ${r.paid_events_attended}`);
    console.log(`  Avg Ticket Price:      ₹${r.avg_ticket_price_paid}`);
    console.log(`  Total RSVPs:           ${r.total_rsvps}`);
    console.log(`  Total Attended:        ${r.total_attended}`);
    console.log(`  RSVP-Attend Ratio:     ${r.rsvp_to_attend_ratio}`);
    console.log(`  Content Depth Score:   ${r.content_depth_score}`);
    console.log(`  Network Quality Avg:   ${r.network_quality_avg}`);
    console.log(`  Total Behavior Events: ${r.total_behavior_events}`);
    console.log(`  Professional Hrs Ratio:${r.professional_hours_ratio}`);
  });

  // Save user IDs for subsequent tests
  const seedFile = path.join(__dirname, 'seeds', 'aqi_test_users.json');
  require('fs').mkdirSync(path.join(__dirname, 'seeds'), { recursive: true });
  fs.writeFileSync(seedFile, JSON.stringify({
    userAId,
    userBId,
    seededAt: new Date().toISOString(),
  }, null, 2));
  console.log(`\nSeed data saved to ${seedFile}`);

  await p.end();
}

run().catch(e => { console.error(e); p.end(); process.exit(1); });
