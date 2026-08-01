/**
 * cardAvailabilityCache.js — Synchronous cache for unavailable shared cards.
 *
 * Prevents FlashList scroll drift by ensuring that deleted/missing shared cards
 * (posts, events, opportunities, plans) are recognized as unavailable on Frame 0
 * before overrideItemLayout computes initial scroll offset.
 */

const unavailableCardSet = new Set();

/**
 * Generates a unique key for a card type and ID.
 */
const getCardKey = (type, id) => `${type}_${id}`;

/**
 * Marks a card as unavailable in the synchronous cache.
 */
export const markCardUnavailable = (type, id) => {
  if (!id) return;
  const key = getCardKey(type, id);
  unavailableCardSet.add(key);
};

/**
 * Checks if a card is known to be unavailable synchronously on Frame 0.
 */
export const isCardUnavailableSync = (messageType, metadata) => {
  if (!metadata) return false;
  
  // If backend flagged metadata directly as unavailable
  if (metadata.is_unavailable === true || metadata.is_deleted === true) {
    return true;
  }

  const cardId =
    metadata.postId ||
    metadata.opportunityId ||
    metadata.eventId ||
    metadata.planId ||
    metadata.id ||
    metadata.opportunity_id ||
    metadata.event_id ||
    metadata.plan_id;

  if (!cardId) return false;

  const key = getCardKey(messageType, cardId);
  return unavailableCardSet.has(key);
};
