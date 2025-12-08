import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { getAllAccounts } from '../api/auth';
import * as accountManager from '../utils/accountManager';

/**
 * Hook to refresh tokens for all accounts when app comes to foreground
 * Helps prevent session expiration for idle accounts
 */
export function useTokenRefresh() {
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    // Refresh when app comes to foreground
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      // App came to foreground from background
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        console.log('[TokenRefresh] App came to foreground, checking tokens');
        await refreshExpiredTokens();
      }

      appState.current = nextAppState;
    });

    // NEW: Periodic refresh every 45 minutes while app is active
    // This prevents token expiration when app stays in foreground for extended periods
    const refreshInterval = setInterval(async () => {
      if (AppState.currentState === 'active') {
        console.log('[TokenRefresh] Periodic check triggered (45min interval)');
        await refreshExpiredTokens();
      }
    }, 45 * 60 * 1000); // 45 minutes

    // Initial check when hook mounts
    refreshExpiredTokens();

    return () => {
      subscription.remove();
      clearInterval(refreshInterval);
    };
  }, []);
}

/**
 * Check and refresh tokens for all accounts that are close to expiring
 */
async function refreshExpiredTokens() {
  try {
    const accounts = await getAllAccounts();
    
    if (!accounts || accounts.length === 0) {
      console.log('[TokenRefresh] No accounts to refresh');
      return;
    }

    console.log(`[TokenRefresh] Checking ${accounts.length} accounts`);

    for (const account of accounts) {
      if (!account.isLoggedIn || !account.authToken) {
        console.log(`[TokenRefresh] Skipping ${account.email} - not logged in or no token`);
        continue;
      }

      // Check if token is expired or close to expiring
      const isExpired = isTokenExpiringSoon(account.authToken);
      
      if (isExpired) {
        console.log(`[TokenRefresh] Token expiring soon for ${account.email}, attempting refresh`);
        await attemptTokenRefresh(account);
      } else {
        console.log(`[TokenRefresh] Token valid for ${account.email}`);
      }
    }
  } catch (error) {
    console.error('[TokenRefresh] Error refreshing tokens:', error);
  }
}

/**
 * Check if token is expired or expiring in next 10 minutes
 */
function isTokenExpiringSoon(token, bufferMinutes = 10) {
  if (!token) return true;

  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;

    const payload = JSON.parse(atob(parts[1]));
    if (!payload.exp) return true;

    const exp = payload.exp * 1000;
    const now = Date.now();
    const bufferTime = bufferMinutes * 60 * 1000;

    return (exp - now) < bufferTime;
  } catch (error) {
    console.error('[TokenRefresh] Error checking expiry:', error);
    return true;
  }
}

/**
 * Attempt to refresh token for an account
 */
async function attemptTokenRefresh(account) {
  try {
    // Validate refresh token before attempting
    if (!account.refreshToken || account.refreshToken.length < 20) {
      console.error(`[TokenRefresh] Invalid refresh token for ${account.email} (length: ${account.refreshToken?.length})`);
      await accountManager.updateAccount(account.id, { isLoggedIn: false });
      return;
    }
    
    const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000'}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        refresh_token: account.refreshToken  // Fixed: was 'refreshToken', backend expects 'refresh_token'
      }),
    });

    const data = await response.json().catch(() => ({}));
    
    if (!response.ok) {
      console.error(`[TokenRefresh] Refresh failed for ${account.email}:`, response.status, data?.error);
      
      // Mark as logged out if refresh fails with auth error or token already used
      if (response.status === 401 || response.status === 403 || 
          data?.error?.includes('Already Used') || data?.error?.includes('Invalid')) {
        console.log(`[TokenRefresh] Marking ${account.email} as logged out`);
        await accountManager.updateAccount(account.id, { isLoggedIn: false });
      }
      return;
    }

    // Backend returns tokens in data.data.session format
    const newAccessToken = data?.data?.session?.access_token;
    const newRefreshToken = data?.data?.session?.refresh_token;
    
    if (!newAccessToken) {
      console.error(`[TokenRefresh] No access token in response for ${account.email}`);
      return;
    }
    
    // Update account with new tokens
    await accountManager.updateAccount(account.id, {
      authToken: newAccessToken,
      refreshToken: newRefreshToken || account.refreshToken  // Keep old if no new one
    });
    
    console.log(`[TokenRefresh] Successfully refreshed token for ${account.email}`);
  } catch (error) {
    console.error(`[TokenRefresh] Error refreshing token for ${account.email}:`, error);
  }
}
