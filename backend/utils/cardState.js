/**
 * Card State Utilities
 * Computes state for different card types based on timing rules
 */

/**
 * Compute card state based on timing rules from design spec
 * @param {Object} card - Card/post object with timing fields
 * @returns {string} State: 'active', 'ended', 'featured', 'evergreen', 'open', 'resolved', 'closed', 'open_ended'
 */
function getCardState(card) {
  const now = new Date();
  const { post_type, expires_at, closed_at, created_at } = card;

  // Prompt cards: Featured (0-72h) or Evergreen (72h+)
  if (post_type === "prompt") {
    const ageHours = (now - new Date(created_at)) / (1000 * 60 * 60);
    return ageHours < 72 ? "featured" : "evergreen";
  }

  // Q&A cards: Check if any question is resolved (requires DB query, so handled in controller)
  // For basic check, this util can return 'open' by default
  if (post_type === "qna") {
    return "open"; // More detailed state requires querying qna_questions table
  }

  // Opportunity cards with manual closure
  if (post_type === "opportunity" && closed_at) {
    return "closed";
  }

  // Time-based cards (Poll, Challenge, Opportunity with deadline)
  if (expires_at) {
    const expiresDate = new Date(expires_at);
    return now >= expiresDate ? "ended" : "active";
  }

  // Default: open-ended (e.g., Opportunities without deadline)
  return "open_ended";
}

/**
 * Check if card can be extended based on design rules
 * @param {Object} card - Card/post object
 * @returns {Object} { canExtend: boolean, reason: string }
 */
function canExtendCard(card) {
  const now = new Date();
  const { post_type, expires_at, extension_count = 0 } = card;

  // Only poll, challenge, and opportunity support extensions
  if (!["poll", "challenge", "opportunity"].includes(post_type)) {
    return {
      canExtend: false,
      reason: "This card type does not support extensions",
    };
  }

  // Cannot extend if already expired
  if (expires_at && new Date(expires_at) <= now) {
    return {
      canExtend: false,
      reason: "Cannot extend after end time has passed",
    };
  }

  // No end time set - cannot extend what doesn't have a deadline
  if (!expires_at) {
    return { canExtend: false, reason: "No deadline set to extend" };
  }

  // Check extension limits by card type
  const limits = {
    poll: { max: 1, lockoutHours: 0 },
    challenge: { max: 2, lockoutHours: 2 },
    opportunity: { max: 999, lockoutHours: 0 }, // Effectively unlimited
  };

  const limit = limits[post_type];

  // Check max extension count
  if (extension_count >= limit.max) {
    return {
      canExtend: false,
      reason: `Maximum ${limit.max} extension(s) already used`,
    };
  }

  // Check lockout period for challenges
  if (post_type === "challenge" && limit.lockoutHours > 0) {
    const expiresDate = new Date(expires_at);
    const hoursUntilExpiry = (expiresDate - now) / (1000 * 60 * 60);

    if (hoursUntilExpiry < limit.lockoutHours) {
      return {
        canExtend: false,
        reason: `Cannot extend in the final ${limit.lockoutHours} hours before deadline`,
      };
    }
  }

  return { canExtend: true, reason: null };
}

/**
 * Get user-friendly state label
 * @param {string} state
 * @returns {string}
 */
function getStateLabel(state) {
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
}

/**
 * Check if voting/submission should be disabled
 * @param { string} state
 * @param {string} cardType
 * @returns {boolean}
 */
function isInteractionDisabled(state, cardType) {
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
}

module.exports = {
  getCardState,
  canExtendCard,
  getStateLabel,
  isInteractionDisabled,
};
