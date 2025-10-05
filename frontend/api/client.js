export const BACKEND_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || "http://192.168.1.11:5000";

function withTimeout(promise, ms = 15000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("Request timed out")), ms)),
  ]);
}

export async function apiPost(path, body, timeoutMs, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await withTimeout(fetch(`${BACKEND_BASE_URL}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  }), timeoutMs);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = data?.error || "Request failed";
    throw new Error(message);
  }
  return data;
}

export async function apiGet(path, timeoutMs, token) {
  const headers = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await withTimeout(fetch(`${BACKEND_BASE_URL}${path}`, { headers }), timeoutMs);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = data?.error || "Request failed";
    throw new Error(message);
  }
  return data;
}


