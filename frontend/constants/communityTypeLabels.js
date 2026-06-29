/**
 * communityTypeLabels.js
 *
 * Single source of truth for community type display labels and descriptions.
 * Valid community types: 'college_affiliated' | 'organization'
 * Note: 'individual_organizer' (Page) was removed — individual creators
 * should use Creator Mode on a Member account instead.
 */

export const COMMUNITY_TYPE_LABELS = {
  college_affiliated: {
    label: "College",
    description: "For college clubs, fests & student communities",
  },
  organization: {
    label: "Organization",
    description: "For NGOs, startups, run clubs, brands & more",
  },
};

/**
 * Returns the display label for a given community type identifier.
 * Falls back to the raw identifier if not found.
 *
 * @param {string} communityType - e.g. "college_affiliated" | "organization"
 * @returns {string}
 */
export function getCommunityTypeLabel(communityType) {
  return COMMUNITY_TYPE_LABELS[communityType]?.label ?? communityType ?? "";
}

/**
 * Returns the description for a given community type identifier.
 *
 * @param {string} communityType - e.g. "college_affiliated" | "organization"
 * @returns {string}
 */
export function getCommunityTypeDescription(communityType) {
  return COMMUNITY_TYPE_LABELS[communityType]?.description ?? "";
}
