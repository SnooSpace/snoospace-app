const express = require('express');
const axios = require('axios');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();

// ─── Step 1: Exchange auth code for tokens ───────────────────────────────────
router.post('/connect', authMiddleware, async (req, res) => {
  const { code, codeVerifier, redirectUri } = req.body;
  const userId = req.user.id;
  const pool = req.app.locals.pool;

  if (!code) {
    return res.status(400).json({ error: 'code is required' });
  }

  try {
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
    const clientRedirectUri = redirectUri || process.env.SPOTIFY_REDIRECT_URI || 'com.snoospace.app://spotify-callback';

    console.log('[Spotify Connect] Exchanging code...', { clientId, clientRedirectUri });

    const params = {
      grant_type: 'authorization_code',
      code,
      redirect_uri: clientRedirectUri,
      client_id: clientId,
    };

    if (codeVerifier) {
      params.code_verifier = codeVerifier;
    } else if (clientSecret) {
      params.client_secret = clientSecret;
    }

    // Exchange code for tokens
    const tokenRes = await axios.post(
      'https://accounts.spotify.com/api/token',
      new URLSearchParams(params),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const { access_token, refresh_token, expires_in } = tokenRes.data;
    const expiresAt = new Date(Date.now() + expires_in * 1000);

    // Get Spotify profile info
    const profileRes = await axios.get('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const { id: spotifyUserId, display_name } = profileRes.data;

    // Upsert into spotify_connections
    await pool.query(
      `INSERT INTO spotify_connections (user_id, spotify_user_id, display_name, access_token, refresh_token, token_expires_at, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, TRUE)
       ON CONFLICT (user_id) DO UPDATE 
       SET spotify_user_id = EXCLUDED.spotify_user_id,
           display_name = EXCLUDED.display_name,
           access_token = EXCLUDED.access_token,
           refresh_token = EXCLUDED.refresh_token,
           token_expires_at = EXCLUDED.token_expires_at,
           is_active = TRUE,
           connected_at = NOW()`,
      [userId, spotifyUserId, display_name, access_token, refresh_token, expiresAt]
    );

    // Update members table flags
    await pool.query(
      'UPDATE members SET spotify_connected = TRUE WHERE id = $1',
      [userId]
    );

    // Sync top artists immediately
    await syncTopArtists(pool, userId, access_token);

    res.json({ success: true, display_name, spotifyUserId });
  } catch (err) {
    console.error('Spotify connect error details:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to connect Spotify' });
  }
});

// ─── Step 2: Sync/refresh top artists ────────────────────────────────────────
router.post('/sync', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const pool = req.app.locals.pool;

  try {
    const accessToken = await getValidAccessToken(pool, userId);
    await syncTopArtists(pool, userId, accessToken);
    res.json({ success: true });
  } catch (err) {
    console.error('Spotify sync error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Step 3: Disconnect ───────────────────────────────────────────────────────
router.delete('/disconnect', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const pool = req.app.locals.pool;

  try {
    await pool.query('DELETE FROM spotify_connections WHERE user_id = $1', [userId]);
    await pool.query('DELETE FROM spotify_top_artists WHERE user_id = $1', [userId]);
    await pool.query(
      'UPDATE members SET spotify_connected = FALSE, spotify_top_artists = NULL WHERE id = $1',
      [userId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Spotify disconnect error:', err.message);
    res.status(500).json({ error: 'Failed to disconnect Spotify' });
  }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function syncTopArtists(pool, userId, accessToken) {
  try {
    const { data } = await axios.get(
      'https://api.spotify.com/v1/me/top/artists?limit=5&time_range=medium_term',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    // Delete existing top artists for user first to avoid rank/conflict issues
    await pool.query('DELETE FROM spotify_top_artists WHERE user_id = $1', [userId]);

    const artistDataList = [];
    const plainArtistNames = [];

    for (let index = 0; index < data.items.length; index++) {
      const artist = data.items[index];
      const imageUrl = artist.images?.[1]?.url ?? artist.images?.[0]?.url ?? null;
      const genres = artist.genres ? artist.genres.slice(0, 3) : [];
      const rank = index + 1;

      await pool.query(
        `INSERT INTO spotify_top_artists (user_id, spotify_artist_id, artist_name, artist_image_url, genres, popularity, rank)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (user_id, rank) DO UPDATE 
         SET spotify_artist_id = EXCLUDED.spotify_artist_id,
             artist_name = EXCLUDED.artist_name,
             artist_image_url = EXCLUDED.artist_image_url,
             genres = EXCLUDED.genres,
             popularity = EXCLUDED.popularity,
             synced_at = NOW()`,
        [userId, artist.id, artist.name, imageUrl, genres, artist.popularity, rank]
      );

      artistDataList.push({
        spotify_artist_id: artist.id,
        artist_name: artist.name,
        artist_image_url: imageUrl,
        genres: genres,
        rank: rank,
      });

      plainArtistNames.push(artist.name);
    }

    // Mirror on the members table for fast query fetching in lists/discover feed
    await pool.query(
      'UPDATE members SET spotify_top_artists = $1 WHERE id = $2',
      [JSON.stringify(artistDataList), userId]
    );

    console.log(`[Spotify Sync] Synced ${artistDataList.length} artists for user ${userId}`);
  } catch (error) {
    console.error('syncTopArtists error details:', error.response?.data || error.message);
    throw error;
  }
}

async function getValidAccessToken(pool, userId) {
  const result = await pool.query(
    'SELECT access_token, refresh_token, token_expires_at FROM spotify_connections WHERE user_id = $1',
    [userId]
  );

  if (result.rows.length === 0) {
    throw new Error('No Spotify connection found');
  }

  const conn = result.rows[0];
  const isExpired = new Date(conn.token_expires_at) < new Date(Date.now() + 60000);

  if (!isExpired) {
    return conn.access_token;
  }

  console.log('[Spotify Token] Token expired, refreshing...');

  // Refresh token request
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  const authHeaderString = clientSecret
    ? 'Basic ' + Buffer.from(clientId + ':' + clientSecret).toString('base64')
    : undefined;

  const requestBody = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: conn.refresh_token,
    client_id: clientId,
  });

  const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
  if (authHeaderString) {
    headers['Authorization'] = authHeaderString;
  }

  const refreshRes = await axios.post(
    'https://accounts.spotify.com/api/token',
    requestBody,
    { headers }
  );

  const { access_token, expires_in, refresh_token: new_refresh_token } = refreshRes.data;
  const expiresAt = new Date(Date.now() + expires_in * 1000);

  const updateFields = [access_token, expiresAt, userId];
  let queryText = 'UPDATE spotify_connections SET access_token = $1, token_expires_at = $2';
  
  if (new_refresh_token) {
    updateFields.splice(2, 0, new_refresh_token);
    queryText += ', refresh_token = $3 WHERE user_id = $4';
  } else {
    queryText += ' WHERE user_id = $3';
  }

  await pool.query(queryText, updateFields);

  return access_token;
}

module.exports = router;
