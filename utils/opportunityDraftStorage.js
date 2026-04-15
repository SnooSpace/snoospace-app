import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Opportunity Draft Storage Utilities
 * Manages saving, loading, and deleting opportunity drafts in AsyncStorage
 */

const DRAFT_PREFIX = "@opportunity_draft_";

/**
 * Get the storage key for a user's opportunity draft
 */
export const getDraftKey = (userId) => `${DRAFT_PREFIX}${userId}`;

/**
 * Save opportunity draft to AsyncStorage
 * @param {string} userId - User ID (composite: type_id)
 * @param {number} currentStep - Current step in the form
 * @param {object} formData - All form data
 */
export const saveOpportunityDraft = async (userId, currentStep, formData) => {
  try {
    const draft = {
      lastSaved: new Date().toISOString(),
      currentStep,
      data: formData,
    };

    await AsyncStorage.setItem(getDraftKey(userId), JSON.stringify(draft));

    return { success: true };
  } catch (error) {
    console.error("Error saving opportunity draft:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Load opportunity draft from AsyncStorage
 * @param {string} userId - User ID (composite: type_id)
 * @returns {object|null} Draft object or null if not found
 */
export const loadOpportunityDraft = async (userId) => {
  try {
    const draftJson = await AsyncStorage.getItem(getDraftKey(userId));

    if (!draftJson) {
      return null;
    }

    const draft = JSON.parse(draftJson);
    return draft;
  } catch (error) {
    console.error("Error loading opportunity draft:", error);
    return null;
  }
};

/**
 * Delete opportunity draft from AsyncStorage
 * @param {string} userId - User ID (composite: type_id)
 */
export const deleteOpportunityDraft = async (userId) => {
  try {
    await AsyncStorage.removeItem(getDraftKey(userId));
    return { success: true };
  } catch (error) {
    console.error("Error deleting opportunity draft:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Check if a draft exists for a user
 * @param {string} userId - User ID (composite: type_id)
 * @returns {boolean} True if draft exists
 */
export const hasOpportunityDraft = async (userId) => {
  try {
    const draft = await AsyncStorage.getItem(getDraftKey(userId));
    return draft !== null;
  } catch (error) {
    console.error("Error checking for opportunity draft:", error);
    return false;
  }
};

/**
 * Format the last saved timestamp for display
 * @param {string} isoString - ISO timestamp string
 * @returns {string} Formatted string like "5 minutes ago"
 */
export const formatLastSaved = (isoString) => {
  const now = new Date();
  const saved = new Date(isoString);
  const diffMs = now - saved;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;

  return saved.toLocaleDateString();
};
