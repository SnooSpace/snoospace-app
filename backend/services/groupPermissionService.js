/**
 * GroupPermissionService
 * Centralizes lifecycle and role-based permissions for group conversations.
 */

const LIFECYCLE = {
  ACTIVE: 'ACTIVE',
  CLOSED: 'CLOSED',
  LOCKED: 'LOCKED',
  ARCHIVED: 'ARCHIVED',
  DELETED: 'DELETED',
};

/**
 * Check if a user is allowed to send a message in a group.
 * @param {string} status - Conversation status (ACTIVE, CLOSED, etc.)
 * @param {string} userRole - User's role in group ('admin', 'member', etc.)
 * @returns {boolean}
 */
const canSendMessage = (status, userRole) => {
  if (
    status === LIFECYCLE.CLOSED ||
    status === LIFECYCLE.LOCKED ||
    status === LIFECYCLE.ARCHIVED ||
    status === LIFECYCLE.DELETED
  ) {
    return false;
  }
  return true;
};

/**
 * Check if a user is allowed to add/invite members to a group.
 * @param {string} status - Conversation status
 * @param {boolean} isOwner - Whether the user is the group owner
 * @param {string} userRole - User's role in group ('admin', etc.)
 * @param {boolean} adminOnlyInvite - Group setting
 * @returns {boolean}
 */
const canAddMembers = (status, isOwner, userRole, adminOnlyInvite) => {
  if (
    status === LIFECYCLE.CLOSED ||
    status === LIFECYCLE.LOCKED ||
    status === LIFECYCLE.ARCHIVED ||
    status === LIFECYCLE.DELETED
  ) {
    // Only the owner can add members when closed
    return isOwner;
  }
  // When active, check normal invite permissions
  if (adminOnlyInvite) {
    return userRole === 'admin';
  }
  return true;
};

/**
 * Check if a user is allowed to update group settings.
 * @param {string} status - Conversation status
 * @param {boolean} isOwner - Whether the user is the group owner
 * @param {string} userRole - User's role ('admin', etc.)
 * @returns {boolean}
 */
const canEditSettings = (status, isOwner, userRole) => {
  if (
    status === LIFECYCLE.CLOSED ||
    status === LIFECYCLE.LOCKED ||
    status === LIFECYCLE.ARCHIVED ||
    status === LIFECYCLE.DELETED
  ) {
    // Only the owner can edit settings when closed
    return isOwner;
  }
  // When active, any admin can manage settings
  return userRole === 'admin';
};

/**
 * Check if reactions are allowed.
 */
const canReact = (status) => {
  if (
    status === LIFECYCLE.CLOSED ||
    status === LIFECYCLE.LOCKED ||
    status === LIFECYCLE.ARCHIVED ||
    status === LIFECYCLE.DELETED
  ) {
    return false;
  }
  return true;
};

/**
 * Check if voting is allowed.
 */
const canVote = (status) => {
  if (
    status === LIFECYCLE.CLOSED ||
    status === LIFECYCLE.LOCKED ||
    status === LIFECYCLE.ARCHIVED ||
    status === LIFECYCLE.DELETED
  ) {
    return false;
  }
  return true;
};

module.exports = {
  LIFECYCLE,
  canSendMessage,
  canAddMembers,
  canEditSettings,
  canReact,
  canVote,
};
