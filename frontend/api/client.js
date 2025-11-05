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
    const res = await withTimeout(
      fetch(`${BACKEND_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: (await import('./auth')).getRefreshToken ? await (await import('./auth')).getRefreshToken() : null })
      }),
      15000
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error('Unauthorized');
    const newAccess = data?.data?.session?.access_token;
    const newRefresh = data?.data?.session?.refresh_token;
    if (newAccess) {
      const mod = await import('./auth');
      if (mod.setAccessToken) await mod.setAccessToken(newAccess);
    }
    // Note: we keep existing refresh token unless backend rotated; storing rotation is optional here
    return doRequest(newAccess);
  } catch {
    throw new Error('Unauthorized');
  }
}

export async function apiPost(path, body, timeoutMs, token) {
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


