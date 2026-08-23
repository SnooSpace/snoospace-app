import { useState, useCallback, useEffect, useRef } from 'react';
import { Linking } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { getAuthToken } from '../api/auth';
import { apiGet, apiPost, apiDelete } from '../api/client';
import HapticsService from '../services/HapticsService';

const REDIRECT_DEEP_LINK = 'snoospace://spotify-connected';
const CONNECT_TIMEOUT_MS = 60000; // 60s safety timeout for auth session

export function useSpotifyConnect() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [error, setError] = useState(null);
  const timeoutRef = useRef(null);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  /**
   * Fetch current user's synced Spotify profile from backend
   */
  const fetchSpotifyProfile = useCallback(async () => {
    try {
      const token = await getAuthToken();
      const res = await apiGet('/api/auth/spotify/profile', 15000, token);
      return res;
    } catch (err) {
      console.error('[Spotify Profile] Error fetching profile:', err.message);
      return null;
    }
  }, []);

  /**
   * Connect Spotify account via WebBrowser auth session with deep link handoff
   */
  const connect = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    HapticsService.triggerImpactLight();

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setIsConnecting(false);
      try {
        WebBrowser.dismissAuthSession();
      } catch (e) {}
    }, CONNECT_TIMEOUT_MS);

    try {
      const token = await getAuthToken();

      // 1. Get authorizeUrl with signed state from backend
      const res = await apiGet('/api/auth/spotify/connect', 15000, token);
      const { authorizeUrl } = res || {};

      if (!authorizeUrl) {
        throw new Error('Could not retrieve Spotify authorization URL');
      }

      console.log('[Spotify Connect] Launching auth session for URL:', authorizeUrl);

      // 2. Open auth session in browser with deep link redirect
      const authResult = await WebBrowser.openAuthSessionAsync(
        authorizeUrl,
        REDIRECT_DEEP_LINK
      );

      console.log('[Spotify Connect] Browser auth result:', authResult.type);

      // Clear the timeout guard
      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      // 3. Check profile status on backend (regardless of whether browser closed via redirect or manual dismiss)
      const profileRes = await fetchSpotifyProfile();

      if (profileRes?.connected) {
        HapticsService.triggerNotificationSuccess();
        console.log('[Spotify Connect] Verified connected on backend!');
        return { success: true, profile: profileRes };
      }

      // If browser returned explicit error in redirect URL
      if (authResult.type === 'success' && authResult.url) {
        const urlParts = authResult.url.split('?');
        const queryParams = {};
        if (urlParts.length > 1) {
          urlParts[1].split('&').forEach((part) => {
            const [k, v] = part.split('=');
            if (k) queryParams[k] = decodeURIComponent(v || '');
          });
        }
        if (queryParams.status === 'error') {
          const errMsg = queryParams.reason || 'Spotify connection was cancelled or failed';
          setError(errMsg);
          HapticsService.triggerNotificationWarning();
          return { success: false, error: errMsg };
        }
      }

      if (authResult.type === 'cancel' || authResult.type === 'dismiss') {
        console.log('[Spotify Connect] Browser dismissed without active connection');
        return { success: false, cancelled: true };
      }

      return { success: false };
    } catch (err) {
      console.error('[Spotify Connect] Error:', err.message);
      const errMsg = err.message || 'Failed to connect Spotify';
      setError(errMsg);
      HapticsService.triggerNotificationWarning();
      return { success: false, error: errMsg };
    } finally {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setIsConnecting(false);
    }
  }, [fetchSpotifyProfile]);

  /**
   * Disconnect Spotify account
   */
  const disconnect = useCallback(async () => {
    setIsDisconnecting(true);
    setError(null);
    HapticsService.triggerImpactMedium();

    try {
      const token = await getAuthToken();
      await apiDelete('/api/auth/spotify/disconnect', null, 15000, token);
      HapticsService.triggerNotificationSuccess();
      return { success: true };
    } catch (err) {
      console.error('[Spotify Disconnect] Error:', err.message);
      const errMsg = err.message || 'Failed to disconnect Spotify';
      setError(errMsg);
      HapticsService.triggerNotificationWarning();
      return { success: false, error: errMsg };
    } finally {
      setIsDisconnecting(false);
    }
  }, []);

  /**
   * Manually sync Spotify top items
   */
  const syncArtists = useCallback(async () => {
    setIsSyncing(true);
    setError(null);
    HapticsService.triggerImpactLight();

    try {
      const token = await getAuthToken();
      const res = await apiPost('/api/auth/spotify/sync?force=true', {}, 15000, token);
      HapticsService.triggerNotificationSuccess();
      return { success: true, data: res };
    } catch (err) {
      console.error('[Spotify Sync] Error:', err.message);
      const errMsg = err.message || 'Failed to sync Spotify top items';
      setError(errMsg);
      HapticsService.triggerNotificationWarning();
      return { success: false, error: errMsg };
    } finally {
      setIsSyncing(false);
    }
  }, []);

  return {
    connect,
    disconnect,
    syncArtists,
    fetchSpotifyProfile,
    isConnecting,
    isSyncing,
    isDisconnecting,
    error,
    clearError: () => setError(null),
  };
}
