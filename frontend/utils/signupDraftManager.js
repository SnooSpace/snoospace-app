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

// Separate draft keys for Member and Community flows
const MEMBER_DRAFT_KEY = "signup_draft_member";
const COMMUNITY_DRAFT_KEY = "signup_draft_community";
const DRAFT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Legacy key for backward compatibility
const DRAFT_KEY = MEMBER_DRAFT_KEY;

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

/**
 * ========================================
 * COMMUNITY SIGNUP DRAFT FUNCTIONS
 * ========================================
 */

/**
 * Create a new Community signup draft
 * @param {string} email - Email for the new account
 * @param {string} originAccountId - ID of the currently logged-in account
 * @returns {Promise<object>} The created draft
 */
export async function createCommunitySignupDraft(email, originAccountId) {
  const draft = {
    id: `draft_${uuid()}`,
    createdAt: Date.now(),
    lastUpdatedAt: Date.now(),
    currentStep: "CommunityOtp",
    data: {
      email: email.toLowerCase().trim(),
      community_type: null,
      college_id: null,
      college_name: null,
      college_subtype: null,
      club_type: null,
      community_theme: null,
      college_pending: false,
      isStudentCommunity: false,
      name: null,
      logo_url: null,
      bio: null,
      category: null,
      categories: [],
      location: null,
      phone: null,
      head_name: null,
      sponsor_type: null,
      username: null,
    },
    originAccountId: originAccountId || null,
  };

  await AsyncStorage.setItem(COMMUNITY_DRAFT_KEY, JSON.stringify(draft));
  console.log(
    "[CommunitySignupDraft] ✅ Created draft:",
    draft.id,
    "for email:",
    email
  );
  return draft;
}

/**
 * Update an existing Community draft with step data
 * @param {string} stepName - Name of the completed step
 * @param {object} stepData - Data from this step
 * @returns {Promise<object|null>} Updated draft or null if no draft exists
 */
export async function updateCommunitySignupDraft(stepName, stepData) {
  try {
    const raw = await AsyncStorage.getItem(COMMUNITY_DRAFT_KEY);
    if (!raw) {
      console.log("[CommunitySignupDraft] ⚠️ No draft to update");
      return null;
    }

    const draft = JSON.parse(raw);
    draft.currentStep = stepName;
    draft.lastUpdatedAt = Date.now();
    draft.data = { ...draft.data, ...stepData };

    await AsyncStorage.setItem(COMMUNITY_DRAFT_KEY, JSON.stringify(draft));
    console.log(
      "[CommunitySignupDraft] 📝 Updated step:",
      stepName,
      "data:",
      Object.keys(stepData)
    );
    return draft;
  } catch (error) {
    console.error("[CommunitySignupDraft] ❌ Update failed:", error.message);
    return null;
  }
}

/**
 * Get the current Community signup draft
 * @returns {Promise<object|null>} Draft or null if none/expired
 */
export async function getCommunitySignupDraft() {
  try {
    const raw = await AsyncStorage.getItem(COMMUNITY_DRAFT_KEY);
    if (!raw) {
      console.log("[CommunitySignupDraft] ℹ️ No draft found");
      return null;
    }

    const draft = JSON.parse(raw);

    // Check TTL expiry
    if (Date.now() - draft.createdAt > DRAFT_TTL_MS) {
      console.log("[CommunitySignupDraft] ⏰ Draft expired, deleting");
      await deleteCommunitySignupDraft();
      return null;
    }

    console.log(
      "[CommunitySignupDraft] 📋 Found draft:",
      draft.id,
      "step:",
      draft.currentStep
    );
    return draft;
  } catch (error) {
    console.error("[CommunitySignupDraft] ❌ Get failed:", error.message);
    return null;
  }
}

/**
 * Delete the Community signup draft
 * @returns {Promise<void>}
 */
export async function deleteCommunitySignupDraft() {
  try {
    await AsyncStorage.removeItem(COMMUNITY_DRAFT_KEY);
    console.log("[CommunitySignupDraft] 🗑️ Draft deleted");
  } catch (error) {
    console.error("[CommunitySignupDraft] ❌ Delete failed:", error.message);
  }
}

/**
 * Get only the data portion of the Community draft
 * @returns {Promise<object|null>} Draft data or null
 */
export async function getCommunityDraftData() {
  const draft = await getCommunitySignupDraft();
  return draft?.data || null;
}

/**
 * Check if a Community draft exists
 * @returns {Promise<boolean>}
 */
export async function hasCommunitySignupDraft() {
  try {
    const raw = await AsyncStorage.getItem(COMMUNITY_DRAFT_KEY);
    return raw !== null;
  } catch {
    return false;
  }
}

/**
 * Map Community step name to next screen
 * @param {string} currentStep - The last completed step
 * @returns {string} Next screen name
 */
export function getCommunityNextScreenForStep(currentStep) {
  const stepToNextScreen = {
    CommunityOtp: "CommunityTypeSelect",
    CommunityTypeSelect: "CommunityName", // Default, varies by type
    CollegeSearch: "CollegeSubtypeSelect",
    CollegeSubtypeSelect: "CommunityName", // May go to CollegeClubType or StudentCommunityTheme
    CollegeClubType: "CommunityName",
    StudentCommunityTheme: "CommunityName",
    CommunityName: "CommunityLogo",
    CommunityLogo: "CommunityBio",
    CommunityBio: "CommunityCategory",
    CommunityCategory: "CommunityLocationQuestion",
    CommunityLocationQuestion: "CommunityLocation", // Or skip to CommunityPhone
    CommunityLocation: "CommunityPhone",
    CommunityPhone: "CommunityHeadName",
    CommunityHeadName: "CommunitySponsorType",
    CommunitySponsorType: "CommunityUsername",
    CommunityUsername: "COMPLETE",
  };
  return stepToNextScreen[currentStep] || "CommunityTypeSelect";
}

/**
 * Get the Community screen to resume from
 * Returns the CURRENT step (where user left off), not the next step
 * @param {string} lastStep - The last completed step
 * @returns {string} Screen to resume from
 */
export function getCommunityResumeScreen(lastStep) {
  // Return the current step directly - we want to resume WHERE the user was,
  // not navigate to the next screen. The screen will hydrate data from draft.
  // If step isn't recognized, default to CommunityName (safe starting point after OTP)
  const validSteps = [
    "CommunityTypeSelect",
    "CollegeSearch",
    "CollegeSubtypeSelect",
    "CollegeClubType",
    "StudentCommunityTheme",
    "CommunityName",
    "CommunityLogo",
    "CommunityBio",
    "CommunityCategory",
    "CommunityLocationQuestion",
    "CommunityLocation",
    "IndividualLocation",
    "CollegeHeads",
    "CommunityPhone",
    "CommunityHeadName",
    "CommunitySponsorType",
    "CommunityUsername",
  ];

  if (validSteps.includes(lastStep)) {
    return lastStep;
  }

  // Default fallback
  return "CommunityName";
}

export default {
  // Member signup functions
  createSignupDraft,
  updateSignupDraft,
  getSignupDraft,
  deleteSignupDraft,
  getDraftData,
  hasSignupDraft,
  getNextScreenForStep,
  getResumeScreen,
  // Community signup functions
  createCommunitySignupDraft,
  updateCommunitySignupDraft,
  getCommunitySignupDraft,
  deleteCommunitySignupDraft,
  getCommunityDraftData,
  hasCommunitySignupDraft,
  getCommunityNextScreenForStep,
  getCommunityResumeScreen,
};
