/**
 * Verification gate test script.
 * Run from backend dir: node scratch/gate_test.js
 *
 * Uses a DEDICATED test account (member id = 999 range — created fresh here,
 * not accounts 51/52/180 or any other real dev account).
 *
 * Tests:
 *  (a) plans_verified OR none + complete Discover profile → NOT in getEventAttendees results
 *  (b) same account set to selfie_verified → IS in results
 *  (c) revert tier → back out of results
 */
const { Pool } = require('pg');
const pool = new Pool({
  host: 'aws-1-ap-south-1.pooler.supabase.com',
  port: 6543,
  user: 'postgres.ujtoywnkodshtprqojap',
  password: 'wiH6gAz4tc5aYeMZ',
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
});

async function run() {
  const client = await pool.connect();
  try {
    // ── 0. Find a real event with registrations to attach the test account to ──
    const evRes = await client.query(
      `SELECT er.event_id, COUNT(*) AS reg_count
       FROM event_registrations er
       GROUP BY er.event_id
       ORDER BY reg_count DESC
       LIMIT 1`
    );
    if (evRes.rows.length === 0) {
      console.error('No events with registrations found. Cannot run test.');
      return;
    }
    const testEventId = evRes.rows[0].event_id;
    console.log(`\nUsing event_id=${testEventId} (${evRes.rows[0].reg_count} existing registrations)\n`);

    // ── 1. Find a viewer account (not the test account) to act as the caller ──
    // Use account id=180 (Viewer A) as the caller — this is the read-only viewer, not appearing in results
    const viewerId = 180;

    // ── 2. Check if a previous test account exists; clean it up if so ──
    await client.query(`DELETE FROM event_registrations WHERE member_id = (SELECT id FROM members WHERE email = 'gate_test_dedicated@snoospace.test') AND event_id = $1`, [testEventId]);
    await client.query(`DELETE FROM members WHERE email = 'gate_test_dedicated@snoospace.test'`);

    // ── 3. Create dedicated test member with complete Discover profile ──
    const insertRes = await client.query(
      `INSERT INTO members (
         name, email, phone, dob, gender, interests, pronouns, signup_status, location,
         discover_photos, openers, appear_in_discover,
         verification_tier, is_verified, verified_at
       ) VALUES (
         'GateTestDedicated',
         'gate_test_dedicated@snoospace.test',
         '0000000000',
         '1995-01-01',
         'Male',
         '["Music", "Fitness", "Travel"]'::jsonb,
         'Not specified',
         'ACTIVE',
         '{"city": "Test City", "lat": 12.9716, "lng": 77.5946}'::jsonb,
         '["https://example.com/a.jpg","https://example.com/b.jpg","https://example.com/c.jpg"]'::jsonb,
         '["What do you do on weekends?"]'::jsonb,
         true,
         'plans_verified',
         true,
         NOW()
       ) RETURNING id`
    );
    const testMemberId = insertRes.rows[0].id;
    console.log(`Created dedicated test member id=${testMemberId}\n`);

    // Add a spark for the test member
    const sparkRes = await client.query(`SELECT id FROM sparks LIMIT 1`);
    if (sparkRes.rows.length > 0) {
      await client.query(
        `INSERT INTO user_sparks (user_id, spark_id, is_expired) VALUES ($1, $2, false)`,
        [testMemberId, sparkRes.rows[0].id]
      );
    }

    // Register the test member for the event
    await client.query(
      `INSERT INTO event_registrations (event_id, member_id, registration_status)
       VALUES ($1, $2, 'registered')
       ON CONFLICT DO NOTHING`,
      [testEventId, testMemberId]
    );

    // ── Helper: run the EXACT gate query from getEventAttendees ──
    async function queryDeck(label) {
      const res = await client.query(
        `SELECT m.id, m.name, m.verification_tier
         FROM event_registrations er
         INNER JOIN members m ON er.member_id = m.id
         WHERE er.event_id = $1
           AND er.member_id != $2
           AND er.registration_status IN ('registered', 'attended', 'confirmed')
           AND m.appear_in_discover IS NOT FALSE
           AND jsonb_array_length(COALESCE(m.discover_photos::jsonb, '[]'::jsonb)) >= 3
           AND EXISTS (
             SELECT 1 FROM user_sparks us_gate
             WHERE us_gate.user_id = m.id AND us_gate.is_expired = false
           )
           AND jsonb_array_length(COALESCE(m.openers::jsonb, '[]'::jsonb)) >= 1
           AND m.verification_tier IN ('selfie_verified', 'id_verified')
           AND NOT EXISTS (
             SELECT 1 FROM user_blocks ub
             WHERE (ub.blocker_id = $2 AND ub.blocked_id = m.id)
                OR (ub.blocker_id = m.id AND ub.blocked_id = $2)
           )
         GROUP BY m.id, m.name, m.verification_tier`,
        [testEventId, viewerId]
      );
      const found = res.rows.find(r => r.id == testMemberId);
      console.log(`[${label}] Test member in deck: ${found ? '✅ YES' : '❌ NO'} (tier=${found?.verification_tier ?? 'not in results'})`);
      return found;
    }

    // ── TEST (a): plans_verified → should NOT appear ──
    console.log('=== TEST (a): plans_verified ===');
    await queryDeck('plans_verified');

    // ── TEST (a2): none → should NOT appear ──
    console.log('\n=== TEST (a2): none (unverified) ===');
    await client.query(`UPDATE members SET verification_tier = 'none', is_verified = false, verified_at = NULL WHERE id = $1`, [testMemberId]);
    await queryDeck('none');

    // ── TEST (b): selfie_verified → SHOULD appear ──
    console.log('\n=== TEST (b): selfie_verified ===');
    await client.query(`UPDATE members SET verification_tier = 'selfie_verified', is_verified = true, verified_at = NOW() WHERE id = $1`, [testMemberId]);
    await queryDeck('selfie_verified');

    // ── TEST (b2): id_verified → SHOULD appear ──
    console.log('\n=== TEST (b2): id_verified ===');
    await client.query(`UPDATE members SET verification_tier = 'id_verified', is_verified = true, verified_at = NOW() WHERE id = $1`, [testMemberId]);
    await queryDeck('id_verified');

    // ── TEST (c): revert to plans_verified → back out ──
    console.log('\n=== TEST (c): revert to plans_verified ===');
    await client.query(`UPDATE members SET verification_tier = 'plans_verified', is_verified = true WHERE id = $1`, [testMemberId]);
    await queryDeck('reverted to plans_verified');

  } finally {
    // ── Cleanup: always remove the test account and its registrations ──
    console.log('\n=== Cleanup ===');
    await client.query(`DELETE FROM event_registrations WHERE member_id = (SELECT id FROM members WHERE email = 'gate_test_dedicated@snoospace.test') AND event_id = (SELECT event_id FROM event_registrations WHERE member_id = (SELECT id FROM members WHERE email = 'gate_test_dedicated@snoospace.test') LIMIT 1)`);
    await client.query(`DELETE FROM user_sparks WHERE user_id = (SELECT id FROM members WHERE email = 'gate_test_dedicated@snoospace.test')`);
    const delRes = await client.query(`DELETE FROM members WHERE email = 'gate_test_dedicated@snoospace.test' RETURNING id`);
    console.log(`Deleted test member: ${delRes.rows[0]?.id ?? 'not found'}`);

    client.release();
    await pool.end();
  }
}

run().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
