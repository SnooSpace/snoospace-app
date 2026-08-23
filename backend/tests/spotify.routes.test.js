/**
 * Spotify Routes & Auth Flow Verification Test
 * Run with: node tests/spotify.routes.test.js
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const assert = require('assert');
const express = require('express');
const http = require('http');
const jwt = require('jsonwebtoken');
const spotifyAuthRouter = require('../routes/spotifyAuth');
const { createPool } = require('../config/db');

async function runRouteTests() {
  console.log('🧪 Starting Spotify Route Endpoint Tests...\n');
  const pool = createPool();
  const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

  // Generate a valid JWT token for auth header
  const testToken = jwt.sign(
    { userId: 1, userType: 'member', email: 'test@snoospace.in' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
  const authHeaders = { Authorization: `Bearer ${testToken}` };

  const app = express();
  app.use(express.json());
  app.locals.pool = pool;

  app.use('/api/auth/spotify', spotifyAuthRouter);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api/auth/spotify`;

  try {
    // 1. Test /connect
    console.log('Testing GET /connect with Bearer token...');
    const connectRes = await fetch(`${baseUrl}/connect`, { headers: authHeaders });
    const connectData = await connectRes.json();
    assert.strictEqual(connectRes.status, 200);
    assert.ok(connectData.authorizeUrl, 'Must return authorizeUrl');
    assert.ok(connectData.authorizeUrl.includes('client_id='), 'authorizeUrl must have client_id');
    assert.ok(connectData.authorizeUrl.includes('state='), 'authorizeUrl must have state');
    console.log('  ✅ GET /connect returned valid authorizeUrl with signed state');

    // 2. Test /callback with error param (user denied)
    console.log('Testing GET /callback with error param...');
    const errCallbackRes = await fetch(`${baseUrl}/callback?error=access_denied`);
    assert.strictEqual(errCallbackRes.status, 200);
    const errHtml = await errCallbackRes.text();
    assert.ok(errHtml.includes('snoospace://spotify-connected?status=error'), 'Must contain deep link in HTML');
    assert.ok(errHtml.includes('Connection Failed'), 'Must show error message in HTML');
    console.log('  ✅ GET /callback handles error with branded HTML and auto-redirect');

    // 3. Test /callback with invalid state
    console.log('Testing GET /callback with invalid state...');
    const badStateRes = await fetch(`${baseUrl}/callback?code=sample_code&state=invalid_jwt_state`);
    assert.strictEqual(badStateRes.status, 200);
    const badStateHtml = await badStateRes.text();
    assert.ok(badStateHtml.includes('snoospace://spotify-connected?status=error'), 'Must contain deep link in HTML');
    assert.ok(badStateHtml.includes('Session state expired or invalid'), 'Must show invalid state message');
    console.log('  ✅ GET /callback rejects tampered state with branded HTML');

    // 4. Test /profile
    console.log('Testing GET /profile with Bearer token...');
    const profileRes = await fetch(`${baseUrl}/profile`, { headers: authHeaders });
    assert.strictEqual(profileRes.status, 200);
    const profileData = await profileRes.json();
    assert.ok(typeof profileData.connected === 'boolean', 'Profile must contain boolean connected flag');
    assert.ok(Array.isArray(profileData.top_artists), 'Profile must contain top_artists array');
    assert.ok(Array.isArray(profileData.top_tracks), 'Profile must contain top_tracks array');
    console.log('  ✅ GET /profile returns structured response');

    // 5. Test /users/:userId/public (no auth needed)
    console.log('Testing GET /users/1/public...');
    const publicRes = await fetch(`${baseUrl}/users/1/public`);
    assert.strictEqual(publicRes.status, 200);
    const publicData = await publicRes.json();
    assert.ok(typeof publicData.connected === 'boolean');
    assert.ok(Array.isArray(publicData.top_artists));
    console.log('  ✅ GET /users/1/public returns public profile');

    console.log('\n========================================');
    console.log('All Route Tests Passed!');
    console.log('========================================\n');
  } finally {
    server.close();
    await pool.end();
  }
}

runRouteTests().catch(err => {
  console.error('Route tests failed:', err);
  process.exit(1);
});
