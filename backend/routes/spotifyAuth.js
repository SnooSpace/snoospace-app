/**
 * Spotify Auth & Profile Routes
 * Handles /api/auth/spotify/* endpoints:
 *   - GET  /connect
 *   - GET  /callback
 *   - POST /sync
 *   - DELETE /disconnect
 *   - GET  /profile
 *   - GET  /users/:userId/public
 */

const express = require('express');
const jwt = require('jsonwebtoken');
const { authMiddleware } = require('../middleware/auth');
const { encrypt } = require('../utils/spotifyTokenCrypto');
const spotifyService = require('../services/spotifyService');
const { syncSpotifyProfile, disconnectSpotify } = require('../services/spotifySync');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const APP_DEEP_LINK_BASE = 'snoospace://spotify-connected';
const SYNC_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes cooldown for manual sync

/**
 * GET /connect
 * Returns authorize URL for mobile app to open in expo-web-browser
 */
router.get('/connect', authMiddleware, (req, res) => {
  const userId = req.user.id;

  try {
    // Generate signed state containing userId for CSRF protection (valid 10 minutes)
    const state = jwt.sign(
      { userId, nonce: Math.random().toString(36).substring(2) },
      JWT_SECRET,
      { expiresIn: '10m' }
    );

    const authorizeUrl = spotifyService.getAuthorizeUrl(state);
    res.json({ authorizeUrl });
  } catch (err) {
    console.error('[Spotify Auth] Connect error:', err);
    res.status(500).json({ error: 'Failed to generate Spotify authorization URL' });
  }
});

/**
 * Renders an authentic callback HTML page matching Spotify's official
 * dark OAuth theme and typography.
 */
