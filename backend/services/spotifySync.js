/**
 * Spotify Sync Service
 * Handles fetching, refreshing tokens, data sanitization, and database persistence
 * for Spotify top artists and top tracks.
 */

const { encrypt, decrypt } = require('../utils/spotifyTokenCrypto');
const spotifyService = require('./spotifyService');

const EXPIRY_BUFFER_MS = 5 * 60 * 1000; // 5 minutes buffer for token expiration

/**
 * Maps raw Spotify artist item to compact schema
 */
function mapArtistItem(artist, index) {
  return {
    id: artist.id,
    name: artist.name,
    image_url: artist.images?.[1]?.url || artist.images?.[0]?.url || null,
    spotify_url: artist.external_urls?.spotify || `https://open.spotify.com/artist/${artist.id}`,
    rank: index + 1,
    genres: (artist.genres || []).slice(0, 3),
    popularity: artist.popularity || 0,
  };
}

/**
 * Maps raw Spotify track item to compact schema
 */
function mapTrackItem(track, index) {
  return {
    id: track.id,
    name: track.name,
    artist_name: (track.artists || []).map(a => a.name).join(', '),
    image_url: track.album?.images?.[1]?.url || track.album?.images?.[0]?.url || null,
    spotify_url: track.external_urls?.spotify || `https://open.spotify.com/track/${track.id}`,
    rank: index + 1,
    preview_url: track.preview_url || null,
  };
}

/**
 * Synchronizes a user's Spotify profile (top artists and top tracks)
 * @param {number|string} userId Database user ID (members.id)
 * @param {import('pg').Pool} pool PostgreSQL pool instance
 * @param {object} [options]
 * @param {string} [options.timeRange='medium_term']
 * @param {number} [options.limit=10]
 * @returns {Promise<{ success: boolean, top_artists: Array, top_tracks: Array, last_synced_at: Date }>}
 */
