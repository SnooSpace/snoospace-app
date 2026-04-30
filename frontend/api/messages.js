import { apiGet, apiPost, apiPut, apiPatch, apiDelete } from './client';
import { getAuthToken } from './auth';

// ─── Conversations ────────────────────────────────────────────────────────────

/** Get all conversations (DMs + groups) for the current user */
export async function getConversations() {
  const token = await getAuthToken();
  if (!token) throw new Error("Authentication token not found.");
  return apiGet('/messages/conversations', 15000, token);
}

/**
 * Get messages for a conversation (cursor-based pagination)
 * @param {number} conversationId
 * @param {{ before?: string, after?: string, limit?: number }} opts
 *   before  – ISO timestamp cursor; omit for initial load (returns most-recent messages)
 *   after   – ISO timestamp cursor; fetch only messages NEWER than this (polling forward pass)
 *   limit   – messages per page (default 20)
 */
export async function getMessages(conversationId, { before = null, after = null, limit = 20 } = {}) {
  const token = await getAuthToken();
  if (!token) throw new Error("Authentication token not found.");
  const params = new URLSearchParams({ limit: String(limit) });
  if (before) params.append("before", before);
  if (after)  params.append("after",  after);
  return apiGet(`/messages/conversations/${conversationId}?${params.toString()}`, 15000, token);
}


/**
 * Send a message — DM or group
 * @param {{ conversationId?, recipientId?, recipientType?, messageText, messageType?, reply_to_message_id? }} opts
 */
export async function sendMessage({ conversationId, recipientId, recipientType = 'member', messageText = '', messageType = 'text', reply_to_message_id, metadata = null }) {
  const token = await getAuthToken();
  if (!token) throw new Error("Authentication token not found.");
  return apiPost('/messages', { conversationId, recipientId, recipientType, messageText, messageType, reply_to_message_id, metadata }, 15000, token);
}

/** Mark a single message as read */
export async function markMessageRead(messageId) {
  const token = await getAuthToken();
  if (!token) throw new Error("Authentication token not found.");
  return apiPut(`/messages/${messageId}/read`, {}, 15000, token);
}

/** Get total unread conversation count */
export async function getUnreadCount() {
  const token = await getAuthToken();
  if (!token) throw new Error("Authentication token not found.");
  return apiGet('/messages/unread-count', 15000, token);
}

// ─── Group Conversations ──────────────────────────────────────────────────────

/**
 * Create a new group conversation
 * @param {{ groupName: string, groupAvatarUrl?: string, participants?: Array<{id, type}>, autoJoin?: boolean }} opts
 */
export async function createGroupConversation({ groupName, groupAvatarUrl, participants = [], autoJoin = false }) {
  const token = await getAuthToken();
  if (!token) throw new Error("Authentication token not found.");
  return apiPost('/messages/groups', { groupName, groupAvatarUrl, participants, autoJoin }, 15000, token);
}

/** Get participants of a group conversation */
export async function getGroupParticipants(conversationId) {
  const token = await getAuthToken();
  if (!token) throw new Error("Authentication token not found.");
  return apiGet(`/messages/groups/${conversationId}/participants`, 15000, token);
}

/**
 * Update group name / avatar / auto-join (admin only)
 * @param {number} conversationId
 * @param {{ groupName?, groupAvatarUrl?, communityAutoJoin? }} updates
 */
export async function updateGroupConversation(conversationId, updates) {
  const token = await getAuthToken();
  if (!token) throw new Error("Authentication token not found.");
  return apiPatch(`/messages/groups/${conversationId}`, updates, 15000, token);
}

/**
 * Add a member to a group
 * @param {number} conversationId
 * @param {number} participantId
 * @param {string} participantType
 */
export async function addGroupParticipant(conversationId, participantId, participantType = 'member') {
  const token = await getAuthToken();
  if (!token) throw new Error("Authentication token not found.");
  return apiPost(`/messages/groups/${conversationId}/participants`, { participantId, participantType }, 15000, token);
}

/**
 * Remove/kick a participant — or leave the group (pass own id)
 * @param {number} conversationId
 * @param {number} participantId
 * @param {string} participantType
 */
export async function removeGroupParticipant(conversationId, participantId, participantType = 'member') {
  const token = await getAuthToken();
  if (!token) throw new Error("Authentication token not found.");
  return apiDelete(`/messages/groups/${conversationId}/participants/${participantId}?participantType=${participantType}`, null, 15000, token);
}

/**
 * Transfer admin role (community accounts only)
 * @param {number} conversationId
 * @param {number} newAdminId
 * @param {string} newAdminType
 */
