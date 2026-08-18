import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Open Plan Draft Storage Utilities
 * Manages saving, loading, and deleting Open Plan drafts in AsyncStorage
 */

const PLAN_DRAFT_KEY = "@open_plan_draft";

/**
 * Save open plan draft to AsyncStorage
 * @param {object} formData - All form data
 */
export const savePlanDraft = async (formData) => {
  try {
    const draft = {
      lastSaved: new Date().toISOString(),
      data: formData,
    };

    await AsyncStorage.setItem(PLAN_DRAFT_KEY, JSON.stringify(draft));
    return { success: true };
  } catch (error) {
    console.error("Error saving plan draft:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Load open plan draft from AsyncStorage
 * @returns {object|null} Draft object or null if not found
 */
export const loadPlanDraft = async () => {
  try {
    const draftJson = await AsyncStorage.getItem(PLAN_DRAFT_KEY);

    if (!draftJson) {
      return null;
    }

    const draft = JSON.parse(draftJson);
    return draft;
  } catch (error) {
    console.error("Error loading plan draft:", error);
    return null;
  }
};

/**
 * Delete open plan draft from AsyncStorage
 */
export const deletePlanDraft = async () => {
  try {
    await AsyncStorage.removeItem(PLAN_DRAFT_KEY);
    return { success: true };
  } catch (error) {
    console.error("Error deleting plan draft:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Check if an open plan draft exists
 * @returns {boolean} True if draft exists
 */
export const hasPlanDraft = async () => {
  try {
    const draft = await AsyncStorage.getItem(PLAN_DRAFT_KEY);
    return draft !== null;
  } catch (error) {
    console.error("Error checking for plan draft:", error);
    return false;
  }
};

/**
 * Format the last saved timestamp for display
 * @param {string} isoString - ISO timestamp string
 * @returns {string} Formatted string like "5m ago" or "Yesterday"
 */
export const formatLastSaved = (isoString) => {
  if (!isoString) return "";
  try {
    const now = new Date();
    const saved = new Date(isoString);
    const diffMs = now - saved;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) {
      return "just now";
    } else if (diffMins < 60) {
      return `${diffMins} min${diffMins > 1 ? "s" : ""} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    } else if (diffDays === 1) {
      return "yesterday";
    } else {
      return saved.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
      });
    }
  } catch {
    return "";
  }
};
