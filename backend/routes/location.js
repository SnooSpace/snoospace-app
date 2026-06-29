/**
 * routes/location.js
 *
 * Backend proxy for Mappls (MapmyIndia) location APIs.
 * Keeps MAPPLS_CLIENT_SECRET off the client bundle.
 *
 * All routes require an authenticated user (authMiddleware).
 * The OAuth token is cached in memory for 24 h and refreshed 5 min early.
 *
 * Routes exposed:
 *   GET /api/location/search?q=&lat=&lng=&region=
 *   GET /api/location/place/:eLoc
 *   GET /api/location/nearby?lat=&lng=&radius=&category=
 *   GET /api/location/reverse?lat=&lng=
 */

const express = require('express');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// ── Mappls credentials (server-side only — never sent to client) ──────────────
const MAPPLS_CLIENT_ID     = process.env.MAPPLS_CLIENT_ID;
const MAPPLS_CLIENT_SECRET = process.env.MAPPLS_CLIENT_SECRET;
const OUTPOST_BASE = 'https://outpost.mappls.com/api/security/oauth/token';
const ATLAS_BASE   = 'https://atlas.mappls.com/api/places';
const EXPLORE_BASE = 'https://explore.mappls.com/apis';

// ── In-memory token cache ─────────────────────────────────────────────────────
let _token       = null;
let _tokenExpiry = null;

async function getMapplsToken() {
  if (_token && Date.now() < _tokenExpiry) return _token;

  if (!MAPPLS_CLIENT_ID || !MAPPLS_CLIENT_SECRET) {
    throw new Error('MAPPLS_CLIENT_ID / MAPPLS_CLIENT_SECRET not set in backend .env');
  }

  const res = await fetch(OUTPOST_BASE, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'client_credentials',
      client_id:     MAPPLS_CLIENT_ID,
      client_secret: MAPPLS_CLIENT_SECRET,
    }).toString(),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Mappls token fetch failed: ${res.status} ${body}`);
  }

  const data   = await res.json();
  _token       = data.access_token;
  _tokenExpiry = Date.now() + ((data.expires_in ?? 86400) - 300) * 1000;
  console.log('[LocationProxy] Mappls token refreshed, expires in', data.expires_in, 's');
  return _token;
}

// ── Helper: forward Mappls API error as a clean JSON response ─────────────────
function mapplsError(res, status, message) {
  const level = status >= 500 ? 'error' : 'warn';
  console[level]('[LocationProxy]', message);
  return res.status(502).json({ error: message });
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/location/search
// Proxies Mappls Autosuggest API.
// Query params: q (required), lat, lng, region (default IND)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/api/location/search', authMiddleware, async (req, res) => {
  const { q, lat, lng, region = 'IND' } = req.query;
  if (!q) return res.status(400).json({ error: 'q is required' });

  try {
    const token  = await getMapplsToken();
    const params = new URLSearchParams({ query: q, region });
    if (lat && lng) params.set('location', `${lat},${lng}`);

    const upstream = await fetch(`${ATLAS_BASE}/search/json?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!upstream.ok) {
      return mapplsError(res, upstream.status, `Mappls search ${upstream.status}`);
    }

    const data = await upstream.json();
    return res.json(data);
  } catch (err) {
    console.error('[LocationProxy] /search error:', err.message);
    return res.status(500).json({ error: 'Location search failed' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/location/place/:eLoc
// Proxies Mappls Place Details (O2O entity) API.
// Falls back to the Atlas geocode endpoint if O2O returns RESTRICTED.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/api/location/place/:eLoc', authMiddleware, async (req, res) => {
  const { eLoc } = req.params;
  if (!eLoc) return res.status(400).json({ error: 'eLoc is required' });

  try {
    const token    = await getMapplsToken();
    const upstream = await fetch(
      `${EXPLORE_BASE}/O2O/entity/${encodeURIComponent(eLoc)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    if (!upstream.ok) {
      const statusMap = {
        401: 'Mappls token rejected (401)',
        403: 'Place Details API not enabled in Mappls Console (403)',
        404: 'Place not found or plan does not include Place Details (404)',
      };
      const msg = statusMap[upstream.status] ?? `Mappls place detail ${upstream.status}`;
      return mapplsError(res, upstream.status, msg);
    }

    const data   = await upstream.json();
    const rawLat = data.latitude ?? data.lat;
    const rawLng = data.longitude ?? data.lng;

    if (rawLat === 'RESTRICTED' || rawLng === 'RESTRICTED') {
      // Free-plan: coordinates are gated. Return the rest of the place data
      // so the client can fall back to Google Geocoding on its side.
      console.warn('[LocationProxy] Place Detail coords RESTRICTED for', eLoc, '(free plan)');
      return res.json({ ...data, _coordsRestricted: true });
    }

    return res.json(data);
  } catch (err) {
    console.error('[LocationProxy] /place error:', err.message);
    return res.status(500).json({ error: 'Place detail lookup failed' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/location/nearby
// Proxies Mappls Nearby API.
// Query params: lat (required), lng (required), radius (m), category
// ─────────────────────────────────────────────────────────────────────────────
router.get('/api/location/nearby', authMiddleware, async (req, res) => {
  const { lat, lng, radius = '2000', category = 'all' } = req.query;
  if (!lat || !lng) return res.status(400).json({ error: 'lat and lng are required' });

  try {
    const token  = await getMapplsToken();
    const params = new URLSearchParams({
      keywords:    category,
      refLocation: `${lat},${lng}`,
      radius,
      region:  'IND',
      sortBy:  'distance',
      page:    '1',
      size:    '20',
    });

    const upstream = await fetch(`${ATLAS_BASE}/nearby/json?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!upstream.ok) {
      return mapplsError(res, upstream.status, `Mappls nearby ${upstream.status}`);
    }

    const data = await upstream.json();
    return res.json(data);
  } catch (err) {
    console.error('[LocationProxy] /nearby error:', err.message);
    return res.status(500).json({ error: 'Nearby search failed' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/location/reverse
// Proxies Mappls Reverse Geocoding API.
// Query params: lat (required), lng (required)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/api/location/reverse', authMiddleware, async (req, res) => {
  const { lat, lng } = req.query;
  if (!lat || !lng) return res.status(400).json({ error: 'lat and lng are required' });

  try {
    const token    = await getMapplsToken();
    const params   = new URLSearchParams({ lat, lng });
    const upstream = await fetch(`${ATLAS_BASE}/revegeocoding/json?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!upstream.ok) {
      return mapplsError(res, upstream.status, `Mappls reverse geocode ${upstream.status}`);
    }

    const data = await upstream.json();
    return res.json(data);
  } catch (err) {
    console.error('[LocationProxy] /reverse error:', err.message);
    return res.status(500).json({ error: 'Reverse geocoding failed' });
  }
});

module.exports = router;
