import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Event Draft Storage Utilities
 * Manages saving, loading, and deleting event drafts in AsyncStorage
 */

const DRAFT_PREFIX = '@event_draft_';

/**
 * Get the storage key for a community's event draft
 */
export const getDraftKey = (communityId) => `${DRAFT_PREFIX}${communityId}`;

/**
 * Save event draft to AsyncStorage
 * @param {number} communityId - Community ID
 * @param {number} currentStep - Current step in the form
 * @param {object} formData - All form data
 */
export const saveDraft = async (communityId, currentStep, formData) => {
  try {
    const draft = {
      lastSaved: new Date().toISOString(),
      currentStep,
      data: formData,
    };
    
    await AsyncStorage.setItem(
      getDraftKey(communityId),
      JSON.stringify(draft)
    );
    
    return { success: true };
  } catch (error) {
    console.error('Error saving draft:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Load event draft from AsyncStorage
 * @param {number} communityId - Community ID
 * @returns {object|null} Draft object or null if not found
 */
export const loadDraft = async (communityId) => {
  try {
    const draftJson = await AsyncStorage.getItem(getDraftKey(communityId));
    
    if (!draftJson) {
      return null;
    }
    
    const draft = JSON.parse(draftJson);
    return draft;
  } catch (error) {
    console.error('Error loading draft:', error);
    return null;
  }
};

/**
 * Delete event draft from AsyncStorage
 * @param {number} communityId - Community ID
 */
export const deleteDraft = async (communityId) => {
  try {
    await AsyncStorage.removeItem(getDraftKey(communityId));
    return { success: true };
  } catch (error) {
    console.error('Error deleting draft:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Check if a draft exists for a community
 * @param {number} communityId - Community ID
 * @returns {boolean} True if draft exists
 */
export const hasDraft = async (communityId) => {
  try {
    const draft = await AsyncStorage.getItem(getDraftKey(communityId));
    return draft !== null;
  } catch (error) {
    console.error('Error checking for draft:', error);
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
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  
  return saved.toLocaleDateString();
};
