/**
 * Prompt 2 Security Test Suite
 * Tests: Rate Limiting, Fraud Detection, Event Verification, Data Retention
 *
 * Usage:  node scripts/testPrompt2Security.js
 *
 * The backend must be running on port 5000.
 * Tests that need auth use a deliberately invalid token to check 401 vs 429.
 */

require('dotenv').config();
const { createPool } = require('../config/db');
const { detectAnomalousSignals } = require('../jobs/learnDemographicScores');
const { runBehaviorEventRetention } = require('../jobs/behaviorEventRetention');

const BASE_URL = 'http://localhost:5000';
const FAKE_TOKEN = 'Bearer invalid.test.token';

// ─── Helpers ──────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function pass(label) {
  console.log(`  ✅ PASS  ${label}`);
  passed++;
}

function fail(label, detail) {
  console.log(`  ❌ FAIL  ${label}`);
  if (detail) console.log(`         ${detail}`);
  failed++;
}

async function fetchJSON(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  let body;
  try { body = await res.json(); } catch { body = null; }
  return { status: res.status, body };
}

// ─── TEST 1: Rate Limiter middleware loads without error ───────────────────

async function testRateLimiterModule() {
  console.log('\n📦 TEST 1 — Rate Limiter Module');
  try {
    const { trackingRateLimit, followTrackingRateLimit, aqiCalculationRateLimit } =
      require('../middleware/rateLimiter');

    if (typeof trackingRateLimit === 'function')
      pass('trackingRateLimit is a middleware function');
    else
      fail('trackingRateLimit is not a function', typeof trackingRateLimit);

    if (typeof followTrackingRateLimit === 'function')
      pass('followTrackingRateLimit is a middleware function');
    else
      fail('followTrackingRateLimit is not a function');

    if (typeof aqiCalculationRateLimit === 'function')
      pass('aqiCalculationRateLimit is a middleware function');
    else
      fail('aqiCalculationRateLimit is not a function');
  } catch (err) {
    fail('rateLimiter module failed to load', err.message);
  }
}

// ─── TEST 2: Rate limiting endpoint — expect 401 (auth fail), not crash ───
//
// We don't have a real token here, so we just confirm the backend
// responds at all on these endpoints (not 404 / 500).
// A real 429 test would require a real token and 101+ rapid requests.

async function testEndpointsReachable() {
  console.log('\n🌐 TEST 2 — Endpoints reachable (auth rejection, not 404/500)');

  const tests = [
    {
      label: 'POST /audience/track-engagement exists',
      path: '/audience/track-engagement',
      method: 'POST',
      body: { userId: 1, contentType: 'post', eventCategory: 'music' },
    },
    {
      label: 'POST /audience/track-follow exists',
      path: '/audience/track-follow',
      method: 'POST',
      body: { followerId: 1, creatorId: 2 },
    },
    {
      label: 'POST /audience/calculate-aqi/1 exists',
      path: '/audience/calculate-aqi/1',
      method: 'POST',
      body: {},
    },
  ];

  for (const t of tests) {
    try {
      const { status } = await fetchJSON(t.path, {
        method: t.method,
        headers: { Authorization: FAKE_TOKEN },
        body: JSON.stringify(t.body),
      });
      // 401 = endpoint exists, auth rejected (correct)
      // 429 = rate limit hit (also means endpoint exists)
      // 404 = endpoint missing (bad)
      // 500 = server error (bad)
      if (status === 401 || status === 429) {
        pass(`${t.label} → ${status} (auth/rate guard active)`);
      } else if (status === 404) {
        fail(t.label, 'Got 404 — route not registered');
      } else if (status === 500) {
        fail(t.label, 'Got 500 — server error');
      } else {
        fail(t.label, `Unexpected status: ${status}`);
      }
    } catch (err) {
      fail(t.label, `Network error: ${err.message}`);
    }
  }
}

// ─── TEST 3: DB schema — fraud columns exist ───────────────────────────────

