/**
 * ==============================================================================
 * SnooSpace Home Feed Load Test (k6)
 * Endpoint: GET /api/posts/feed
 * ==============================================================================
 * 
 * ⚠️  CRITICAL SAFETY NOTICE & OPERATIONAL CONSTRAINTS:
 * ------------------------------------------------------------------------------
 * 1. TARGET ENVIRONMENT:
 *    This test connects to the live production deployment / database. There is
 *    NO separate staging database.
 * 
 * 2. BASE_URL REQUIREMENT:
 *    BASE_URL must be explicitly passed via `-e BASE_URL=...`.
 *    There is intentionally NO default fallback URL to prevent accidental runs.
 *    Example:
 *      k6 run -e BASE_URL=http://localhost:5000 loadtest/feed_test.js
 *      or against production server:
 *      k6 run -e BASE_URL=https://api.yourdomain.com loadtest/feed_test.js
 * 
 * 3. PREREQUISITES:
 *    - Migration 075 must be applied: `node scripts/run_075_load_test_marker_migration.js`
 *    - Synthetic test data must be seeded: `node scripts/seedLoadTestData.js`
 *    - Tokens must be generated: `node scripts/generateLoadTestTokens.js`
 * 
 * 4. POST-TEST CLEANUP:
 *    Always run the cleanup script immediately after load testing finishes:
 *      node scripts/cleanupLoadTestData.js
 * 
 * 5. RECOMMENDED SMOKE-TEST WORKFLOW:
 *    Before executing the full 2,000-VU ramp, run a smoke test by temporarily
 *    commenting out stages > 500 VUs:
 *      Stage 1: 100 VUs
 *      Stage 2: 500 VUs
 *    Verify server response latency and error rates before full scale testing.
 * ==============================================================================
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { Rate, Counter } from 'k6/metrics';

// ── Environment Configuration ────────────────────────────────────────────────
const BASE_URL = __ENV.BASE_URL;

if (!BASE_URL) {
  throw new Error(
    '\n❌ ERROR: BASE_URL environment variable is required!\n' +
    'Usage example:\n' +
    '  k6 run -e BASE_URL=http://localhost:5000 loadtest/feed_test.js\n'
  );
}

// ── Custom Failure Metrics ───────────────────────────────────────────────────
const authFailures = new Rate('auth_failures');
const serverErrors = new Rate('server_errors');
const successfulRequests = new Counter('successful_feed_requests');

// ── Load Test Tokens (Shared in-memory across all VUs) ────────────────────────
const tokens = new SharedArray('load_test_tokens', function () {
  const raw = open('./loadtest_tokens.json');
  const data = JSON.parse(raw);
  if (!data || data.length === 0) {
    throw new Error('No tokens found in loadtest_tokens.json. Run `node scripts/generateLoadTestTokens.js` first.');
  }
  return data;
});

// ── Test Execution Configuration (Smoke Test: 100 → 500 VUs) ────────────────
export const options = {
  stages: [
    { duration: '30s', target: 100 },   // Warm-up ramp to 100 VUs
    { duration: '30s', target: 500 },   // Scale to 500 VUs
    { duration: '30s', target: 500 },   // Hold at 500 VUs
    { duration: '15s', target: 0 },     // Graceful ramp-down
    // ── Full 2,000-VU Scale (Uncomment for full load test) ──
    // { duration: '30s', target: 1000 },
    // { duration: '30s', target: 2000 },
    // { duration: '1m',  target: 2000 },
    // { duration: '30s', target: 0 },
  ],
  thresholds: {
    // 95% of feed queries must respond under 1000ms
    http_req_duration: ['p(95)<1000'],
    // Overall HTTP error rate must be strictly under 1%
    http_req_failed: ['rate<0.01'],
    // Zero tolerance for auth failures
    auth_failures: ['rate<0.001'],
    // Server errors (5xx) must remain under 1%
    server_errors: ['rate<0.01'],
  },
};

// ── Virtual User Scenario ────────────────────────────────────────────────────
export default function () {
  // Pin each VU to a unique synthetic member token from the pool (no mid-test rotation)
  const tokenIndex = (__VU - 1) % tokens.length;
  const userToken = tokens[tokenIndex].token;

  const baseUrlClean = BASE_URL.replace(/\/$/, '');
  const url = baseUrlClean.endsWith('/posts/feed')
    ? baseUrlClean
    : `${baseUrlClean}/posts/feed`;
  const params = {
    headers: {
      'Authorization': `Bearer ${userToken}`,
      'Accept': 'application/json',
      'User-Agent': 'k6-load-test/1.0',
    },
    tags: {
      name: 'GetHomeFeed',
    },
    timeout: '10s',
  };

  // READ-ONLY: Single GET request to Home Feed (first page)
  const res = http.get(url, params);

  // Status checks & granular failure tracking
  const is200 = res.status === 200;
  const isAuthError = res.status === 401 || res.status === 403;
  const isServerError = res.status >= 500;

  authFailures.add(isAuthError);
  serverErrors.add(isServerError);

  const passed = check(res, {
    'status is 200': (r) => r.status === 200,
    'response body is not empty': (r) => r.body && r.body.length > 0,
    'response has valid JSON': (r) => {
      try {
        const json = JSON.parse(r.body);
        return json && (Array.isArray(json.posts) || Array.isArray(json));
      } catch (e) {
        return false;
      }
    },
  });

  if (passed) {
    successfulRequests.add(1);
  } else if (!is200) {
    console.warn(`[VU ${__VU}] Request failed: status=${res.status}, body=${res.body ? res.body.substring(0, 120) : 'empty'}`);
  }

  // Realistic human think time / scroll pause between feed requests (1 to 2 seconds)
  sleep(1 + Math.random());
}