function renderCallbackHtml({ isSuccess, deepLinkUrl, message }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>${isSuccess ? 'Spotify Connected' : 'Connection Failed'} | SnooSpace</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@500;600;700;800&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: #121212;
      color: #FFFFFF;
      font-family: 'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 24px 20px;
      text-align: center;
      -webkit-font-smoothing: antialiased;
    }
    .container {
      max-width: 400px;
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .spotify-logo-box {
      width: 68px;
      height: 68px;
      background-color: #242424;
      border-radius: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 20px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    }
    .header-label {
      font-size: 15px;
      font-weight: 600;
      color: #A7A7A7;
      margin-bottom: 4px;
    }
    .header-title {
      font-size: 28px;
      font-weight: 800;
      color: #FFFFFF;
      letter-spacing: -0.6px;
      margin-bottom: 28px;
    }
    .content-card {
      background-color: #1F1F1F;
      border-radius: 16px;
      padding: 20px 22px;
      width: 100%;
      text-align: left;
      margin-bottom: 28px;
    }
    .card-section-title {
      font-size: 15px;
      font-weight: 700;
      color: #FFFFFF;
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .card-check-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background-color: ${isSuccess ? '#1ED760' : '#EF4444'};
      color: #000000;
      flex-shrink: 0;
    }
    .card-check-icon svg {
      width: 11px;
      height: 11px;
      stroke: ${isSuccess ? '#000000' : '#FFFFFF'};
    }
    .bullet-list {
      list-style: none;
      padding-left: 26px;
    }
    .bullet-item {
      position: relative;
      font-size: 13.5px;
      font-weight: 500;
      color: #A7A7A7;
      line-height: 1.5;
      margin-bottom: 6px;
    }
    .bullet-item:last-child {
      margin-bottom: 0;
    }
    .bullet-item::before {
      content: "•";
      position: absolute;
      left: -14px;
      color: #A7A7A7;
    }
    .btn-agree {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      background-color: ${isSuccess ? '#1ED760' : '#2962FF'};
      color: #000000;
      font-family: inherit;
      font-size: 15px;
      font-weight: 700;
      text-decoration: none;
      padding: 15px 24px;
      border-radius: 500px;
      border: none;
      cursor: pointer;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
      transition: transform 0.1s ease, filter 0.15s ease;
    }
    .btn-agree:active {
      transform: scale(0.98);
      filter: brightness(0.92);
    }
    .footer-note {
      font-size: 12px;
      font-weight: 500;
      color: #727272;
      line-height: 1.5;
      margin-top: 24px;
      padding: 0 10px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="spotify-logo-box">
      ${isSuccess ? `
        <!-- Official Spotify Green Logo -->
        <svg viewBox="0 0 24 24" width="38" height="38" fill="#1ED760">
          <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.494 17.306c-.215.353-.674.466-1.027.25-2.82-1.722-6.37-2.112-10.55-1.157-.404.093-.807-.16-.9-.564-.093-.404.16-.807.564-.9 4.568-1.044 8.498-.598 11.663 1.344.353.216.466.674.25 1.027zm1.465-3.26c-.27.441-.85.582-1.291.312-3.23-1.986-8.153-2.56-11.972-1.4-4.96.15-1.002-.144-1.152-.64-.15-.496.144-1.002.64-1.152 4.368-1.325 9.789-.684 13.463 1.58.441.27.582.85.312 1.292zm.126-3.41c-3.874-2.3-10.264-2.513-13.98-1.384-.595.18-1.222-.16-1.402-.755-.18-.595.16-1.222.755-1.402 4.267-1.296 11.313-1.05 15.772 1.597.534.317.708 1.01.391 1.544-.317.534-1.01.708-1.544.391z"/>
        </svg>
      ` : `
        <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="#EF4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="15" y1="9" x2="9" y2="15"></line>
          <line x1="9" y1="9" x2="15" y2="15"></line>
        </svg>
      `}
    </div>

    <div class="header-label">${isSuccess ? 'Spotify connected to:' : 'Connection status:'}</div>
    <h1 class="header-title">SnooSpace</h1>

    <div class="content-card">
      <div class="card-section-title">
        <div class="card-check-icon">
          ${isSuccess ? `
            <svg viewBox="0 0 24 24" fill="none" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          ` : `
            <svg viewBox="0 0 24 24" fill="none" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          `}
        </div>
        <span>${isSuccess ? 'Music profile synced' : 'Connection failed'}</span>
      </div>

      <ul class="bullet-list">
        ${isSuccess ? `
          <li class="bullet-item">Your top artists and tracks are active</li>
          <li class="bullet-item">Social signals enabled on Discover feed</li>
        ` : `
          <li class="bullet-item">${message || 'Unable to authorize with Spotify.'}</li>
        `}
      </ul>
    </div>

    <button class="btn-agree" onclick="handleDone()">
      <span>Done</span>
    </button>

    <div class="footer-note">
      You can remove this connection at any time in your SnooSpace account settings.
    </div>
  </div>

  <script>
    function handleDone() {
      try {
        window.location.href = '${deepLinkUrl}';
      } catch (e) {}
      try {
        window.close();
      } catch (e) {}
    }
  </script>
</body>
</html>`;
}

/**
 * GET /callback
 * Spotify OAuth callback redirect URL
 */
router.get('/callback', async (req, res) => {
  const { code, state, error, error_description } = req.query;
  const pool = req.app.locals.pool;

  // Handle Spotify-level error / user cancellation
  if (error) {
    console.warn('[Spotify Auth] Callback returned error:', error, error_description);
    const reason = error_description || error;
    const deepLinkUrl = `${APP_DEEP_LINK_BASE}?status=error&reason=${encodeURIComponent(reason)}`;
    return res.status(200).set('Content-Type', 'text/html').send(
      renderCallbackHtml({
        isSuccess: false,
        deepLinkUrl,
        message: reason || 'Spotify access was denied.',
      })
    );
  }

  if (!code || !state) {
    console.warn('[Spotify Auth] Callback missing code or state');
    const deepLinkUrl = `${APP_DEEP_LINK_BASE}?status=error&reason=missing_code_or_state`;
    return res.status(200).set('Content-Type', 'text/html').send(
      renderCallbackHtml({
        isSuccess: false,
        deepLinkUrl,
        message: 'Missing authorization code or state.',
      })
    );
  }

  let userId;
  try {
    const decoded = jwt.verify(state, JWT_SECRET);
    userId = decoded.userId;
  } catch (jwtErr) {
    console.error('[Spotify Auth] Invalid state token:', jwtErr.message);
    const deepLinkUrl = `${APP_DEEP_LINK_BASE}?status=error&reason=invalid_state`;
    return res.status(200).set('Content-Type', 'text/html').send(
      renderCallbackHtml({
        isSuccess: false,
        deepLinkUrl,
        message: 'Session state expired or invalid. Please try connecting again.',
      })
    );
  }

  try {
    // 1. Exchange code for access & refresh tokens
    const tokenData = await spotifyService.exchangeCodeForTokens(code);
    const { access_token, refresh_token, expires_in, scope } = tokenData;

    // 2. Fetch Spotify user profile info
    const spotifyProfile = await spotifyService.getSpotifyProfile(access_token);
    const spotifyUserId = spotifyProfile.id;

    // 3. Encrypt tokens for secure storage at rest
    const encryptedAccess = encrypt(access_token);
    const encryptedRefresh = encrypt(refresh_token);
    const expiresAt = new Date(Date.now() + expires_in * 1000);
    const scopes = scope || process.env.SPOTIFY_SCOPES || 'user-top-read';

    // 4. Upsert connection record
    await pool.query(
      `INSERT INTO spotify_connections (
         user_id,
         spotify_user_id,
         access_token_encrypted,
         refresh_token_encrypted,
         token_expires_at,
         scopes,
         connected_at,
         last_synced_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       ON CONFLICT (user_id) DO UPDATE
       SET spotify_user_id = EXCLUDED.spotify_user_id,
           access_token_encrypted = EXCLUDED.access_token_encrypted,
           refresh_token_encrypted = EXCLUDED.refresh_token_encrypted,
           token_expires_at = EXCLUDED.token_expires_at,
           scopes = EXCLUDED.scopes,
           connected_at = NOW()`,
      [userId, spotifyUserId, encryptedAccess, encryptedRefresh, expiresAt, scopes]
    );

    // 5. Initial sync of top artists and top tracks
    try {
      await syncSpotifyProfile(userId, pool);
    } catch (syncErr) {
      console.warn('[Spotify Auth] Initial sync had warnings:', syncErr.message);
    }

    // 6. Respond with branded success HTML page that auto-redirects to deep link
    const deepLinkUrl = `${APP_DEEP_LINK_BASE}?status=success`;
    return res.status(200).set('Content-Type', 'text/html').send(
      renderCallbackHtml({
        isSuccess: true,
        deepLinkUrl,
        message: 'Your top artists and tracks are now linked with SnooSpace.',
      })
    );
  } catch (err) {
    console.error('[Spotify Auth] Exchange & connect error:', err);
    const reason = err.message || 'connection_failed';
    const deepLinkUrl = `${APP_DEEP_LINK_BASE}?status=error&reason=${encodeURIComponent(reason)}`;
    return res.status(200).set('Content-Type', 'text/html').send(
      renderCallbackHtml({
        isSuccess: false,
        deepLinkUrl,
        message: err.message || 'Failed to complete Spotify connection.',
      })
    );
  }
});

/**
 * POST /sync
 * Manually trigger a refresh/sync of Spotify top items
 */
router.post('/sync', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const pool = req.app.locals.pool;
  const force = req.query.force === 'true';

  try {
    // Check cooldown unless force is specified
    if (!force) {
      const lastSyncRes = await pool.query(
        'SELECT last_synced_at FROM spotify_connections WHERE user_id = $1',
        [userId]
      );

      if (lastSyncRes.rows.length === 0) {
        return res.status(404).json({ error: 'No Spotify connection found' });
      }

      const lastSyncedAt = lastSyncRes.rows[0].last_synced_at;
      if (lastSyncedAt && (Date.now() - new Date(lastSyncedAt).getTime()) < SYNC_COOLDOWN_MS) {
        // Return existing profile if under cooldown
        const profRes = await pool.query(
          'SELECT top_artists, top_tracks, last_synced_at FROM spotify_profile WHERE user_id = $1',
          [userId]
        );
        return res.json({
          success: true,
          cached: true,
          profile: profRes.rows[0] || { top_artists: [], top_tracks: [] },
        });
      }
    }

    const result = await syncSpotifyProfile(userId, pool);
    res.json(result);
  } catch (err) {
    console.error('[Spotify Auth] Sync error:', err.message);
    const status = err.status || 500;
    res.status(status).json({
      error: err.message || 'Failed to sync Spotify profile',
      isRevoked: !!err.isRevoked,
    });
  }
});

/**
 * DELETE /disconnect
 * Disconnects Spotify account and cleans up stored tokens and top items
 */
router.delete('/disconnect', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const pool = req.app.locals.pool;

  try {
    const result = await disconnectSpotify(userId, pool);
    res.json(result);
  } catch (err) {
    console.error('[Spotify Auth] Disconnect error:', err.message);
    res.status(500).json({ error: 'Failed to disconnect Spotify' });
  }
});

/**
 * GET /profile
 * Returns authenticated user's current Spotify connection status and top items
 */
router.get('/profile', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const pool = req.app.locals.pool;

  try {
    const connRes = await pool.query(
      'SELECT id, spotify_user_id, connected_at, last_synced_at FROM spotify_connections WHERE user_id = $1',
      [userId]
    );

    if (connRes.rows.length === 0) {
      return res.json({
        connected: false,
        top_artists: [],
        top_tracks: [],
      });
    }

    const profRes = await pool.query(
      'SELECT top_artists, top_tracks, time_range, last_synced_at FROM spotify_profile WHERE user_id = $1',
      [userId]
    );

    const prof = profRes.rows[0] || {};

    res.json({
      connected: true,
      spotify_user_id: connRes.rows[0].spotify_user_id,
      connected_at: connRes.rows[0].connected_at,
      last_synced_at: prof.last_synced_at || connRes.rows[0].last_synced_at,
      top_artists: prof.top_artists || [],
      top_tracks: prof.top_tracks || [],
      time_range: prof.time_range || 'medium_term',
    });
  } catch (err) {
    console.error('[Spotify Auth] Get profile error:', err.message);
    res.status(500).json({ error: 'Failed to get Spotify profile' });
  }
});

/**
 * GET /users/:userId/public
 * Public endpoint to fetch any user's top artists/tracks for discover profile
 */
router.get('/users/:userId/public', async (req, res) => {
  const { userId } = req.params;
  const pool = req.app.locals.pool;

  try {
    const profRes = await pool.query(
      'SELECT top_artists, top_tracks, time_range, last_synced_at FROM spotify_profile_public WHERE user_id = $1',
      [userId]
    );

    if (profRes.rows.length === 0) {
      return res.json({
        connected: false,
        top_artists: [],
        top_tracks: [],
      });
    }

    const prof = profRes.rows[0];
    res.json({
      connected: true,
      top_artists: prof.top_artists || [],
      top_tracks: prof.top_tracks || [],
      time_range: prof.time_range || 'medium_term',
      last_synced_at: prof.last_synced_at,
    });
  } catch (err) {
    console.error('[Spotify Auth] Get public profile error:', err.message);
    res.status(500).json({ error: 'Failed to fetch public Spotify profile' });
  }
});

module.exports = router;