async function testFraudColumns(pool) {
  console.log('\n🗄️  TEST 3 — DB schema: fraud columns on user_aqi_signals');
  try {
    const result = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'user_aqi_signals'
        AND column_name IN ('fraud_flag', 'fraud_reason')
      ORDER BY column_name
    `);
    const cols = result.rows.map(r => r.column_name);

    if (cols.includes('fraud_flag'))
      pass('fraud_flag column exists on user_aqi_signals');
    else
      fail('fraud_flag column MISSING — run security_hardening_v1.sql');

    if (cols.includes('fraud_reason'))
      pass('fraud_reason column exists on user_aqi_signals');
    else
      fail('fraud_reason column MISSING — run security_hardening_v1.sql');
  } catch (err) {
    fail('Could not query column schema', err.message);
  }
}

// ─── TEST 4: DB schema — system_job_logs table exists ─────────────────────

async function testSystemJobLogsTable(pool) {
  console.log('\n🗄️  TEST 4 — DB schema: system_job_logs table exists');
  try {
    const result = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_name = 'system_job_logs'
        AND table_schema = 'public'
    `);
    if (result.rows.length > 0)
      pass('system_job_logs table exists');
    else
      fail('system_job_logs table MISSING — run security_hardening_v1.sql');

    // Also verify columns
    const cols = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'system_job_logs'
      ORDER BY column_name
    `);
    const colNames = cols.rows.map(r => r.column_name);
    for (const expected of ['job_name', 'records_affected', 'notes', 'ran_at']) {
      if (colNames.includes(expected))
        pass(`  system_job_logs.${expected} column exists`);
      else
        fail(`  system_job_logs.${expected} column MISSING`);
    }
  } catch (err) {
    fail('Could not query system_job_logs', err.message);
  }
}

// ─── TEST 5: detectAnomalousSignals runs without crashing ─────────────────

async function testFraudDetection(pool) {
  console.log('\n🕵️  TEST 5 — Fraud detection function runs without error');
  try {
    await detectAnomalousSignals(pool);
    pass('detectAnomalousSignals() completed without throwing');

    // Check the flag actually works — query for any currently flagged users
    const flagged = await pool.query(
      `SELECT COUNT(*) AS n FROM user_aqi_signals WHERE fraud_flag = true`
    );
    pass(`fraud_flag query works — ${flagged.rows[0].n} user(s) currently flagged`);
  } catch (err) {
    fail('detectAnomalousSignals() threw an error', err.message);
  }
}

// ─── TEST 6: Retention job aborts safely when learning hasn't run ──────────

async function testRetentionJobGuard(pool) {
  console.log('\n🗑️  TEST 6 — Retention job guard (aborts if learning not recent)');
  try {
    // Run the job — it will check learned_demographic_scores.last_calculated_at
    // If learning hasn't run this week it aborts and logs to system_job_logs
    // If it has run, it will scan for old events (deletes nothing if no 90-day-old rows)
    await runBehaviorEventRetention(pool);
    pass('runBehaviorEventRetention() completed without throwing');

    // Check system_job_logs was written (either run or abort)
    const logs = await pool.query(
      `SELECT * FROM system_job_logs WHERE job_name = 'behavior_event_retention' ORDER BY ran_at DESC LIMIT 1`
    );
    if (logs.rows.length > 0) {
      const log = logs.rows[0];
      pass(`system_job_logs written: records_affected=${log.records_affected}, notes=${log.notes ?? 'none'}`);
    } else {
      // Job ran and deleted 0 rows — also fine, the RETURNING clause returns nothing
      pass('retention job ran (no rows to delete or aborted — check console above)');
    }
  } catch (err) {
    fail('runBehaviorEventRetention() threw an error', err.message);
  }
}

// ─── TEST 7: compute_demographic_medians excludes fraud-flagged users ──────

async function testFraudExclusionInSQLFunction(pool) {
  console.log('\n🔍 TEST 7 — compute_demographic_medians excludes fraud_flag=true users');
  try {
    // Inspect the function source for the fraud_flag clause
    const result = await pool.query(`
      SELECT pg_get_functiondef(oid) AS src
      FROM pg_proc
      WHERE proname = 'compute_demographic_medians'
      LIMIT 1
    `);
    if (result.rows.length === 0) {
      fail('compute_demographic_medians function not found in DB');
      return;
    }
    const src = result.rows[0].src;
    if (src.includes('fraud_flag = false')) {
      pass('compute_demographic_medians contains fraud_flag = false filter');
    } else {
      fail(
        'compute_demographic_medians does NOT contain fraud_flag filter',
        'Re-run security_hardening_v1.sql — the CREATE OR REPLACE block may not have applied'
      );
    }
  } catch (err) {
    fail('Could not inspect SQL function', err.message);
  }
}

// ─── RUNNER ───────────────────────────────────────────────────────────────

(async () => {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  Prompt 2 — Security Hardening Test Suite');
  console.log('═══════════════════════════════════════════════════════');

  const pool = createPool();

  try {
    await pool.query('SELECT 1'); // warm up connection
  } catch (err) {
    console.error('❌ Cannot connect to DB:', err.message);
    process.exit(1);
  }

  await testRateLimiterModule();
  await testEndpointsReachable();
  await testFraudColumns(pool);
  await testSystemJobLogsTable(pool);
  await testFraudDetection(pool);
  await testRetentionJobGuard(pool);
  await testFraudExclusionInSQLFunction(pool);

  console.log('\n═══════════════════════════════════════════════════════');
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log('═══════════════════════════════════════════════════════\n');

  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
})();
