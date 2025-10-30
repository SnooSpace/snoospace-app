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
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw buildError(res, data);
  }
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
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw buildError(res, data);
  }
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
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw buildError(res, data);
  }
  return data;
}


