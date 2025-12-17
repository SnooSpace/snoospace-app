export const BACKEND_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || "http://192.168.1.11:5000";

function withTimeout(promise, ms = 15000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("Request timed out")), ms)),
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
    console.log('[tryRefreshAndRetry] Attempting token refresh...');
    
    // CRITICAL: Capture account context BEFORE refresh to prevent race conditions
    // This ensures tokens are saved to the correct account even if user switches accounts
    const authModule = await import('./auth');
    const sessionManager = await import('../utils/sessionManager');
    const activeAccount = await authModule.getActiveAccount();
    const accountId = activeAccount?.id;
    const accountType = activeAccount?.type;
    
    console.log('[tryRefreshAndRetry] Captured account context:', {
      accountId,
      accountType,
      email: activeAccount?.email
    });
    
    const refreshToken = activeAccount?.refreshToken || await authModule.getRefreshToken();
    
    if (!refreshToken) {
      console.warn('[tryRefreshAndRetry] No refresh token available');
      throw new Error('Unauthorized');
    }
    
    console.log('[tryRefreshAndRetry] Refresh token length:', refreshToken?.length);
    
    // VALIDATION: Refresh tokens should be at least 20 characters
    // If token is too short, it's likely corrupted - skip refresh attempt
    if (refreshToken.length < 20) {
      console.error('[tryRefreshAndRetry] Refresh token is too short - likely corrupted:', refreshToken.length);
      console.error('[tryRefreshAndRetry] Account needs re-authentication');
      
      // Mark account as logged out to prevent infinite retry loops
      if (accountId) {
        const accountManager = await import('../utils/accountManager');
        await accountManager.updateAccount(accountId, { isLoggedIn: false });
        console.log('[tryRefreshAndRetry] Marked account as logged out due to invalid refresh token');
      }
      
      throw new Error('Unauthorized');
    }
    
    // Try V2 refresh first (new device-based sessions)
    let newAccess, newRefresh;
    
    try {
      console.log('[tryRefreshAndRetry] Trying V2 refresh endpoint...');
      const v2Result = await sessionManager.refreshTokens(refreshToken);
      newAccess = v2Result.accessToken;
      newRefresh = v2Result.refreshToken;
      console.log('[tryRefreshAndRetry] V2 refresh successful');
    } catch (v2Error) {
      console.log('[tryRefreshAndRetry] V2 refresh failed, trying V1 fallback:', v2Error.message);
      
      // Fallback to V1 endpoint for legacy sessions
      const res = await withTimeout(
        fetch(`${BACKEND_BASE_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refreshToken })
        }),
        15000
      );
      const data = await res.json().catch(() => ({}));
      
      if (!res.ok) {
        console.error('[tryRefreshAndRetry] V1 Refresh failed:', data?.error || res.statusText);
        
        // If refresh token was already used or is invalid, mark account as logged out
        if (data?.error?.includes('Already Used') || data?.error?.includes('Invalid') || res.status === 401) {
          console.error('[tryRefreshAndRetry] Refresh token invalid or already used - marking account for re-auth');
          if (accountId) {
            const accountManager = await import('../utils/accountManager');
            await accountManager.updateAccount(accountId, { isLoggedIn: false });
          }
        }
        
        throw new Error('Unauthorized');
      }
      
      newAccess = data?.data?.session?.access_token;
      newRefresh = data?.data?.session?.refresh_token;
    }
    
    if (newAccess) {
      console.log('[tryRefreshAndRetry] Got new access token, length:', newAccess?.length);
      
      // CRITICAL: Update tokens atomically for the SPECIFIC account that initiated refresh
      // This prevents race conditions when user switches accounts during API calls
      if (accountId) {
        // Update in sessionManager (V2)
        const compositeId = `${accountType}_${accountId}`;
        await sessionManager.updateLocalSession(compositeId, { 
          accessToken: newAccess, 
          refreshToken: newRefresh 
        });
        
        // Also update in accountManager for backward compatibility
        await authModule.updateAccountTokens(accountId, newAccess, newRefresh);
        console.log('[tryRefreshAndRetry] Tokens updated for account:', accountId);
      } else {
        // Fallback to old behavior if no account context (legacy support)
        console.warn('[tryRefreshAndRetry] No account context, using legacy token update');
        if (authModule.setAccessToken) await authModule.setAccessToken(newAccess);
        if (newRefresh && authModule.setRefreshToken) await authModule.setRefreshToken(newRefresh);
      }
    } else {
      console.warn('[tryRefreshAndRetry] No access token in refresh response');
    }
    
    return doRequest(newAccess);
  } catch (error) {
    console.error('[tryRefreshAndRetry] Error during refresh:', error.message);
    throw new Error('Unauthorized');
  }
}

export async function apiPost(path, body, timeoutMs, token) {
  console.log(`[apiPost] ${path}`, {
    hasToken: !!token,
    tokenLength: token?.length,
    bodyKeys: Object.keys(body || {})
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
    return tryRefreshAndRetry((newToken) => apiPost(path, body, timeoutMs, newToken));
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
    res = await withTimeout(fetch(`${BACKEND_BASE_URL}${path}`, { headers }), timeoutMs);
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
    return tryRefreshAndRetry((newToken) => apiPatch(path, body, timeoutMs, newToken));
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
    res = await withTimeout(fetch(`${BACKEND_BASE_URL}${path}`, options), timeoutMs || 15000);
  } catch (e) {
    if (e && e.message === "Request timed out") throw e;
    throw new Error("Network error. Please check your connection.");
  }
  if (res.status === 401) {
    return tryRefreshAndRetry((newToken) => apiDelete(path, body, timeoutMs, newToken));
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw buildError(res, data);
  return data;
}


