/**
 * communityTypeLabels.js
 *
 * Single source of truth for community type display labels and descriptions.
 * The internal database identifier (e.g. "individual_organizer") never changes —
 * only the label shown in the UI is controlled here.
 */

export const COMMUNITY_TYPE_LABELS = {
  individual_organizer: {
    label: "Page",
    description:
      "For meme pages, brand accounts, fan pages & independent content creators",
  },
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
 * @param {string} communityType - e.g. "individual_organizer"
 * @returns {string} - e.g. "Page"
 */
export function getCommunityTypeLabel(communityType) {
  return COMMUNITY_TYPE_LABELS[communityType]?.label ?? communityType ?? "";
}

/**
 * Returns the description for a given community type identifier.
 *
 * @param {string} communityType - e.g. "individual_organizer"
 * @returns {string}
 */
export function getCommunityTypeDescription(communityType) {
  return COMMUNITY_TYPE_LABELS[communityType]?.description ?? "";
}
