import { apiGet, apiPatch } from './client';
import { getAuthToken } from './auth';

export async function fetchNotifications({ limit = 20, offset = 0 } = {}) {
  const token = await getAuthToken();
  return apiGet(`/notifications?limit=${limit}&offset=${offset}`, 15000, token);
}

export async function fetchUnreadCount() {
  const token = await getAuthToken();
  return apiGet(`/notifications/unread-count`, 15000, token);
}

export async function markNotificationRead(id) {
  const token = await getAuthToken();
  return apiPatch(`/notifications/${id}/read`, {}, 15000, token);
}

export async function markAllNotificationsRead() {
  const token = await getAuthToken();
  return apiPatch(`/notifications/read-all`, {}, 15000, token);
}


