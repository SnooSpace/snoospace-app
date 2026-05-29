/**
 * runCommunityVerification.js
 *
 * Full community AQI verification suite.
 * Reads test IDs written by seedCommunityTestData.js.
 *
 * Tests:
 *   1. Creator stats calculation (followers, follow quality, tier breakdown)
 *   2. Community health score (healthy community = multiplier 1.0)
 *   3. Fraud detection (dummy account RSVPs on Community B)
 *   4. Post-event attendance resolution
 *   5. Privacy consent save + load round trip (polymorphic user_type)
 *   6. No duplicate consent rows (user_type collision detection)
 *   7. Creator stats empty state for new community (Community C)
 *
 * Run: npm run test:community:verify
 * (Run test:community:seed first to populate testIds.json)
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { createPool } = require('../../config/db');
const path = require('path');
const fs = require('fs');

const pool = createPool();

// ── Assert helper ──────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

const assert = (label, condition, actual, expected) => {
  if (condition) {
    console.log(`  ✅ PASS — ${label}`);
    passed++;
  } else {
    console.log(`  ❌ FAIL — ${label}`);
    console.log(`     Expected: ${JSON.stringify(expected)}`);
    console.log(`     Actual:   ${JSON.stringify(actual)}`);
    failed++;
  }
};

const info = (msg) => console.log(`  ℹ️  ${msg}`);

// ── Load test IDs ──────────────────────────────────────────────────────────────
const idsPath = path.join(__dirname, 'testIds.json');
if (!fs.existsSync(idsPath)) {
  console.error('❌ testIds.json not found. Run npm run test:community:seed first.');
  process.exit(1);
}
const ids = JSON.parse(fs.readFileSync(idsPath, 'utf8'));

// ── Main verification ──────────────────────────────────────────────────────────
const runVerification = async () => {
  console.log('\n🧪 Community AQI Verification Suite\n');
  console.log('Using test IDs:', ids);
  console.log('');

  // ── TEST 1: Creator stats row for Community A ──────────────────────────────
  console.log('TEST 1 — Creator Audience Stats (Community A)');

  // Trigger recalculation directly via DB query (no HTTP call needed)
  // This is the same logic as calculateCreatorStatsEndpoint fires
  const followersResult = await pool.query(
    `SELECT follower_id FROM follows WHERE following_id = $1 AND following_type = 'community'`,
    [ids.communityA]
  );
  info(`Follows for Community A: ${followersResult.rows.length}`);
  assert(
    'Community A has followers in follows table',
    followersResult.rows.length >= 2,
    followersResult.rows.length, '>= 2'
  );

  const followEventsResult = await pool.query(
    `SELECT follow_source, COUNT(*) as count FROM follow_events
     WHERE creator_id = $1 GROUP BY follow_source`,
    [ids.communityA]
  );
  info(`Follow events for Community A: ${JSON.stringify(followEventsResult.rows)}`);
  assert(
    'Community A has follow_events rows',
    followEventsResult.rows.length > 0,
    followEventsResult.rows.length, '> 0'
  );

  const contentFollows = followEventsResult.rows
    .filter(r => ['event_attendance', 'content_post'].includes(r.follow_source))
    .reduce((sum, r) => sum + parseInt(r.count), 0);
  const followQuality = followersResult.rows.length > 0
    ? Math.round((contentFollows / followersResult.rows.length) * 10000) / 100
    : 0;
  info(`Computed follow quality score: ${followQuality}%`);
  assert(
    'Follow quality score > 0 (content follows exist)',
    followQuality > 0,
    followQuality, '> 0'
  );

  // Check tier breakdown (followers have AQI scores seeded)
  const tierResult = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE aqi_tier = 1) as tier1,
      COUNT(*) FILTER (WHERE aqi_tier = 2) as tier2,
      COUNT(*) FILTER (WHERE aqi_tier = 3) as tier3,
      COUNT(*) FILTER (WHERE aqi_tier = 4) as tier4
    FROM user_aqi_signals
    WHERE user_id = ANY($1)
  `, [followersResult.rows.map(r => r.follower_id)]);
  info(`Tier breakdown: ${JSON.stringify(tierResult.rows[0])}`);
  assert(
    'At least one Tier 1 follower (seeded with aqi_score=78)',
    parseInt(tierResult.rows[0].tier1) >= 1,
    tierResult.rows[0].tier1, '>= 1'
  );

  // Check gender breakdown via follow_events + members join
  const genderResult = await pool.query(`
    SELECT COALESCE(m.gender, 'Unknown') AS gender, COUNT(*) as count
    FROM follow_events fe
    JOIN members m ON m.id = fe.follower_id
    WHERE fe.creator_id = $1
    GROUP BY m.gender
  `, [ids.communityA]);
  info(`Gender breakdown: ${JSON.stringify(genderResult.rows)}`);
  assert(
    'Gender breakdown has at least one entry',
    genderResult.rows.length > 0,
    genderResult.rows.length, '> 0'
  );

  // ── TEST 2: Razorpay payment verification ─────────────────────────────────
  console.log('\nTEST 2 — Razorpay Payment Records (Community A events)');

  const paymentResult = await pool.query(`
    SELECT COUNT(*) as count FROM razorpay_payments
    WHERE user_id IN ($1, $2) AND webhook_verified = true AND status = 'captured'
  `, [ids.memberA1, ids.memberA2]);
  info(`Verified payments: ${paymentResult.rows[0].count}`);
  assert(
    'Community A has verified Razorpay payments',
    parseInt(paymentResult.rows[0].count) >= 6,
    paymentResult.rows[0].count, '>= 6 (2 per event × 3 events)'
  );

  const registrationResult = await pool.query(`
    SELECT COUNT(*) as count FROM event_registrations
    WHERE member_id IN ($1, $2) AND attendance_status = 'confirmed_attended'
  `, [ids.memberA1, ids.memberA2]);
  info(`Confirmed attended registrations: ${registrationResult.rows[0].count}`);
  assert(
    'Event registrations have confirmed_attended status',
    parseInt(registrationResult.rows[0].count) >= 6,
    registrationResult.rows[0].count, '>= 6'
  );

  // ── TEST 3: Fraud detection signals — dummy account RSVPs ─────────────────
  console.log('\nTEST 3 — Dummy Account RSVP Detection (Community B)');

  // Count new accounts (< 7 days old) who RSVPed
  const newAccountRsvpResult = await pool.query(`
    SELECT COUNT(*) as dummy_count
    FROM event_registrations er
    JOIN members m ON m.id = er.member_id
    WHERE er.event_id = $1
      AND m.created_at > NOW() - INTERVAL '7 days'
  `, [ids.suspiciousEventId]);
  const dummyCount = parseInt(newAccountRsvpResult.rows[0].dummy_count);
  info(`Dummy account RSVPs on Community B event: ${dummyCount}`);
  assert(
    'Community B has >= 20 new-account RSVPs (fraud signal)',
    dummyCount >= 20,
    dummyCount, '>= 20'
  );

  // Check attendance ratio for suspicious event
  // Check attendance ratio via event_registrations (events table has no rsvp_count/attended_count)
  const attendanceResult = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE registration_status = 'registered') as rsvp_count,
      COUNT(*) FILTER (WHERE attendance_status = 'confirmed_attended') as attended_count
    FROM event_registrations WHERE event_id = $1
  `, [ids.suspiciousEventId]);
  const rsvpCount = parseInt(attendanceResult.rows[0]?.rsvp_count) || 0;
  const attendedCount = parseInt(attendanceResult.rows[0]?.attended_count) || 0;
  const attendanceRatio = rsvpCount > 0 ? Math.round((attendedCount / rsvpCount) * 100) : 0;
  info(`Community B event: ${rsvpCount} RSVPs, ${attendedCount} attended, ratio ${attendanceRatio}%`);
  // Note: dummy members have no attended status set, so ratio reflects seeded registrations
  info(`Dummy accounts registered: ${dummyCount} — this is the fraud signal`);

  // ── TEST 4: Community C baseline (new community, zero activity) ───────────
  console.log('\nTEST 4 — Community C Baseline (new, zero activity)');

  const communityCFollows = await pool.query(
    `SELECT COUNT(*) as count FROM follows WHERE following_id = $1`,
    [ids.communityC]
  );
  assert(
    'Community C has 0 followers',
    parseInt(communityCFollows.rows[0].count) === 0,
    communityCFollows.rows[0].count, 0
  );

  const communityCEvents = await pool.query(
    `SELECT COUNT(*) as count FROM events WHERE community_id = $1 AND is_published = true`,
    [ids.communityC]
  );
  assert(
    'Community C has 0 published events',
    parseInt(communityCEvents.rows[0].count) === 0,
    communityCEvents.rows[0].count, 0
  );

  const communityCStats = await pool.query(
    `SELECT * FROM creator_audience_stats WHERE creator_id = $1`,
    [ids.communityC]
  );
  info(`Community C has stats row: ${communityCStats.rows.length > 0}`);
  // No stats row yet is expected for a brand new community
  // (getCreatorStats would trigger auto-recalc which creates a zero row)

  // ── TEST 5: Privacy consent save + load round trip ────────────────────────
  console.log('\nTEST 5 — Privacy Consent Persistence (Community A)');

  // Write consent for Community A
  await pool.query(`
    INSERT INTO user_privacy_consent (
      user_id, user_type,
      behavioral_tracking_consent,
      brand_targeting_consent,
      data_sharing_consent,
      event_audience_intelligence_consent,
      consent_version, consented_at, last_updated_at
    ) VALUES ($1, 'community', true, true, false, true, 'v1.0', NOW(), NOW())
    ON CONFLICT (user_id, user_type) DO UPDATE SET
      behavioral_tracking_consent = true,
      brand_targeting_consent = true,
      data_sharing_consent = false,
      event_audience_intelligence_consent = true,
      last_updated_at = NOW()
  `, [ids.communityA]);

  // Read back using community-data-summary query path (hardcoded user_type = 'community')
  const consentRow = await pool.query(
    `SELECT * FROM user_privacy_consent WHERE user_id = $1 AND user_type = 'community'`,
    [ids.communityA]
  );
  assert('Consent row exists for Community A with user_type = community',
    consentRow.rows.length === 1 && consentRow.rows[0].user_type === 'community',
    consentRow.rows[0]?.user_type, 'community'
  );
  assert('behavioral_tracking_consent saved as true',
    consentRow.rows[0]?.behavioral_tracking_consent === true,
    consentRow.rows[0]?.behavioral_tracking_consent, true
  );
  assert('event_audience_intelligence_consent saved as true',
    consentRow.rows[0]?.event_audience_intelligence_consent === true,
    consentRow.rows[0]?.event_audience_intelligence_consent, true
  );
  assert('data_sharing_consent saved as false',
    consentRow.rows[0]?.data_sharing_consent === false,
    consentRow.rows[0]?.data_sharing_consent, false
  );

  // ── TEST 6: No duplicate consent rows (user_type collision bug check) ──────
  console.log('\nTEST 6 — No Duplicate Consent Rows');

  const allConsentRows = await pool.query(
    `SELECT user_id, user_type FROM user_privacy_consent WHERE user_id = $1`,
    [ids.communityA]
  );
  info(`Consent rows for Community A: ${JSON.stringify(allConsentRows.rows)}`);
  assert(
    'Exactly 1 consent row for Community A (no user_type collision)',
    allConsentRows.rows.length === 1,
    allConsentRows.rows.length, 1
  );
  if (allConsentRows.rows.length > 1) {
    console.log('\n  🚨 DUPLICATE ROWS DETECTED — this is the toggle revert bug!');
    console.log('     Multiple rows with same user_id but different user_type:');
    console.log('    ', allConsentRows.rows);
    console.log('     Fix: ensure POST /privacy/consent uses same user_type as GET');
  }

  // ── TEST 7: Simulated toggle: individual field update merges correctly ─────
  console.log('\nTEST 7 — Single-Field Toggle Merge (partial update correctness)');

  // Simulate toggling ONLY dataSharing ON (the others should stay unchanged)
  const prevConsent = consentRow.rows[0];
  await pool.query(`
    INSERT INTO user_privacy_consent (
      user_id, user_type,
      behavioral_tracking_consent, brand_targeting_consent,
      data_sharing_consent, event_audience_intelligence_consent,
      consent_version, consented_at, last_updated_at
    ) VALUES ($1, 'community', $2, $3, $4, $5, 'v1.0', NOW(), NOW())
    ON CONFLICT (user_id, user_type) DO UPDATE SET
      behavioral_tracking_consent = $2,
      brand_targeting_consent = $3,
      data_sharing_consent = $4,
      event_audience_intelligence_consent = $5,
      last_updated_at = NOW()
  `, [ids.communityA,
    prevConsent.behavioral_tracking_consent,
    prevConsent.brand_targeting_consent,
    true, // dataSharing toggled ON
    prevConsent.event_audience_intelligence_consent]);

  const afterToggle = await pool.query(
    `SELECT * FROM user_privacy_consent WHERE user_id = $1 AND user_type = 'community'`,
    [ids.communityA]
  );
  const t = afterToggle.rows[0];
  assert('After partial toggle: behavioral still true', t.behavioral_tracking_consent === true, t.behavioral_tracking_consent, true);
  assert('After partial toggle: brand still true',      t.brand_targeting_consent === true,      t.brand_targeting_consent, true);
  assert('After partial toggle: dataSharing now true',  t.data_sharing_consent === true,         t.data_sharing_consent, true);
  assert('After partial toggle: eventAudience still true', t.event_audience_intelligence_consent === true, t.event_audience_intelligence_consent, true);

  // ── RESULTS ───────────────────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(55));
  console.log(`RESULTS: ${passed} passed, ${failed} failed`);
  if (failed === 0) {
    console.log('\n🎉 All community verification tests passed');
  } else {
    console.log('\n⚠️  Some tests failed — review output above');
    process.exitCode = 1;
  }

  await pool.end();
};

runVerification().catch((e) => {
  console.error('Verification failed:', e);
  process.exit(1);
});
