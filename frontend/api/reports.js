import { apiPost } from './client';

/**
 * Submit a report for any content type.
 *
 * @param {string} reportedType  'post' | 'event' | 'open_plan' | 'member' | 'comment' | 'community'
 * @param {number} reportedId    The ID of the content being reported
 * @param {string} reason        Short reason label (from the predefined list)
 * @param {string|null} description  Optional extra detail from the user
 * @param {string} token         Auth token
 */
export async function submitReport(reportedType, reportedId, reason, description, token) {
  return apiPost(
    '/reports',
    { reported_type: reportedType, reported_id: reportedId, reason, description: description || null },
    15000,
    token,
  );
}