export async function transferAdmin(conversationId, newAdminId, newAdminType = 'member') {
  const token = await getAuthToken();
  if (!token) throw new Error("Authentication token not found.");
  return apiPost(`/messages/groups/${conversationId}/transfer-admin`, { newAdminId, newAdminType }, 15000, token);
}

// ─── Conversation Utilities ───────────────────────────────────────────────────

/** Hide a DM conversation (delete-for-me) */
export async function hideConversation(conversationId) {
  const token = await getAuthToken();
  if (!token) throw new Error("Authentication token not found.");
  return apiPost(`/messages/conversations/${conversationId}/hide`, {}, 15000, token);
}

/**
 * Report a conversation
 * @param {number} conversationId
 * @param {string} reason
 * @param {string} details
 */
export async function reportConversation(conversationId, reason, details = '') {
  const token = await getAuthToken();
  if (!token) throw new Error("Authentication token not found.");
  return apiPost(`/messages/conversations/${conversationId}/report`, { reason, details }, 15000, token);
}

// ─── Message Actions ──────────────────────────────────────────────────────────

/** Unsend (soft-delete) a message you sent */
export async function unsendMessage(messageId) {
  const token = await getAuthToken();
  if (!token) throw new Error("Authentication token not found.");
  return apiPatch(`/messages/${messageId}/unsend`, {}, 15000, token);
}

// ─── Group Auto-Join Invite ───────────────────────────────────────────────────

/** Check whether a member should see the join-group modal */
/**
 * Get a group-chat join invite for a community's auto-join group.
 * Called with a communityId — backend finds the first eligible group for that community.
 * Returns { invite: { conversationId, groupName, groupAvatarUrl, communityName } | null }
 */
export async function getGroupJoinInvite(communityId) {
  const token = await getAuthToken();
  if (!token) throw new Error("Authentication token not found.");
  return apiGet(`/messages/communities/${communityId}/join-invite`, 10000, token);
}

/** Dismiss the group join invite for a specific conversation */
export async function dismissGroupInvite(conversationId) {
  const token = await getAuthToken();
  if (!token) throw new Error("Authentication token not found.");
  return apiPost(`/messages/groups/${conversationId}/dismiss-invite`, {}, 10000, token);
}

/**
 * Self-join a community group chat from the invite modal.
 * The member does not need to already be a participant.
 * The group must have community_auto_join = true.
 */
export async function selfJoinGroup(conversationId) {
  const token = await getAuthToken();
  if (!token) throw new Error("Authentication token not found.");
  return apiPost(`/messages/groups/${conversationId}/self-join`, {}, 10000, token);
}

// ─── Conversation Mute ────────────────────────────────────────────────────────

/**
 * Mute a conversation (DM or group)
 * @param {number} conversationId
 * @param {string|null} mutedUntil - ISO date string, or null for indefinite
 */
export async function muteConversation(conversationId, mutedUntil = null) {
  const token = await getAuthToken();
  if (!token) throw new Error("Authentication token not found.");
  return apiPost(`/messages/conversations/${conversationId}/mute`, { mutedUntil }, 10000, token);
}

/**
 * Unmute a conversation
 * @param {number} conversationId
 */
export async function unmuteConversation(conversationId) {
  const token = await getAuthToken();
  if (!token) throw new Error("Authentication token not found.");
  return apiDelete(`/messages/conversations/${conversationId}/mute`, null, 10000, token);
}


// ─── Admin ────────────────────────────────────────────────────────────────────

/**
 * Admin: list chat reports
 * @param {{ status?: 'pending'|'resolved'|'dismissed'|'all', page?: number, limit?: number }} opts
 */
export async function getChatReports({ status = 'pending', page = 1, limit = 20 } = {}) {
  const token = await getAuthToken();
  if (!token) throw new Error("Authentication token not found.");
  return apiGet(`/admin/chat-reports?status=${status}&page=${page}&limit=${limit}`, 15000, token);
}

/** Admin: get a single chat report by ID */
export async function getChatReportById(reportId) {
  const token = await getAuthToken();
  if (!token) throw new Error("Authentication token not found.");
  return apiGet(`/admin/chat-reports/${reportId}`, 15000, token);
}

/**
 * Admin: resolve or dismiss a chat report
 * @param {number} reportId
 * @param {'resolved'|'dismissed'} status
 * @param {string} resolutionNote
 */
export async function resolveChatReport(reportId, status, resolutionNote = '') {
  const token = await getAuthToken();
  if (!token) throw new Error("Authentication token not found.");
  return apiPatch(`/admin/chat-reports/${reportId}/resolve`, { status, resolutionNote }, 15000, token);
}

