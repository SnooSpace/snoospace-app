import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { getAllAccounts } from "../api/auth";
import * as accountManager from "../utils/accountManager";
import * as sessionManager from "../utils/sessionManager";

/**
 * Hook to refresh tokens for all accounts when app comes to foreground
 * Helps prevent session expiration for idle accounts
 */
export function useTokenRefresh() {
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    // Refresh when app comes to foreground
    const subscription = AppState.addEventListener(
      "change",
      async (nextAppState) => {
        // App came to foreground from background
        if (
          appState.current.match(/inactive|background/) &&
          nextAppState === "active"
        ) {
          console.log("[TokenRefresh] App came to foreground, checking tokens");
          await refreshExpiredTokens();
        }

        appState.current = nextAppState;
      }
    );

    // NEW: Periodic refresh every 45 minutes while app is active
    // This prevents token expiration when app stays in foreground for extended periods
    const refreshInterval = setInterval(async () => {
      if (AppState.currentState === "active") {
        console.log("[TokenRefresh] Periodic check triggered (45min interval)");
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
      console.log("[TokenRefresh] No accounts to refresh");
      return;
    }

    console.log(`[TokenRefresh] Checking ${accounts.length} accounts`);

    for (const account of accounts) {
      // Check if account has tokens - isLoggedIn might be undefined for older accounts
      // Only skip if explicitly set to false (not just falsy/undefined)
      if (account.isLoggedIn === false || !account.authToken) {
        console.log(
          `[TokenRefresh] Skipping ${account.email} - logged out or no token`
        );
        continue;
      }

      // Check if token is expired or close to expiring
      const isExpired = isTokenExpiringSoon(account.authToken);

      if (isExpired) {
        console.log(
          `[TokenRefresh] Token expiring soon for ${account.email}, attempting refresh`
        );
        await attemptTokenRefresh(account);
      } else {
        console.log(`[TokenRefresh] Token valid for ${account.email}`);
      }
    }
  } catch (error) {
    console.error("[TokenRefresh] Error refreshing tokens:", error);
  }
}

/**
 * Check if token is expired or expiring in next 10 minutes
 */
function isTokenExpiringSoon(token, bufferMinutes = 10) {
  if (!token) return true;

  try {
    const parts = token.split(".");
    if (parts.length !== 3) return true;

    const payload = JSON.parse(atob(parts[1]));
    if (!payload.exp) return true;

    const exp = payload.exp * 1000;
    const now = Date.now();
    const bufferTime = bufferMinutes * 60 * 1000;

    return exp - now < bufferTime;
  } catch (error) {
    console.error("[TokenRefresh] Error checking expiry:", error);
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
      console.error(
        `[TokenRefresh] Invalid refresh token for ${account.email} (length: ${account.refreshToken?.length})`
      );
      await accountManager.markAccountLoggedOut(
        account.id,
        `Invalid refresh token (length: ${account.refreshToken?.length || 0})`,
        "useTokenRefresh:attemptTokenRefresh"
      );
      return;
    }

    // Use V2 sessionManager for token refresh (correct API URL and endpoint)
    try {
      const result = await sessionManager.refreshTokens(account.refreshToken);

      // Update account with new tokens
      await accountManager.updateAccount(account.id, {
        authToken: result.accessToken,
        refreshToken: result.refreshToken || account.refreshToken,
      });

      // Also update sessionManager storage
      const compositeId = `${account.type}_${account.id}`;
      await sessionManager.updateLocalSession(compositeId, {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      });

      console.log(
        `[TokenRefresh] Successfully refreshed token for ${account.email}`
      );
    } catch (v2Error) {
      console.error(
        `[TokenRefresh] V2 refresh failed for ${account.email}:`,
        v2Error.message
      );

      // Mark as logged out if refresh fails
      if (
        v2Error.message?.includes("Invalid") ||
        v2Error.message?.includes("expired")
      ) {
        console.log(`[TokenRefresh] Marking ${account.email} as logged out`);
        await accountManager.markAccountLoggedOut(
          account.id,
          `V2 refresh failed: ${v2Error.message}`,
          "useTokenRefresh:attemptTokenRefresh:V2Error"
        );
      }
    }
  } catch (error) {
    console.error(
      `[TokenRefresh] Error refreshing token for ${account.email}:`,
      error
    );
  }
}
