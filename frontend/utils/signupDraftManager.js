/**
 * signupDraftManager.js
 *
 * Client-side draft manager for crash-safe signup flow.
 * A draft is NOT a real account - it's temporary local storage
 * that persists across app restarts until finalized or discarded.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import "react-native-get-random-values";
import { v4 as uuid } from "uuid";

const DRAFT_KEY = "signup_draft";
const DRAFT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Create a new signup draft
 * @param {string} email - Email for the new account
 * @param {string} originAccountId - ID of the currently logged-in account
 * @returns {Promise<object>} The created draft
 */
export async function createSignupDraft(email, originAccountId) {
  // Only 1 draft allowed - creating new one overwrites existing
  const draft = {
    id: `draft_${uuid()}`,
    createdAt: Date.now(),
    lastUpdatedAt: Date.now(),
    currentStep: "MemberEmail",
    data: {
      email: email.toLowerCase().trim(),
      name: null,
      profile_photo_url: null,
      dob: null,
      pronouns: [],
      showPronouns: true,
      gender: null,
      location: null,
      interests: [],
      phone: null,
      username: null,
    },
    originAccountId: originAccountId || null,
  };

  await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  console.log("[SignupDraft] ✅ Created draft:", draft.id, "for email:", email);
  return draft;
}

/**
 * Update an existing draft with step data
 * @param {string} stepName - Name of the completed step
 * @param {object} stepData - Data from this step
 * @returns {Promise<object|null>} Updated draft or null if no draft exists
 */
export async function updateSignupDraft(stepName, stepData) {
  try {
    const raw = await AsyncStorage.getItem(DRAFT_KEY);
    if (!raw) {
      console.log("[SignupDraft] ⚠️ No draft to update");
      return null;
    }

    const draft = JSON.parse(raw);
    draft.currentStep = stepName;
    draft.lastUpdatedAt = Date.now();
    draft.data = { ...draft.data, ...stepData };

    await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    console.log(
      "[SignupDraft] 📝 Updated step:",
      stepName,
      "data:",
      Object.keys(stepData)
    );
    return draft;
  } catch (error) {
    console.error("[SignupDraft] ❌ Update failed:", error.message);
    return null;
  }
}

/**
 * Get the current signup draft
 * @returns {Promise<object|null>} Draft or null if none/expired
 */
export async function getSignupDraft() {
  try {
    const raw = await AsyncStorage.getItem(DRAFT_KEY);
    if (!raw) {
      console.log("[SignupDraft] ℹ️ No draft found");
      return null;
    }

    const draft = JSON.parse(raw);

    // Check TTL expiry
    if (Date.now() - draft.createdAt > DRAFT_TTL_MS) {
      console.log("[SignupDraft] ⏰ Draft expired, deleting");
      await deleteSignupDraft();
      return null;
    }

    console.log(
      "[SignupDraft] 📋 Found draft:",
      draft.id,
      "step:",
      draft.currentStep
    );
    return draft;
  } catch (error) {
    console.error("[SignupDraft] ❌ Get failed:", error.message);
    return null;
  }
}

/**
 * Delete the signup draft (cancel or complete)
 * @returns {Promise<void>}
 */
export async function deleteSignupDraft() {
  try {
    await AsyncStorage.removeItem(DRAFT_KEY);
    console.log("[SignupDraft] 🗑️ Draft deleted");
  } catch (error) {
    console.error("[SignupDraft] ❌ Delete failed:", error.message);
  }
}

/**
 * Get only the data portion of the draft (for screen hydration)
 * @returns {Promise<object|null>} Draft data or null
 */
export async function getDraftData() {
  const draft = await getSignupDraft();
  return draft?.data || null;
}

/**
 * Check if a draft exists without expiry check
 * @returns {Promise<boolean>}
 */
export async function hasSignupDraft() {
  try {
    const raw = await AsyncStorage.getItem(DRAFT_KEY);
    return raw !== null;
  } catch {
    return false;
  }
}

/**
 * Map step name to next screen
 * @param {string} currentStep - The last completed step
 * @returns {string} Next screen name
 */
export function getNextScreenForStep(currentStep) {
  const stepToNextScreen = {
    MemberEmail: "MemberName",
    MemberName: "MemberProfilePic",
    MemberProfilePic: "MemberAge",
    MemberAge: "MemberPronouns",
    MemberPronouns: "MemberGender",
    MemberGender: "MemberLocation",
    MemberLocation: "MemberInterests",
    MemberInterests: "MemberPhone",
    MemberPhone: "MemberUsername",
    MemberUsername: "COMPLETE",
  };
  return stepToNextScreen[currentStep] || "MemberName";
}

/**
 * Get the current step screen (for resume)
 * @param {string} lastStep - The last completed step
 * @returns {string} Screen to resume from
 */
export function getResumeScreen(lastStep) {
  // Resume at the next step after the last completed one
  return getNextScreenForStep(lastStep);
}

export default {
  createSignupDraft,
  updateSignupDraft,
  getSignupDraft,
  deleteSignupDraft,
  getDraftData,
  hasSignupDraft,
  getNextScreenForStep,
  getResumeScreen,
};
