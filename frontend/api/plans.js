import { apiGet, apiPost, apiPatch, apiDelete } from './client';
import { getAuthToken } from './auth';
import { BACKEND_BASE_URL } from './client';

// ─── Plans ──────────────────────────────────────────────────────────────────

export async function getPlans(cursor, token) {
  const q = cursor ? `?cursor=${cursor}&limit=20` : '?limit=20';
  return apiGet(`/plans${q}`, 15000, token);
}

export async function getPlanById(planId, token) {
  return apiGet(`/plans/${planId}`, 15000, token);
}

export async function createPlan(body, token) {
  return apiPost('/plans', body, 15000, token);
}

export async function updatePlan(planId, body, token) {
  return apiPatch(`/plans/${planId}`, body, 15000, token);
}

export async function cancelPlan(planId, token) {
  return apiDelete(`/plans/${planId}`, null, 15000, token);
}

export async function closePlan(planId, token) {
  return apiPost(`/plans/${planId}/close`, {}, 15000, token);
}

// ─── Requests ───────────────────────────────────────────────────────────────

export async function sendRequest(planId, note, token) {
  return apiPost(`/plans/${planId}/requests`, { note: note || null }, 15000, token);
}

export async function getRequests(planId, status = 'pending', token) {
  return apiGet(`/plans/${planId}/requests?status=${status}`, 15000, token);
}

export async function updateRequest(planId, reqId, status, token) {
  return apiPatch(`/plans/${planId}/requests/${reqId}`, { status }, 15000, token);
}

export async function withdrawRequest(planId, reqId, token) {
  return apiDelete(`/plans/${planId}/requests/${reqId}`, null, 15000, token);
}

// ─── Engagement ─────────────────────────────────────────────────────────────

export async function likePlan(planId, token) {
  return apiPost(`/plans/${planId}/likes`, {}, 10000, token);
}

export async function unlikePlan(planId, token) {
  return apiDelete(`/plans/${planId}/likes`, null, 10000, token);
}

export async function recordView(planId, token) {
  return apiPost(`/plans/${planId}/views`, {}, 10000, token);
}

export async function getComments(planId, token) {
  return apiGet(`/plans/${planId}/comments`, 15000, token);
}

export async function addComment(planId, content, token) {
  return apiPost(`/plans/${planId}/comments`, { content }, 15000, token);
}

export async function deleteComment(planId, cmtId, token) {
  return apiDelete(`/plans/${planId}/comments/${cmtId}`, null, 15000, token);
}

// ─── User Plans ─────────────────────────────────────────────────────────────

export async function getHostedPlans(token) {
  return apiGet('/users/me/plans/hosted', 15000, token);
}

export async function getAttendingPlans(token) {
  return apiGet('/users/me/plans/attending', 15000, token);
}

export async function getInterestedPlans(token) {
  return apiGet('/users/me/plans/interested', 15000, token);
}

export async function togglePlanInterest(planId, token) {
  return apiPost(`/plans/${planId}/interest`, {}, 10000, token);
}

// ─── Blocks ─────────────────────────────────────────────────────────────────

export async function blockUser(userId, token) {
  return apiPost(`/users/${userId}/block`, {}, 15000, token);
}

export async function unblockUser(userId, token) {
  return apiDelete(`/users/${userId}/block`, null, 15000, token);
}

export async function getBlockedUsers(token) {
  return apiGet('/users/me/blocks', 15000, token);
}

// ─── Verification ────────────────────────────────────────────────────────────

export async function getMyVerification(token) {
  return apiGet('/verifications/me', 15000, token);
}

export async function submitVerification(videoUri, token) {
  const formData = new FormData();
  const filename = videoUri.split('/').pop();
  const ext = filename.split('.').pop().toLowerCase();
  const mimeType = ext === 'mp4' ? 'video/mp4' : ext === 'mov' ? 'video/quicktime' : 'video/webm';
  formData.append('video', { uri: videoUri, name: filename, type: mimeType });

  const res = await fetch(`${BACKEND_BASE_URL}/verifications`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'Upload failed');
  return data;
}
