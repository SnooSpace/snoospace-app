/**
 * disruptionReasons.js
 *
 * Shared constants and classification rules for event cancellations and postponements.
 */

const GENUINE_REASONS = [
  'venue_unavailable',
  'personal_emergency',
  'weather_safety',
];

const NON_GENUINE_REASONS = [
  'change_of_plans',
  'scheduling_conflict',
  'no_longer_available',
  'other',
];

const ALL_DISRUPTION_REASONS = [
  ...GENUINE_REASONS,
  ...NON_GENUINE_REASONS,
];

/**
 * Check if a disruption reason category is classified as genuine.
 * Genuine: venue_unavailable, personal_emergency, weather_safety.
 *
 * @param {string} reasonCategory
 * @returns {boolean}
 */
const isGenuineDisruption = (reasonCategory) => {
  return GENUINE_REASONS.includes(reasonCategory);
};

/**
 * Check if a disruption reason requires manual admin review.
 * 'other' always requires manual review.
 *
 * @param {string} reasonCategory
 * @returns {boolean}
 */
const needsManualReview = (reasonCategory) => {
  return reasonCategory === 'other';
};

module.exports = {
  GENUINE_REASONS,
  NON_GENUINE_REASONS,
  ALL_DISRUPTION_REASONS,
  isGenuineDisruption,
  needsManualReview,
};
