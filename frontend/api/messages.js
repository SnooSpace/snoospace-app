import { apiGet, apiPost, apiPut } from './client';
import { getAuthToken } from './auth';

/**
 * Get all conversations for the current user
 */
export async function getConversations() {
  const token = await getAuthToken();
  if (!token) throw new Error("Authentication token not found.");
  return apiGet('/messages/conversations', 15000, token);
}

/**
 * Get messages for a conversation
 * @param {number} conversationId - The conversation ID
 * @param {number} page - Page number (default: 1)
 * @param {number} limit - Messages per page (default: 50)
 */
export async function getMessages(conversationId, { page = 1, limit = 50 } = {}) {
  const token = await getAuthToken();
  if (!token) throw new Error("Authentication token not found.");
  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('limit', String(limit));
  return apiGet(`/messages/conversations/${conversationId}?${params.toString()}`, 15000, token);
}

/**
 * Send a message
 * @param {number} recipientId - The recipient member ID
 * @param {string} messageText - The message text
 */
export async function sendMessage(recipientId, messageText) {
  const token = await getAuthToken();
  if (!token) throw new Error("Authentication token not found.");
  return apiPost('/messages', {
    recipientId,
    messageText,
  }, 15000, token);
}

/**
 * Mark a message as read
 * @param {number} messageId - The message ID
 */
export async function markMessageRead(messageId) {
  const token = await getAuthToken();
  if (!token) throw new Error("Authentication token not found.");
  return apiPut(`/messages/${messageId}/read`, {}, 15000, token);
}

/**
 * Get unread message count
 */
export async function getUnreadCount() {
  const token = await getAuthToken();
  if (!token) throw new Error("Authentication token not found.");
  return apiGet('/messages/unread-count', 15000, token);
}

