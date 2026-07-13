import { apiGet, apiPost } from './client';
import { getAuthToken } from './auth';

export async function getPostById(postId) {
  if (!postId) throw new Error('postId is required');
  const token = await getAuthToken();
  return apiGet(`/posts/${postId}`, 15000, token);
}

/**
 * Promote an event — creates an event_promo post.
 * @param {object} payload - { source_id, promo_text, engagement_type, engagement_data }
 */
export async function promoteEvent(payload) {
  const token = await getAuthToken();
  return apiPost('/posts', { post_type: 'event_promo', ...payload }, 15000, token);
}

/**
 * Promote a plan — creates a plan_promo post. Supports poll and qna only.
 * @param {object} payload - { source_id, promo_text, engagement_type, engagement_data }
 */
export async function promotePlan(payload) {
  const token = await getAuthToken();
  return apiPost('/posts', { post_type: 'plan_promo', ...payload }, 15000, token);
}

/**
 * Get the current week's promote quota.
 * @param {'event'|'plan'} sourceType
 */
export async function getPromoteQuota(sourceType = 'event') {
  const token = await getAuthToken();
  return apiGet(`/posts/promote-quota?source_type=${sourceType}`, 10000, token);
}
