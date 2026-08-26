/**
 * ==============================================================================
 * SnooSpace Home Feed Load Test — Diagnostic Scale (10 → 50 VUs)
 * Endpoint: GET /posts/feed
 * ==============================================================================
 * 
 * 🔬 DIAGNOSTIC PURPOSE & CONTEXT:
 * ------------------------------------------------------------------------------
 * This diagnostic variant runs at a controlled, small concurrency scale (10 → 50 VUs)
 * to isolate whether the timeouts observed at 500 VUs persist at low concurrency.
 * 
 * Granular Network Instrumentation:
 * Tracks and reports specific sub-phases of the HTTP lifecycle via k6 Trend metrics:
 *   - TCP Connection time (`res.timings.connecting`)
 *   - TLS Handshake time (`res.timings.tls_handshaking`)
 *   - Server TTFB / Processing time (`res.timings.waiting`)
 *   - Client Socket Blocked time (`res.timings.blocked`)
 * 
 * Operational Constraints:
 *   - Targets live deployment (Railway / Production)
 *   - BASE_URL must be explicitly passed via `-e BASE_URL=...`
 *   - Requires synthetic data & tokens (is_load_test = true)
 * 
 * Usage:
 *   k6 run -e BASE_URL=https://snoospace-app-production.up.railway.app loadtest/feed_test_small.js
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
    '  k6 run -e BASE_URL=https://snoospace-app-production.up.railway.app loadtest/feed_test_small.js\n'
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

// ── Test Execution Configuration (Diagnostic Scale: 10 → 50 VUs) ─────────────
export const options = {
  stages: [
    { duration: '20s', target: 10 },   // Warm-up ramp to 10 VUs
    { duration: '20s', target: 25 },   // Ramp to 25 VUs
    { duration: '20s', target: 50 },   // Ramp to 50 VUs
    { duration: '30s', target: 50 },   // Hold at peak (50 VUs)
    { duration: '15s', target: 0 },    // Graceful ramp-down
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
      'User-Agent': 'k6-load-test-diagnostic/1.0',
    },
    tags: {
      name: 'GetHomeFeedDiagnostic',
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
    console.warn(`[VU ${__VU}] Request failed: status=${res.status}, body=${res.body ? res.body.substring(0, 120) : 'empty'}`);
  }

  // Realistic human think time / scroll pause between feed requests (1 to 2 seconds)
  sleep(1 + Math.random());
}
