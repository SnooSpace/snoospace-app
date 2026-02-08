/**
 * Card Timing Utilities
 * Helper functions for computing card states and formatting countdown timers
 */

/**
 * Compute card display state from timing fields
 * Maps backend timing fields to frontend UI state
 * @param {Object} post - Post object with timing fields
 * @returns {string} State: 'active', 'ended', 'featured', 'evergreen', 'open', 'resolved', 'closed', 'open_ended'
 */
export const getCardState = (post) => {
  const now = new Date();
  const { post_type, expires_at, closed_at, created_at } = post;

  // Prompt cards: Featured (0-72h) or Evergreen (72h+)
  if (post_type === "prompt") {
    const ageHours = (now - new Date(created_at)) / (1000 * 60 * 60);
    return ageHours < 72 ? "featured" : "evergreen";
  }

  // Q&A cards: Check if resolved (requires checking questions - handled in component)
  if (post_type === "qna") {
    return "open"; // Base state, component checks for resolved questions
  }

  // Opportunities with manual closure
  if (post_type === "opportunity" && closed_at) {
    return "closed";
  }

  // Time-based cards (Polls, Challenges, Opportunities with deadline)
  if (expires_at) {
    return now >= new Date(expires_at) ? "ended" : "active";
  }

  // Default: open-ended (e.g., Opportunities without deadline)
  return "open_ended";
};

/**
 * Get time remaining in milliseconds
 * @param {string} expiresAt - ISO timestamp
 * @returns {number} Milliseconds remaining (0 if expired)
 */
export const getTimeRemaining = (expiresAt) => {
  if (!expiresAt) return 0;
  const now = new Date();
  const expiry = new Date(expiresAt);
  return Math.max(0, expiry - now);
};

/**
 * Format countdown display string
 * @param {string} expiresAt - ISO timestamp
 * @returns {string} Formatted countdown ("3d 5h left", "5h left", "Ending soon", "Ended")
 */
export const formatCountdown = (expiresAt) => {
  if (!expiresAt) return null;

  const remaining = getTimeRemaining(expiresAt);

  if (remaining <= 0) return "Ended";

  const seconds = Math.floor(remaining / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  // > 7 days: "8d left"
  if (days > 7) {
    return `${days}d left`;
  }

  // 1-7 days: "3d 5h left"
  if (days >= 1) {
    const remainingHours = hours % 24;
    if (remainingHours > 0) {
      return `${days}d ${remainingHours}h left`;
    }
    return `${days}d left`;
  }

  // 1-24h: "5h 30m left"
  if (hours >= 1) {
    const remainingMinutes = minutes % 60;
    if (remainingMinutes > 0 && hours < 6) {
      return `${hours}h ${remainingMinutes}m left`;
    }
    return `${hours}h left`;
  }

  // < 1h but > 1m: "45m left"
  if (minutes >= 1) {
    return `${minutes}m left`;
  }

  // < 1m: "Ending soon"
  return "Ending soon";
};

/**
 * Get urgency color based on time remaining
 * @param {number} remainingMs - Milliseconds remaining
 * @returns {string} Color code
 */
export const getUrgencyColor = (remainingMs) => {
  const hours = remainingMs / (1000 * 60 * 60);

  if (hours < 1) return "#EF4444"; // Red: < 1h
  if (hours < 24) return "#F59E0B"; // Orange: < 24h
  return "#10B981"; // Green: > 24h
};

/**
 * Check if interaction should be disabled based on state
 * @param {string} state - Card state
 * @param {string} cardType - Card type (poll, challenge, opportunity, qna, prompt)
 * @returns {boolean} True if interaction should be disabled
 */
export const isInteractionDisabled = (state, cardType) => {
  // Polls: disable voting when ended
  if (cardType === "poll") {
    return state === "ended";
  }

  // Challenges: disable submissions when ended
  if (cardType === "challenge") {
    return state === "ended";
  }

  // Opportunities: disable applications when closed
  if (cardType === "opportunity") {
    return state === "closed";
  }

  // Q&A: always allow replies (even after resolution per design spec)
  if (cardType === "qna") {
    return false;
  }

  // Prompts: never disable (always evergreen)
  if (cardType === "prompt") {
    return false;
  }

  return false;
};

/**
 * Get user-friendly state label
 * @param {string} state
 * @returns {string}
 */
export const getStateLabel = (state) => {
  const labels = {
    active: "Active",
    ended: "Ended",
    featured: "Active",
    evergreen: "Active",
    open: "Open",
    resolved: "✓ Resolved",
    closed: "Closed",
    open_ended: "Active",
  };

  return labels[state] || "Active";
};

/**
 * Format extension badge text
 * @param {number} extensionCount
 * @returns {string}
 */
export const getExtensionBadgeText = (extensionCount) => {
  if (!extensionCount || extensionCount === 0) return null;
  if (extensionCount === 1) return "⏱️ Extended by creator";
  return `⏱️ Extended ${extensionCount}x`;
};
