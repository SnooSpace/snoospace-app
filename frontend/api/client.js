export const BACKEND_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL || "http://192.168.1.11:5000";

/**
 * ACCOUNT SWITCH RACE CONDITION GUARD
 *
 * This generation counter increments every time the user switches accounts.
 * It's used to detect and abort stale API requests from previous account sessions
 * that would otherwise corrupt tokens when their refresh completes after a switch.
 *
 * Problem: In-flight request for Account A gets 401 → triggers refresh → but user
 * already switched to Account B → refresh uses A's token but getActiveAccount()
 * returns B → tokens get corrupted.
 *
 * Solution: Capture generation at request time, verify before saving tokens.
 */
let accountSwitchGeneration = 0;

/**
 * Increment the generation counter when switching accounts.
 * Call this from accountManager.switchAccount() BEFORE the actual switch.
 * @returns {number} The new generation number
 */
export function incrementAccountSwitchGeneration() {
  accountSwitchGeneration++;
  console.log(
    "[AccountGuard] ⚡ Generation incremented to:",
    accountSwitchGeneration,
    "at",
    new Date().toISOString(),
  );
  return accountSwitchGeneration;
}

/**
 * Get current generation for debugging purposes
 */
export function getAccountSwitchGeneration() {
  return accountSwitchGeneration;
}

/**
 * REFRESH THUNDERING HERD GUARD
 *
 * Map of active refresh promises keyed by account ID.
 * This ensures that multiple simultaneous 401s from the same account
 * only trigger ONE actual refresh request. Subsequent requests wait for
 * the same promise and then reuse the updated token.
 */
const refreshingPromises = new Map();

/**
 * PER-ENDPOINT RETRY TRACKER
 *
 * Tracks consecutive failed refresh attempts per endpoint to prevent infinite loops.
 * If an endpoint keeps failing even after successful token refresh, we stop retrying
 * after MAX_REFRESH_RETRIES attempts.
 *
 * Key: endpoint path (e.g. "/members/location")
 * Value: { count: number, lastAttempt: timestamp }
 */
const endpointRetryTracker = new Map();
const MAX_REFRESH_RETRIES = 2;
const RETRY_WINDOW_MS = 10000; // Reset counter after 10 seconds of no failures

function getEndpointRetryCount(path) {
  const entry = endpointRetryTracker.get(path);
  if (!entry) return 0;
  // Reset if last attempt was more than RETRY_WINDOW_MS ago
  if (Date.now() - entry.lastAttempt > RETRY_WINDOW_MS) {
    endpointRetryTracker.delete(path);
    return 0;
  }
  return entry.count;
}

function incrementEndpointRetry(path) {
  const current = getEndpointRetryCount(path);
  endpointRetryTracker.set(path, {
    count: current + 1,
    lastAttempt: Date.now(),
  });
  return current + 1;
}

function resetEndpointRetry(path) {
  endpointRetryTracker.delete(path);
}

function withTimeout(promise, ms = 15000) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Request timed out")), ms),
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

