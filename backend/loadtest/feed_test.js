/**
 * ==============================================================================
 * SnooSpace Home Feed Load Test (k6) — Full Scale (100 → 2,000 VUs)
 * Endpoint: GET /posts/feed
 * ==============================================================================
 * 
 * ⚠️  CRITICAL SAFETY NOTICE & OPERATIONAL CONSTRAINTS:
 * ------------------------------------------------------------------------------
 * 1. TARGET ENVIRONMENT:
 *    This test connects to the live production deployment / database.
 * 
 * 2. BASE_URL REQUIREMENT:
 *    BASE_URL must be explicitly passed via `-e BASE_URL=...`.
 *    Example:
 *      k6 run -e BASE_URL=https://snoospace-app-production.up.railway.app loadtest/feed_test.js
 * 
 * 3. PREREQUISITES:
 *    - Synthetic test data seeded (is_load_test = true)
 *    - Tokens generated in loadtest_tokens.json
 * ==============================================================================
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { Rate, Counter, Trend } from 'k6/metrics';

// ── Environment Configuration ────────────────────────────────────────────────
const BASE_URL = __ENV.BASE_URL;

if (!BASE_URL) {
  throw new Error(
    '\n❌ ERROR: BASE_URL environment variable is required!\n' +
    'Usage example:\n' +
    '  k6 run -e BASE_URL=https://snoospace-app-production.up.railway.app loadtest/feed_test.js\n'
  );
}

// ── Custom Failure & Success Metrics ─────────────────────────────────────────
const authFailures = new Rate('auth_failures');
const serverErrors = new Rate('server_errors');
const successfulRequests = new Counter('successful_feed_requests');

// ── Detailed Network & Protocol Timing Metrics ───────────────────────────────
const tcpConnectTime = new Trend('net_tcp_connecting_ms');
const tlsHandshakeTime = new Trend('net_tls_handshaking_ms');
const serverWaitTime = new Trend('net_server_waiting_ttfb_ms');
const socketBlockedTime = new Trend('net_socket_blocked_ms');

// ── Load Test Tokens (Shared in-memory across all VUs) ────────────────────────
const tokens = new SharedArray('load_test_tokens', function () {
  const raw = open('./loadtest_tokens.json');
  const data = JSON.parse(raw);
  if (!data || data.length === 0) {
    throw new Error('No tokens found in loadtest_tokens.json. Run `node scripts/generateLoadTestTokens.js` first.');
  }
  return data;
});

// ── Test Execution Configuration (Full Scale: 100 → 2,000 VUs) ───────────────
export const options = {
  stages: [
    { duration: '30s', target: 100 },   // Warm-up ramp to 100 VUs
    { duration: '30s', target: 500 },   // Scale to 500 VUs
    { duration: '30s', target: 1000 },  // Scale to 1,000 VUs
    { duration: '30s', target: 2000 },  // Scale to 2,000 VUs peak
    { duration: '1m',  target: 2000 },  // Sustain at peak (2,000 VUs)
    { duration: '30s', target: 0 },     // Graceful ramp-down
  ],
  thresholds: {
    // 95% of feed queries must respond under 1500ms
    http_req_duration: ['p(95)<1500'],
    // Overall HTTP error rate must be strictly under 5%
    http_req_failed: ['rate<0.05'],
    // Zero tolerance for auth failures
    auth_failures: ['rate<0.001'],
    // Server errors (5xx) must remain under 5%
    server_errors: ['rate<0.05'],
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
      'User-Agent': 'k6-load-test-full/1.0',
    },
    tags: {
      name: 'GetHomeFeedFullScale',
    },
    timeout: '10s',
  };

  // READ-ONLY: Single GET request to Home Feed (first page)
  const res = http.get(url, params);

  // Record granular timing phases from k6 http response
  if (res.timings) {
    if (res.timings.connecting > 0) {
      tcpConnectTime.add(res.timings.connecting);
    }
    if (res.timings.tls_handshaking > 0) {
      tlsHandshakeTime.add(res.timings.tls_handshaking);
    }
    if (res.timings.waiting > 0) {
      serverWaitTime.add(res.timings.waiting);
    }
    if (res.timings.blocked > 0) {
      socketBlockedTime.add(res.timings.blocked);
    }
  }

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
    console.warn(
      `[VU ${__VU}] Request failed: status=${res.status} error=${res.error} error_code=${res.error_code} body=${(res.body || '').substring(0, 100)}`
    );
  }

  // Pacing: 1s sleep between feed page requests
  sleep(1);
}
