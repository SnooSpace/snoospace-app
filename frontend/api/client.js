export const BACKEND_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL || "http://192.168.1.11:5000";

function withTimeout(promise, ms = 15000) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Request timed out")), ms)
    ),
  ]);
}

function buildError(res, data) {
  const status = res?.status;
  const serverMessage = data?.error || data?.message || data?.msg;
  const statusText = res?.statusText;
  const message = serverMessage || statusText || "Request failed";
  const err = new Error(message);
  if (typeof status === "number") err.status = status;
  if (data) err.data = data;
  return err;
}

async function tryRefreshAndRetry(doRequest) {
  try {
    console.log("[tryRefreshAndRetry] Attempting token refresh...");

    // CRITICAL: Capture account context BEFORE refresh to prevent race conditions
    // This ensures tokens are saved to the correct account even if user switches accounts
    const authModule = await import("./auth");
    const sessionManager = await import("../utils/sessionManager");
    const activeAccount = await authModule.getActiveAccount();
    const accountId = activeAccount?.id;
    const accountType = activeAccount?.type;

    console.log("[tryRefreshAndRetry] Captured account context:", {
      accountId,
      accountType,
      email: activeAccount?.email,
    });

    const refreshToken =
      activeAccount?.refreshToken || (await authModule.getRefreshToken());

    if (!refreshToken) {
      console.warn("[tryRefreshAndRetry] No refresh token available");
      throw new Error("Unauthorized");
    }

    console.log(
      "[tryRefreshAndRetry] Refresh token length:",
      refreshToken?.length
    );
    console.log(
      "[tryRefreshAndRetry] Refresh token preview:",
      refreshToken ? `${refreshToken.substring(0, 16)}...` : "null"
    );
    console.log(
      "[tryRefreshAndRetry] Refresh token source:",
      activeAccount?.refreshToken ? "accountManager" : "getRefreshToken legacy"
    );

    // VALIDATION: Refresh tokens should be at least 20 characters
    // If token is too short, it's likely corrupted - skip refresh attempt
    if (refreshToken.length < 20) {
      console.error(
        "[tryRefreshAndRetry] Refresh token is too short - likely corrupted:",
        refreshToken.length
      );
      console.error("[tryRefreshAndRetry] Account needs re-authentication");

      // Mark account as logged out to prevent infinite retry loops
      if (accountId) {
        const accountManager = await import("../utils/accountManager");
        await accountManager.markAccountLoggedOut(
          accountId,
          `Refresh token too short (${refreshToken.length} chars) - likely corrupted`,
          "client.js:tryRefreshAndRetry"
        );
      }

      throw new Error("Unauthorized");
    }

    // Try V2 refresh first (new device-based sessions)
    let newAccess, newRefresh;

    // V2 refresh tokens are 64-character hex strings (32 bytes hex-encoded)
    // Only attempt V2 refresh if the token matches this format
    const isV2Token =
      refreshToken.length === 64 && /^[0-9a-f]+$/i.test(refreshToken);
    console.log("[tryRefreshAndRetry] Token format check:", {
      length: refreshToken.length,
      isHex: /^[0-9a-f]+$/i.test(refreshToken),
      isV2Token,
    });

    let needV1Fallback = !isV2Token; // Skip V2 for non-V2 tokens

    if (isV2Token) {
      try {
        console.log(
          "[tryRefreshAndRetry] Trying V2 refresh endpoint (V2 token detected)..."
        );
        const v2Result = await sessionManager.refreshTokens(refreshToken);
        newAccess = v2Result.accessToken;
        newRefresh = v2Result.refreshToken;
        console.log("[tryRefreshAndRetry] V2 refresh successful");
      } catch (v2Error) {
        console.log("[tryRefreshAndRetry] V2 refresh failed:", v2Error.message);

        // CRITICAL FIX: Do NOT fallback to V1 for V2 tokens!
        // V1 fallback would return a 32-char token that corrupts the V2 session
        // Instead, mark account as logged out and throw
        console.error(
          "[tryRefreshAndRetry] V2 token refresh failed - marking account for re-auth"
        );
        if (accountId) {
          const accountManager = await import("../utils/accountManager");
          await accountManager.markAccountLoggedOut(
            accountId,
            `V2 refresh failed: ${v2Error.message}`,
            "client.js:tryRefreshAndRetry:V2Failed"
          );
        }
        throw new Error("Unauthorized");
      }
    }

    // V1 fallback for legacy Supabase sessions or failed V2 refresh
    if (needV1Fallback && !newAccess) {
      console.log("[tryRefreshAndRetry] Trying V1 fallback endpoint...");
      const res = await withTimeout(
        fetch(`${BACKEND_BASE_URL}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: refreshToken }),
        }),
        15000
      );
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        console.error(
          "[tryRefreshAndRetry] V1 Refresh failed:",
          data?.error || res.statusText
        );

        // If refresh token was already used or is invalid, mark account as logged out
        if (
          data?.error?.includes("Already Used") ||
          data?.error?.includes("Invalid") ||
          res.status === 401
        ) {
          console.error(
            "[tryRefreshAndRetry] Refresh token invalid or already used - marking account for re-auth"
          );
          if (accountId) {
            const accountManager = await import("../utils/accountManager");
            await accountManager.markAccountLoggedOut(
              accountId,
              `V1 refresh failed: ${data?.error || "Invalid/expired token"}`,
              "client.js:tryRefreshAndRetry:V1Fallback"
            );
          }
        }

        throw new Error("Unauthorized");
      }

      newAccess = data?.data?.session?.access_token;
      newRefresh = data?.data?.session?.refresh_token;
    }

    if (newAccess) {
      console.log(
        "[tryRefreshAndRetry] Got new access token, length:",
        newAccess?.length
      );

      // CRITICAL: Update tokens atomically for the SPECIFIC account that initiated refresh
      // This prevents race conditions when user switches accounts during API calls
      if (accountId) {
        // Update in sessionManager (V2)
        const compositeId = `${accountType}_${accountId}`;
        await sessionManager.updateLocalSession(compositeId, {
          accessToken: newAccess,
          refreshToken: newRefresh,
        });

        // Also update in accountManager for backward compatibility
        await authModule.updateAccountTokens(accountId, newAccess, newRefresh);
        console.log(
          "[tryRefreshAndRetry] Tokens updated for account:",
          accountId
        );
      } else {
        // Fallback to old behavior if no account context (legacy support)
        console.warn(
          "[tryRefreshAndRetry] No account context, using legacy token update"
        );
        if (authModule.setAccessToken)
          await authModule.setAccessToken(newAccess);
        if (newRefresh && authModule.setRefreshToken)
          await authModule.setRefreshToken(newRefresh);
      }
    } else {
      console.warn("[tryRefreshAndRetry] No access token in refresh response");
    }

    return doRequest(newAccess);
  } catch (error) {
    // Use debug instead of error - this is expected when user is not logged in
    if (__DEV__) {
      console.debug(
        "[tryRefreshAndRetry] Token refresh failed:",
        error.message
      );
    }
    throw new Error("Unauthorized");
  }
}

export async function apiPost(path, body, timeoutMs, token) {
  console.log(`[apiPost] ${path}`, {
    hasToken: !!token,
    tokenLength: token?.length,
    bodyKeys: Object.keys(body || {}),
  });

  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  let res;
  try {
    res = await withTimeout(
      fetch(`${BACKEND_BASE_URL}${path}`, {
        method: "POST",
        headers,
        body: JSON.stringify(body ?? {}),
      }),
      timeoutMs
    );
  } catch (e) {
    if (e && e.message === "Request timed out") throw e;
    throw new Error("Network error. Please check your connection.");
  }
  if (res.status === 401) {
    return tryRefreshAndRetry((newToken) =>
      apiPost(path, body, timeoutMs, newToken)
    );
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw buildError(res, data);
  return data;
}

export async function apiGet(path, timeoutMs, token) {
  const headers = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  let res;
  try {
    res = await withTimeout(
      fetch(`${BACKEND_BASE_URL}${path}`, { headers }),
      timeoutMs
    );
  } catch (e) {
    if (e && e.message === "Request timed out") throw e;
    throw new Error("Network error. Please check your connection.");
  }
  if (res.status === 401) {
    return tryRefreshAndRetry((newToken) => apiGet(path, timeoutMs, newToken));
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw buildError(res, data);
  return data;
}

export async function apiPatch(path, body, timeoutMs, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  let res;
  try {
    res = await withTimeout(
      fetch(`${BACKEND_BASE_URL}${path}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(body ?? {}),
      }),
      timeoutMs
    );
  } catch (e) {
    if (e && e.message === "Request timed out") throw e;
    throw new Error("Network error. Please check your connection.");
  }
  if (res.status === 401) {
    return tryRefreshAndRetry((newToken) =>
      apiPatch(path, body, timeoutMs, newToken)
    );
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw buildError(res, data);
  return data;
}

export async function apiDelete(path, body, timeoutMs, token) {
  const headers = {};
  if (token || body) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const options = { method: "DELETE", headers };
  if (body) options.body = JSON.stringify(body);
  let res;
  try {
    res = await withTimeout(
      fetch(`${BACKEND_BASE_URL}${path}`, options),
      timeoutMs || 15000
    );
  } catch (e) {
    if (e && e.message === "Request timed out") throw e;
    throw new Error("Network error. Please check your connection.");
  }
  if (res.status === 401) {
    return tryRefreshAndRetry((newToken) =>
      apiDelete(path, body, timeoutMs, newToken)
    );
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw buildError(res, data);
  return data;
}

/**
 * Fetch active sponsor types from the catalog
 * Public endpoint - no auth required
 */
export async function getSponsorTypes(timeoutMs = 10000) {
  try {
    const res = await withTimeout(
      fetch(`${BACKEND_BASE_URL}/catalog/sponsor-types`),
      timeoutMs
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw buildError(res, data);
    return data.sponsorTypes || [];
  } catch (error) {
    console.error("[getSponsorTypes] Error:", error.message);
    // Return fallback hard-coded list if API fails
    return [
      { id: 1, name: "Protein brands" },
      { id: 2, name: "Energy Drinks" },
      { id: 3, name: "Supplements" },
      { id: 4, name: "Apparel" },
      { id: 5, name: "Tech Gadgets" },
      { id: 6, name: "Local Businesses" },
    ];
  }
}
