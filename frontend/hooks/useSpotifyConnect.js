import { useState, useCallback, useEffect } from 'react';
import { Linking } from 'react-native';
import { getAuthToken } from '../api/auth';
import { apiPost, apiDelete } from '../api/client';
import HapticsService from '../services/HapticsService';

// Spotify Client ID and scopes
const SPOTIFY_CLIENT_ID = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID || 'd6ea8e1694f447789728cf2436d4df6f';
const SCOPES = ['user-top-read', 'user-read-private'];
const REDIRECT_SCHEME = 'com.snoospace.app';
const REDIRECT_PATH = 'spotify-callback';
const REDIRECT_URI = `${REDIRECT_SCHEME}://${REDIRECT_PATH}`;

export function useSpotifyConnect() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);

  const handleRedirectUrl = useCallback(async (url) => {
    console.log('[Spotify Auth Hook] Handling redirect URL:', url);
    if (!url) return;

    try {
      const urlParts = url.split('?');
      if (urlParts.length < 2) return;

      const queryParams = {};
      urlParts[1].split('&').forEach(part => {
        const [key, value] = part.split('=');
        if (key && value) {
          queryParams[key] = decodeURIComponent(value);
        }
      });

      const { code, error: spotifyErr } = queryParams;

      if (spotifyErr) {
        throw new Error(`Spotify authorization error: ${spotifyErr}`);
      }

      if (code) {
        setIsConnecting(true);
        console.log('[Spotify Auth Hook] Exchanging authorization code on backend...');
        const token = await getAuthToken();
        await apiPost(
          '/spotify/connect',
          { code, redirectUri: REDIRECT_URI },
          15000,
          token
        );
        HapticsService.triggerNotificationSuccess();
      }
    } catch (err) {
      console.error('[Spotify Auth Hook] Connect error:', err);
      setError(err.message || 'Failed to connect Spotify');
    } finally {
      setIsConnecting(false);
    }
  }, []);

  useEffect(() => {
    const handleUrlEvent = (event) => {
      if (event.url && event.url.startsWith(REDIRECT_SCHEME)) {
        handleRedirectUrl(event.url);
      }
    };

    // Add deep linking event listener
    const subscription = Linking.addEventListener('url', handleUrlEvent);

    // Check if the app was launched by a deep link redirect
    Linking.getInitialURL().then((url) => {
      if (url && url.startsWith(REDIRECT_SCHEME)) {
        handleRedirectUrl(url);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [handleRedirectUrl]);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    HapticsService.triggerImpactLight();

    try {
      // Build standard Spotify OAuth URL
      const authUrl =
        `https://accounts.spotify.com/authorize` +
        `?client_id=${SPOTIFY_CLIENT_ID}` +
        `&response_type=code` +
        `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
        `&scope=${encodeURIComponent(SCOPES.join(' '))}` +
        `&show_dialog=true`;

      console.log('[Spotify Auth] Launching browser to authorize:', authUrl);
      
      // Open link in system browser
      await Linking.openURL(authUrl);
      return true;
    } catch (err) {
      console.error('[Spotify Auth Hook] Open URL error:', err);
      setError(err.message || 'Failed to launch Spotify authorization');
      setIsConnecting(false);
      return false;
    }
  }, []);

  const disconnect = useCallback(async () => {
    HapticsService.triggerImpactMedium();
    try {
      const token = await getAuthToken();
      await apiDelete('/spotify/disconnect', null, 15000, token);
      HapticsService.triggerNotificationSuccess();
      return true;
    } catch (err) {
      console.error('[Spotify Disconnect Hook] Error:', err);
      setError(err.message || 'Failed to disconnect Spotify');
      return false;
    }
  }, []);

  const syncArtists = useCallback(async () => {
    HapticsService.triggerImpactLight();
    try {
      const token = await getAuthToken();
      await apiPost('/spotify/sync', {}, 15000, token);
      HapticsService.triggerNotificationSuccess();
      return true;
    } catch (err) {
      console.error('[Spotify Sync Hook] Error:', err);
      setError(err.message || 'Failed to sync Spotify');
      return false;
    }
  }, []);

  return { connect, disconnect, syncArtists, isConnecting, error };
}