async function syncSpotifyProfile(userId, pool, options = {}) {
  const timeRange = options.timeRange || 'medium_term';
  const limit = options.limit || 10;

  // 1. Fetch connection details
  const connRes = await pool.query(
    `SELECT access_token_encrypted, refresh_token_encrypted, token_expires_at, scopes
     FROM spotify_connections
     WHERE user_id = $1`,
    [userId]
  );

  if (connRes.rows.length === 0) {
    const err = new Error('No Spotify connection found for user');
    err.status = 404;
    throw err;
  }

  const conn = connRes.rows[0];
  let accessToken;
  let refreshToken;

  try {
    accessToken = decrypt(conn.access_token_encrypted);
    refreshToken = decrypt(conn.refresh_token_encrypted);
  } catch (cryptoErr) {
    console.error(`[Spotify Sync] Decryption failed for user ${userId}:`, cryptoErr.message);
    throw new Error('Failed to decrypt stored Spotify credentials');
  }

  // 2. Token refresh check (if expiring within 5 minutes or already expired)
  const isExpiringSoon = new Date(conn.token_expires_at).getTime() <= (Date.now() + EXPIRY_BUFFER_MS);

  if (isExpiringSoon) {
    console.log(`[Spotify Sync] Token expiring/expired for user ${userId}, refreshing...`);
    try {
      const refreshResult = await spotifyService.refreshAccessToken(refreshToken);
      accessToken = refreshResult.access_token;
      
      const newExpiresAt = new Date(Date.now() + refreshResult.expires_in * 1000);
      const newEncryptedAccess = encrypt(accessToken);

      if (refreshResult.refresh_token) {
        refreshToken = refreshResult.refresh_token;
        const newEncryptedRefresh = encrypt(refreshToken);
        await pool.query(
          `UPDATE spotify_connections
           SET access_token_encrypted = $1,
               refresh_token_encrypted = $2,
               token_expires_at = $3
           WHERE user_id = $4`,
          [newEncryptedAccess, newEncryptedRefresh, newExpiresAt, userId]
        );
      } else {
        await pool.query(
          `UPDATE spotify_connections
           SET access_token_encrypted = $1,
               token_expires_at = $2
           WHERE user_id = $3`,
          [newEncryptedAccess, newExpiresAt, userId]
        );
      }
      console.log(`[Spotify Sync] Token refreshed successfully for user ${userId}`);
    } catch (refreshErr) {
      console.error(`[Spotify Sync] Token refresh failed for user ${userId}:`, refreshErr.message);
      
      // If refresh token was revoked / invalid_grant (400)
      if (refreshErr.status === 400 || refreshErr.spotifyError?.error === 'invalid_grant') {
        console.warn(`[Spotify Sync] Spotify grant revoked for user ${userId}. Deleting connection...`);
        await disconnectSpotify(userId, pool);
        const revokedErr = new Error('Spotify connection has expired or was revoked. Please reconnect your account.');
        revokedErr.isRevoked = true;
        revokedErr.status = 401;
        throw revokedErr;
      }
      throw refreshErr;
    }
  }

  // 3. Fetch top artists and top tracks in parallel
  let rawArtists = [];
  let rawTracks = [];

  try {
    [rawArtists, rawTracks] = await Promise.all([
      spotifyService.fetchTopArtists(accessToken, timeRange, limit),
      spotifyService.fetchTopTracks(accessToken, timeRange, limit),
    ]);
  } catch (fetchErr) {
    console.error(`[Spotify Sync] Error fetching top items for user ${userId}:`, fetchErr.message);
    throw fetchErr;
  }

  // 4. Map to clean minimal payload
  const topArtists = rawArtists.map(mapArtistItem);
  const topTracks = rawTracks.map(mapTrackItem);
  const now = new Date();

  // 5. Upsert into spotify_profile table
  await pool.query(
    `INSERT INTO spotify_profile (user_id, top_artists, top_tracks, time_range, last_synced_at)
     VALUES ($1, $2::jsonb, $3::jsonb, $4, $5)
     ON CONFLICT (user_id) DO UPDATE
     SET top_artists = EXCLUDED.top_artists,
         top_tracks = EXCLUDED.top_tracks,
         time_range = EXCLUDED.time_range,
         last_synced_at = EXCLUDED.last_synced_at`,
    [userId, JSON.stringify(topArtists), JSON.stringify(topTracks), timeRange, now]
  );

  // 6. Update spotify_connections last_synced_at
  await pool.query(
    `UPDATE spotify_connections
     SET last_synced_at = $1
     WHERE user_id = $2`,
    [now, userId]
  );

  // 7. Update members table columns for seamless discover feed & member queries
  await pool.query(
    `UPDATE members
     SET spotify_connected = TRUE,
         spotify_top_artists = $1::jsonb,
         spotify_top_tracks = $2::jsonb
     WHERE id = $3`,
    [JSON.stringify(topArtists), JSON.stringify(topTracks), userId]
  );

  console.log(`[Spotify Sync] Successfully synced ${topArtists.length} artists & ${topTracks.length} tracks for user ${userId}`);

  return {
    success: true,
    top_artists: topArtists,
    top_tracks: topTracks,
    last_synced_at: now,
  };
}

/**
 * Disconnects Spotify and removes all associated data for a user
 * @param {number|string} userId User ID
 * @param {import('pg').Pool} pool PostgreSQL pool
 */
async function disconnectSpotify(userId, pool) {
  await pool.query('DELETE FROM spotify_connections WHERE user_id = $1', [userId]);
  await pool.query('DELETE FROM spotify_profile WHERE user_id = $1', [userId]);
  await pool.query(
    `UPDATE members
     SET spotify_connected = FALSE,
         spotify_top_artists = NULL,
         spotify_top_tracks = NULL
     WHERE id = $1`,
    [userId]
  );
  console.log(`[Spotify Disconnect] Cleared Spotify data for user ${userId}`);
  return { success: true };
}

module.exports = {
  syncSpotifyProfile,
  disconnectSpotify,
  mapArtistItem,
  mapTrackItem,
};