async function tryRefreshAndRetry(
  doRequest,
  requestGeneration = null,
  failedToken = null,
  retryCount = 0,
) {
  // CRITICAL: Prevent infinite refresh loops
  const MAX_RETRIES = 2;
  if (retryCount >= MAX_RETRIES) {
    console.error(
      "[tryRefreshAndRetry] Max retries exceeded, aborting to prevent infinite loop",
    );
    throw new Error("Max retries exceeded");
  }

  // Declare variables outside try block so they're accessible in finally block
  let accountId = null;
  let refreshPromiseResolve = null;

  try {
    // CRITICAL: Capture generation at the START of refresh attempt
    // This detects if user switched accounts while refresh was in progress
    const refreshStartGeneration =
      requestGeneration !== null ? requestGeneration : accountSwitchGeneration;

    console.log("[tryRefreshAndRetry] Attempting token refresh...", {
      startGeneration: refreshStartGeneration,
      currentGeneration: accountSwitchGeneration,
      retryCount,
    });

    // EARLY ABORT: If generation already changed, don't even attempt refresh
    if (refreshStartGeneration !== accountSwitchGeneration) {
      console.warn(
        "[tryRefreshAndRetry] 🚨 STALE REQUEST - Account switched before refresh started!",
      );
      console.warn(
        "[tryRefreshAndRetry] Request generation:",
        refreshStartGeneration,
        "Current:",
        accountSwitchGeneration,
      );
      throw new Error("Unauthorized"); // Abort - don't corrupt tokens
    }

    // CRITICAL: Capture account context BEFORE refresh to prevent race conditions
    // This ensures tokens are saved to the correct account even if user switches accounts
    const authModule = await import("./auth");
    const sessionManager = await import("../utils/sessionManager");
    const activeAccount = await authModule.getActiveAccount();
    accountId = activeAccount?.id;
    const accountType = activeAccount?.type;

    // --- CONCURRENCY PROTECTION (THUNDERING HERD) ---
    // 1. TOKEN FRESHNESS CHECK:
    // Check if the token in storage is ALREADY different from the one that failed.
    // This happens if a parallel request already completed its refresh.
    if (
      failedToken &&
      activeAccount?.authToken &&
      activeAccount.authToken !== failedToken
    ) {
      console.log(
        "[tryRefreshAndRetry] ✨ Token already updated by another request. Retrying immediately.",
      );
      return doRequest(activeAccount.authToken);
    }

    // 2. REFRESH LOCKING:
    // If a refresh is already in progress for this account, wait for it.
    if (accountId && refreshingPromises.has(accountId)) {
      console.log(
        `[tryRefreshAndRetry] ⏳ Waiting for parallel refresh for account: ${accountId}`,
      );
      await refreshingPromises.get(accountId);

      // After waiting, get the newest token and retry
      const updatedAccount = await authModule.getActiveAccount();
      if (updatedAccount?.authToken) {
        console.log(
          "[tryRefreshAndRetry] ✨ Parallel refresh finished. Retrying with new token.",
        );
        return doRequest(updatedAccount.authToken);
      }
      throw new Error("Unauthorized");
    }

    // 3. START REFRESH WITH LOCK:
    const refreshPromise = new Promise((resolve) => {
      refreshPromiseResolve = resolve;
    });

    if (accountId) {
      refreshingPromises.set(accountId, refreshPromise);
    }

    console.log("[tryRefreshAndRetry] Captured account context:", {
      accountId,
      accountType,
      email: activeAccount?.email,
      generation: refreshStartGeneration,
    });

    const refreshToken =
      activeAccount?.refreshToken || (await authModule.getRefreshToken());

    if (!refreshToken) {
      console.warn("[tryRefreshAndRetry] No refresh token available");
      throw new Error("Unauthorized");
    }

    console.log(
      "[tryRefreshAndRetry] Refresh token length:",
      refreshToken?.length,
    );
    console.log(
      "[tryRefreshAndRetry] Refresh token preview:",
      refreshToken ? `${refreshToken.substring(0, 16)}...` : "null",
    );
    console.log(
      "[tryRefreshAndRetry] Refresh token source:",
      activeAccount?.refreshToken ? "accountManager" : "getRefreshToken legacy",
    );

    // VALIDATION: Refresh tokens should be at least 20 characters
    // If token is too short, it's likely corrupted - skip refresh attempt
    if (refreshToken.length < 20) {
      console.error(
        "[tryRefreshAndRetry] Refresh token is too short - likely corrupted:",
        refreshToken.length,
      );
      console.error("[tryRefreshAndRetry] Account needs re-authentication");

      // Mark account as logged out to prevent infinite retry loops
      if (accountId) {
        const accountManager = await import("../utils/accountManager");
        await accountManager.markAccountLoggedOut(
          accountId,
          `Refresh token too short (${refreshToken.length} chars) - likely corrupted`,
          "client.js:tryRefreshAndRetry",
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
          "[tryRefreshAndRetry] Trying V2 refresh endpoint (V2 token detected)...",
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
          "[tryRefreshAndRetry] V2 token refresh failed - marking account for re-auth",
        );
        if (accountId) {
          const accountManager = await import("../utils/accountManager");
          await accountManager.markAccountLoggedOut(
            accountId,
            `V2 refresh failed: ${v2Error.message}`,
            "client.js:tryRefreshAndRetry:V2Failed",
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
        15000,
      );
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        console.error(
          "[tryRefreshAndRetry] V1 Refresh failed:",
          data?.error || res.statusText,
        );

        // If refresh token was already used or is invalid, mark account as logged out
        if (
          data?.error?.includes("Already Used") ||
          data?.error?.includes("Invalid") ||
          res.status === 401
        ) {
          console.error(
            "[tryRefreshAndRetry] Refresh token invalid or already used - marking account for re-auth",
          );
          if (accountId) {
            const accountManager = await import("../utils/accountManager");
            await accountManager.markAccountLoggedOut(
              accountId,
              `V1 refresh failed: ${data?.error || "Invalid/expired token"}`,
              "client.js:tryRefreshAndRetry:V1Fallback",
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
        newAccess?.length,
      );

      // CRITICAL CHECK: Verify generation BEFORE saving tokens
      // If user switched accounts during refresh, DO NOT save tokens - they would corrupt the new account
      if (refreshStartGeneration !== accountSwitchGeneration) {
        console.error(
          "🚨 [tryRefreshAndRetry] ACCOUNT SWITCH DETECTED during token refresh!",
        );
        console.error(
          "[tryRefreshAndRetry] Refresh started at generation:",
          refreshStartGeneration,
        );
        console.error(
          "[tryRefreshAndRetry] Current generation:",
          accountSwitchGeneration,
        );
        console.error(
          "[tryRefreshAndRetry] Aborting token save to prevent corruption!",
        );
        console.error(
          "[tryRefreshAndRetry] Account that would have been corrupted:",
          accountId,
          activeAccount?.email,
        );
        throw new Error("Unauthorized"); // Don't save tokens, request is stale
      }

      // CRITICAL: Update tokens atomically for the SPECIFIC account that initiated refresh
      // This prevents race conditions when user switches accounts during API calls
      if (accountId) {
        // Use composite key to prevent ID collisions (e.g., member_28 vs community_28)
        const compositeId = `${accountType}_${accountId}`;

        // Update in sessionManager (V2)
        await sessionManager.updateLocalSession(compositeId, {
          accessToken: newAccess,
          refreshToken: newRefresh,
        });

        // CRITICAL: Also update in accountManager using composite key for backward compatibility
        // This fixes the bug where member_28 and community_28 would collide
        await authModule.updateAccountTokens(
          compositeId,
          newAccess,
          newRefresh,
        );
        console.log(
          "[tryRefreshAndRetry] Tokens updated for account:",
          compositeId,
          "generation:",
          refreshStartGeneration,
        );
      } else {
        // Fallback to old behavior if no account context (legacy support)
        console.warn(
          "[tryRefreshAndRetry] No account context, using legacy token update",
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
        error.message,
      );
    }
    throw new Error("Unauthorized");
  } finally {
    // Release the lock
    if (accountId) {
      refreshingPromises.delete(accountId);
    }
    if (typeof refreshPromiseResolve === "function") {
      refreshPromiseResolve();
    }
  }
}

export async function apiPost(path, body, timeoutMs, token) {
  // Capture generation at request initiation for stale request detection
  const requestGeneration = accountSwitchGeneration;

  console.log(`[apiPost] ${path}`, {
    hasToken: !!token,
    tokenLength: token?.length,
    bodyKeys: Object.keys(body || {}),
    generation: requestGeneration,
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
      timeoutMs,
    );
  } catch (e) {
    if (e && e.message === "Request timed out") throw e;
    throw new Error("Network error. Please check your connection.");
  }
  if (res.status === 401) {
    // Check if account switched before attempting refresh
    if (requestGeneration !== accountSwitchGeneration) {
      console.log(
        `[apiPost] Request stale (gen ${requestGeneration} vs ${accountSwitchGeneration}) - skipping refresh`,
      );
      throw new Error("Request aborted - account switched");
    }
    // CRITICAL: Check if this endpoint has already failed too many times
    const retryCount = incrementEndpointRetry(path);
    if (retryCount > MAX_REFRESH_RETRIES) {
      console.error(
        `[apiPost] Max refresh retries (${MAX_REFRESH_RETRIES}) exceeded for ${path} - aborting to prevent infinite loop`,
      );
      throw new Error(`Max retries exceeded for ${path}`);
    }
    return tryRefreshAndRetry(
      (newToken) => apiPost(path, body, timeoutMs, newToken),
      requestGeneration,
      token,
    );
  }
  // Request succeeded, reset retry counter for this endpoint
  resetEndpointRetry(path);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw buildError(res, data);
  return data;
}

export async function apiGet(path, timeoutMs, token) {
  // Capture generation at request initiation for stale request detection
  const requestGeneration = accountSwitchGeneration;

  const headers = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  let res;
  try {
    res = await withTimeout(
      fetch(`${BACKEND_BASE_URL}${path}`, { headers }),
      timeoutMs,
    );
  } catch (e) {
    if (e && e.message === "Request timed out") throw e;
    throw new Error("Network error. Please check your connection.");
  }
  if (res.status === 401) {
    // Check if account switched before attempting refresh
    if (requestGeneration !== accountSwitchGeneration) {
      console.log(
        `[apiGet] Request stale (gen ${requestGeneration} vs ${accountSwitchGeneration}) - skipping refresh`,
      );
      throw new Error("Request aborted - account switched");
    }
    // CRITICAL: Check if this endpoint has already failed too many times
    const retryCount = incrementEndpointRetry(path);
    if (retryCount > MAX_REFRESH_RETRIES) {
      console.error(
        `[apiGet] Max refresh retries (${MAX_REFRESH_RETRIES}) exceeded for ${path} - aborting to prevent infinite loop`,
      );
      throw new Error(`Max retries exceeded for ${path}`);
    }
    return tryRefreshAndRetry(
      (newToken) => apiGet(path, timeoutMs, newToken),
      requestGeneration,
      token,
    );
  }
  // Request succeeded, reset retry counter for this endpoint
  resetEndpointRetry(path);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw buildError(res, data);
  return data;
}

export async function apiPatch(path, body, timeoutMs, token) {
  // Capture generation at request initiation for stale request detection
  const requestGeneration = accountSwitchGeneration;

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
      timeoutMs,
    );
  } catch (e) {
    if (e && e.message === "Request timed out") throw e;
    throw new Error("Network error. Please check your connection.");
  }
  if (res.status === 401) {
    // Check if account switched before attempting refresh
    if (requestGeneration !== accountSwitchGeneration) {
      console.log(
        `[apiPatch] Request stale (gen ${requestGeneration} vs ${accountSwitchGeneration}) - skipping refresh`,
      );
      throw new Error("Request aborted - account switched");
    }
    return tryRefreshAndRetry(
      (newToken) => apiPatch(path, body, timeoutMs, newToken),
      requestGeneration,
      token,
    );
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw buildError(res, data);
  return data;
}

export async function apiDelete(path, body, timeoutMs, token) {
  // Capture generation at request initiation for stale request detection
  const requestGeneration = accountSwitchGeneration;

  const headers = {};
  if (token || body) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const options = { method: "DELETE", headers };
  if (body) options.body = JSON.stringify(body);
  let res;
  try {
    res = await withTimeout(
      fetch(`${BACKEND_BASE_URL}${path}`, options),
      timeoutMs || 15000,
    );
  } catch (e) {
    if (e && e.message === "Request timed out") throw e;
    throw new Error("Network error. Please check your connection.");
  }
  if (res.status === 401) {
    // Check if account switched before attempting refresh
    if (requestGeneration !== accountSwitchGeneration) {
      console.log(
        `[apiDelete] Request stale (gen ${requestGeneration} vs ${accountSwitchGeneration}) - skipping refresh`,
      );
      throw new Error("Request aborted - account switched");
    }
    return tryRefreshAndRetry(
      (newToken) => apiDelete(path, body, timeoutMs, newToken),
      requestGeneration,
      token,
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
      timeoutMs,
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

/**
 * Share a post to user(s) or copy link
 * @param {string} postId - Post ID to share
 * @param {Array} recipients - Array of {id, type} objects
 * @param {string} shareType - 'internal' or 'copy_link'
 * @param {string} message - Optional message
 */
export async function sharePost(postId, recipients, shareType, message, token) {
  return apiPost(
    `/posts/${postId}/share`,
    { recipients, shareType, message },
    15000,
    token,
  );
}

/**
 * Get recent chat users for share modal
 */
export async function getRecentChatUsers(token) {
  return apiGet("/chat/recent-users", 10000, token);
}

/**
 * Save a post
 */
export async function savePost(postId, token) {
  return apiPost(`/posts/${postId}/save`, {}, 15000, token);
}

/**
 * Unsave a post
 */
export async function unsavePost(postId, token) {
  return apiDelete(`/posts/${postId}/save`, null, 15000, token);
}

/**
 * Get saved posts
 * @param {number} offset - Pagination offset
 * @param {number} limit - Number of posts to fetch
 */
export async function getSavedPosts(offset = 0, limit = 20, token) {
  return apiGet(`/saved-posts?offset=${offset}&limit=${limit}`, 15000, token);
}

/**
 * Check save status for multiple posts
 * @param {Array} postIds - Array of post IDs
 */
export async function checkSaveStatus(postIds, token) {
  return apiPost("/posts/save-status/batch", { postIds }, 15000, token);
}

/**
 * CARD TIMING ENDPOINTS
 */

/**
 * Extend a card's deadline
 * @param {string} postId - Card/post ID
 * @param {string} newEndTime - ISO timestamp for new deadline
 * @param {string} reason - Optional reason for extension
 */
export async function extendCard(postId, newEndTime, reason, token) {
  return apiPost(
    `/posts/${postId}/extend`,
    { new_end_time: newEndTime, reason },
    15000,
    token,
  );
}

/**
 * Get extension history for a card
 * @param {string} postId - Card/post ID
 */
export async function getExtensionHistory(postId, token) {
  return apiGet(`/posts/${postId}/extensions`, 10000, token);
}

/**
 * Close an opportunity manually
 * @param {string} postId - Opportunity post ID
 */
export async function closeOpportunity(postId, token) {
  return apiPost(`/posts/${postId}/close`, {}, 10000, token);
}

/**
 * Mark Q&A question as resolved
 * @param {string} postId - Q&A post ID
 * @param {string} questionId - Question ID to resolve
 * @param {string} bestAnswerId - Optional best answer ID
 */
export async function resolveQnA(postId, questionId, bestAnswerId, token) {
  return apiPost(
    `/posts/${postId}/resolve`,
    { questionId, bestAnswerId },
    10000,
    token,
  );
}
