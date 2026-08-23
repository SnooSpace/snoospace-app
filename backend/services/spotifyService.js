/**
 * Spotify Service
 * Handles OAuth authorize URLs, token exchange, token refresh, and Spotify Web API calls.
 */

const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/authorize';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';

function getCredentials() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI || 'http://127.0.0.1:5000/api/auth/spotify/callback';
  const scopes = process.env.SPOTIFY_SCOPES || 'user-top-read';

  if (!clientId) {
    throw new Error('SPOTIFY_CLIENT_ID is not configured');
  }

  return { clientId, clientSecret, redirectUri, scopes };
}

function getBasicAuthHeader(clientId, clientSecret) {
  if (!clientSecret) {
    throw new Error('SPOTIFY_CLIENT_SECRET is not configured');
  }
  return 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
}

/**
 * Builds the Spotify OAuth authorize URL with state parameter for CSRF protection
 * @param {string} state Signed state parameter containing userId + nonce
 * @param {string} [customRedirectUri] Optional redirect URI override
 * @returns {string} Spotify authorize URL
 */
function getAuthorizeUrl(state, customRedirectUri) {
  const { clientId, redirectUri, scopes } = getCredentials();
  
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: customRedirectUri || redirectUri,
    scope: scopes,
    state: state || '',
    show_dialog: 'true',
  });

  return `${SPOTIFY_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchanges authorization code for access and refresh tokens
 * @param {string} code Authorization code from Spotify redirect
 * @param {string} [customRedirectUri] Redirect URI matching the authorize request
 * @returns {Promise<{ access_token: string, refresh_token: string, expires_in: number, scope: string }>}
 */
async function exchangeCodeForTokens(code, customRedirectUri) {
  const { clientId, clientSecret, redirectUri } = getCredentials();
  const basicAuth = getBasicAuthHeader(clientId, clientSecret);

  const bodyParams = new URLSearchParams({
    grant_type: 'authorization_code',
    code: code,
    redirect_uri: customRedirectUri || redirectUri,
  });

  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Authorization': basicAuth,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: bodyParams.toString(),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data.error_description || data.error?.message || data.error || 'Failed to exchange Spotify auth code';
    const err = new Error(errorMsg);
    err.status = response.status;
    err.spotifyError = data;
    throw err;
  }

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in,
    scope: data.scope,
  };
}

/**
 * Refreshes an expired Spotify access token using the stored refresh token
 * @param {string} refreshToken Stored refresh token
 * @returns {Promise<{ access_token: string, refresh_token?: string, expires_in: number, scope?: string }>}
 */
async function refreshAccessToken(refreshToken) {
  const { clientId, clientSecret } = getCredentials();
  const basicAuth = getBasicAuthHeader(clientId, clientSecret);

  const bodyParams = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });

  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Authorization': basicAuth,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: bodyParams.toString(),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data.error_description || data.error?.message || data.error || 'Failed to refresh Spotify access token';
    const err = new Error(errorMsg);
    err.status = response.status;
    err.spotifyError = data;
    throw err;
  }

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token, // Spotify may or may not return a new refresh token
    expires_in: data.expires_in,
    scope: data.scope,
  };
}

/**
 * Fetches user top artists from Spotify API
 * @param {string} accessToken Spotify access token
 * @param {'short_term' | 'medium_term' | 'long_term'} [timeRange='medium_term'] Time frame for calculation
 * @param {number} [limit=10] Number of items to return (1-50)
 * @returns {Promise<Array>} List of Spotify artist objects
 */
async function fetchTopArtists(accessToken, timeRange = 'medium_term', limit = 10) {
  const url = `${SPOTIFY_API_BASE}/me/top/artists?time_range=${encodeURIComponent(timeRange)}&limit=${encodeURIComponent(limit)}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data.error?.message || data.error || 'Failed to fetch Spotify top artists';
    const err = new Error(errorMsg);
    err.status = response.status;
    err.spotifyError = data;
    throw err;
  }

  return data.items || [];
}

/**
 * Fetches user top tracks from Spotify API
 * @param {string} accessToken Spotify access token
 * @param {'short_term' | 'medium_term' | 'long_term'} [timeRange='medium_term'] Time frame for calculation
 * @param {number} [limit=10] Number of items to return (1-50)
 * @returns {Promise<Array>} List of Spotify track objects
 */
async function fetchTopTracks(accessToken, timeRange = 'medium_term', limit = 10) {
  const url = `${SPOTIFY_API_BASE}/me/top/tracks?time_range=${encodeURIComponent(timeRange)}&limit=${encodeURIComponent(limit)}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data.error?.message || data.error || 'Failed to fetch Spotify top tracks';
    const err = new Error(errorMsg);
    err.status = response.status;
    err.spotifyError = data;
    throw err;
  }

  return data.items || [];
}

/**
 * Fetches user profile from Spotify API
 * @param {string} accessToken Spotify access token
 * @returns {Promise<{ id: string, display_name: string, email?: string, images?: Array, uri?: string }>}
 */
async function getSpotifyProfile(accessToken) {
  const url = `${SPOTIFY_API_BASE}/me`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data.error?.message || data.error || 'Failed to fetch Spotify user profile';
    const err = new Error(errorMsg);
    err.status = response.status;
    err.spotifyError = data;
    throw err;
  }

  return data;
}

module.exports = {
  getCredentials,
  getAuthorizeUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  fetchTopArtists,
  fetchTopTracks,
  getSpotifyProfile,
};
