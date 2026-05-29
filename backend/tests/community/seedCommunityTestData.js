/**
 * seedCommunityTestData.js
 *
 * Seeds three community accounts with distinct profiles to verify
 * community AQI, fraud detection, and consent persistence.
 *
 * Run: npm run test:community:seed
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { createPool } = require('../../config/db');
const path = require('path');
const fs = require('fs');

const pool = createPool();

// Helper: insert a minimal valid member record
// Required NOT NULL: name, email, phone, dob, gender, interests
const insertMember = (pool, name, email, opts = {}) => pool.query(`
  INSERT INTO members (
    name, email, phone, dob, gender, interests,
    occupation, location, created_at
  ) VALUES (
    $1, $2, $3, $4::date, $5, $6::jsonb, $7, $8::jsonb, $9
  ) RETURNING id
`, [
  name,
  email,
  opts.phone || '+911234567890',
  opts.dob || '1995-01-01',
  opts.gender || 'Male',
  opts.interests ? JSON.stringify(opts.interests) : '["fitness"]',
  opts.occupation || 'Software Engineer',
  opts.location ? JSON.stringify(opts.location) : '{"city":"Bangalore"}',
  opts.createdAt || 'NOW()',
]);

const seedCommunityTestData = async () => {
  console.log('🌱 Seeding community test data...\n');

  // ─── COMMUNITY A: Healthy high-quality fitness community ─────────────────────
  const communityA = await pool.query(`
    INSERT INTO communities (name, bio, category, location, created_at)
    VALUES (
      'Test Community Alpha',
      'High quality fitness community for testing',
      'fitness',
      '{"city": "Bangalore"}'::jsonb,
      NOW() - INTERVAL '90 days'
    ) RETURNING id
  `);
  const communityAId = communityA.rows[0].id;

  // Two test member followers
  const m1 = await pool.query(`
    INSERT INTO members (name, email, phone, dob, gender, interests, occupation, location, created_at)
    VALUES ('Test Member A1', 'test.a1@snoospace.dev', '9111111111', '1993-06-15',
            'Male', '["fitness","tech","sports"]'::jsonb, 'Software Engineer',
            '{"city": "Bangalore"}'::jsonb, NOW() - INTERVAL '60 days')
    RETURNING id
  `);
  const m2 = await pool.query(`
    INSERT INTO members (name, email, phone, dob, gender, interests, occupation, location, created_at)
    VALUES ('Test Member A2', 'test.a2@snoospace.dev', '9222222222', '1994-03-20',
            'Female', '["fitness","wellness","yoga"]'::jsonb, 'Founder',
            '{"city": "Mumbai"}'::jsonb, NOW() - INTERVAL '45 days')
    RETURNING id
  `);
  const memberA1Id = m1.rows[0].id;
  const memberA2Id = m2.rows[0].id;

  // Follows
  await pool.query(`
    INSERT INTO follows (follower_id, follower_type, following_id, following_type, created_at)
    VALUES
      ($1, 'member', $2, 'community', NOW() - INTERVAL '30 days'),
      ($3, 'member', $2, 'community', NOW() - INTERVAL '20 days')
    ON CONFLICT DO NOTHING
  `, [memberA1Id, communityAId, memberA2Id]);

  // Follow events (content-based follows for quality scoring)
  await pool.query(`
    INSERT INTO follow_events (follower_id, creator_id, follow_source, followed_at)
    VALUES
      ($1, $2, 'event_attendance', NOW() - INTERVAL '30 days'),
      ($3, $2, 'content_post',     NOW() - INTERVAL '20 days')
  `, [memberA1Id, communityAId, memberA2Id]);

  // AQI signals for followers (tier breakdown in creator stats)
  await pool.query(`
    INSERT INTO user_aqi_signals (user_id, aqi_score, aqi_tier, onboarding_weight, behavior_weight)
    VALUES ($1, 78, 1, 0.3, 0.7), ($2, 63, 2, 0.5, 0.5)
    ON CONFLICT (user_id) DO UPDATE SET
      aqi_score = EXCLUDED.aqi_score, aqi_tier = EXCLUDED.aqi_tier
  `, [memberA1Id, memberA2Id]);

  // 3 events with good attendance ratio (70%)
  for (let i = 0; i < 3; i++) {
    const daysAgo = (i + 1) * 15;
    const event = await pool.query(`
      INSERT INTO events (
        community_id, creator_id, creator_type, title, category,
        event_type, description, event_date,
        start_datetime, end_datetime, is_published
      ) VALUES (
        $1, $1, 'community', $2, 'fitness',
        'in-person', 'Test event for community AQI testing', NOW() - INTERVAL '${daysAgo} days',
        NOW() - INTERVAL '${daysAgo} days',
        NOW() - INTERVAL '${daysAgo} days' + INTERVAL '3 hours',
        true
      ) RETURNING id
    `, [communityAId, `Test Fitness Event ${i + 1}`]);
    const eventId = event.rows[0].id;

    // event_registrations uses member_id
    await pool.query(`
      INSERT INTO event_registrations (member_id, event_id, registration_status, attendance_status)
      VALUES
        ($1, $2, 'registered', 'confirmed_attended'),
        ($3, $2, 'registered', 'confirmed_attended')
    `, [memberA1Id, eventId, memberA2Id]);

    // Verified Razorpay payments
    await pool.query(`
      INSERT INTO razorpay_payments (
        razorpay_payment_id, razorpay_order_id,
        user_id, event_id, amount_paise,
        status, webhook_verified, captured_at
      ) VALUES
        ($1, $2, $3, $4, 50000, 'captured', true, NOW() - INTERVAL '${daysAgo} days'),
        ($5, $6, $7, $4, 50000, 'captured', true, NOW() - INTERVAL '${daysAgo} days')
      ON CONFLICT (razorpay_payment_id) DO NOTHING
    `, [
      `pay_test_a1_evt${i}`, `ord_test_a1_evt${i}`, memberA1Id, eventId,
      `pay_test_a2_evt${i}`, `ord_test_a2_evt${i}`, memberA2Id,
    ]);
  }

  // Behavior events
  const eventTypesA = [
    'event_hosted', 'event_hosted', 'event_hosted',
    'content_watched_long', 'content_watched_long',
    'search_performed', 'search_performed',
  ];
  for (const eventType of eventTypesA) {
    const daysOff = Math.floor(Math.random() * 60) + 1;
    await pool.query(`
      INSERT INTO user_behavior_events (user_id, event_type, category, signal_strength, occurred_at)
      VALUES ($1, $2, 'fitness', $3, NOW() - INTERVAL '${daysOff} days')
    `, [communityAId, eventType, eventType === 'event_hosted' ? 3.0 : 1.0]);
  }

  console.log(`✅ Community A (healthy) seeded — ID: ${communityAId}`);

  // ─── COMMUNITY B: Suspicious community (fraud bait) ──────────────────────────
  const communityB = await pool.query(`
    INSERT INTO communities (name, bio, category, location, created_at)
    VALUES ('Test Community Beta', 'Suspicious community for fraud testing',
            'networking', '{"city": "Delhi"}'::jsonb, NOW() - INTERVAL '60 days')
    RETURNING id
  `);
  const communityBId = communityB.rows[0].id;

  // Paid event with 98% attendance ratio
  const suspiciousEvent = await pool.query(`
    INSERT INTO events (
      community_id, creator_id, creator_type, title, category,
      event_type, description, event_date,
      start_datetime, end_datetime, is_published
    ) VALUES (
      $1, $1, 'community', 'Suspicious Paid Event Beta', 'networking',
      'in-person', 'Suspicious paid event for fraud testing', NOW() - INTERVAL '7 days',
      NOW() - INTERVAL '7 days',
      NOW() - INTERVAL '7 days' + INTERVAL '2 hours',
      true
    ) RETURNING id
  `, [communityBId]);
  const suspiciousEventId = suspiciousEvent.rows[0].id;

  // 25 brand-new accounts RSVPed → triggers dummy_account_rsvps detector
  const dummyIds = [];
  for (let i = 0; i < 25; i++) {
    const daysOld = i % 3; // 0-2 days old (all < 7 days)
    const newMember = await pool.query(`
      INSERT INTO members (name, email, phone, dob, gender, interests, created_at)
      VALUES ($1, $2, $3, '2000-01-01', 'Male', '["networking","events","meetups"]'::jsonb, NOW() - INTERVAL '${daysOld} days')
      RETURNING id
    `, [`Dummy Beta ${i}`, `dummy.beta.${i}@snoospace.dev`, `${String(9100000000 + i).substring(0, 10)}`]);
    dummyIds.push(newMember.rows[0].id);

    await pool.query(`
      INSERT INTO event_registrations (member_id, event_id, registration_status)
      VALUES ($1, $2, 'registered')
    `, [newMember.rows[0].id, suspiciousEventId]);
  }

  console.log(`✅ Community B (suspicious) seeded — ID: ${communityBId}`);

  // ─── COMMUNITY C: Brand new, zero activity ────────────────────────────────────
  const communityC = await pool.query(`
    INSERT INTO communities (name, bio, category, location, created_at)
    VALUES ('Test Community Gamma', 'New empty community for baseline testing',
            'technology', '{"city": "Pune"}'::jsonb, NOW() - INTERVAL '5 days')
    RETURNING id
  `);
  const communityCId = communityC.rows[0].id;

  console.log(`✅ Community C (new/empty) seeded — ID: ${communityCId}`);

  // ── Summary ───────────────────────────────────────────────────────────────────
  console.log('\n📋 Summary:');
  console.log(`   Community A (healthy):    ${communityAId}`);
  console.log(`   Community B (suspicious): ${communityBId}`);
  console.log(`   Community C (new):        ${communityCId}`);
  console.log(`   Member A1:                ${memberA1Id}`);
  console.log(`   Member A2:                ${memberA2Id}`);
  console.log(`   Suspicious Event:         ${suspiciousEventId}`);

  // Write IDs for verification script
  const outputPath = path.join(__dirname, 'testIds.json');
  fs.writeFileSync(outputPath, JSON.stringify({
    communityA: communityAId,
    communityB: communityBId,
    communityC: communityCId,
    memberA1: memberA1Id,
    memberA2: memberA2Id,
    suspiciousEventId,
    dummyMemberIds: dummyIds,
  }, null, 2));
  console.log(`\n💾 IDs written to ${outputPath}`);

  await pool.end();
};

seedCommunityTestData().catch((e) => {
  console.error('Seed failed:', e.message);
  process.exit(1);
});
