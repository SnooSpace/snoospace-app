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
      occupation: null,
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
    MemberInterests: "MemberOccupation",
    MemberOccupation: "MemberPhone",
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
      // Auth tokens — persisted so draft-resume can call the signup API
      accessToken: null,
      refreshToken: null,
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
    CommunityCategory: "CommunityLocation", // Default, varies by type
    IndividualLocation: "CommunityHeadName",
    CommunityLocation: "CommunityHeadName",
    CommunityHeadName: "CommunityPhone",
    CommunityPhone: "CommunitySponsorType", // Default, varies by type
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

  // 'CommunityOtp' step means email was verified but type not yet selected
  // Resume at CommunityTypeSelect (first screen after OTP)
  if (lastStep === "CommunityOtp") {
    return "CommunityTypeSelect";
  }

  // Default fallback — safe starting point after OTP
  return "CommunityTypeSelect";
}

/**
 * Get the full ordered stack of screens to reconstruct upon draft resume.
 * Returns all screens the user would have visited up to and including the resume screen,
 * so the navigator has a proper history and all back buttons work correctly.
 *
 * @param {string} lastStep - The last completed step (currentStep from draft)
 * @param {object} draftData - The draft's data object (used to determine branch taken)
 * @returns {string[]} Ordered array of screen names (first = bottom of stack)
 */
export function getCommunityResumeStack(lastStep, draftData = {}) {
  const {
    community_type,
    college_id,
    college_subtype,
    club_type,
    isStudentCommunity,
  } = draftData;

  const isCollege = community_type === "college_affiliated";

  // Base screens that come after OTP for all types
  // We always start the stack from CommunityTypeSelect (first screen after OTP)
  const baseStack = ["CommunityTypeSelect"];

  // College-specific branch before CommunityName
  const collegePreNameStack = ["CollegeSearch", "CollegeSubtypeSelect"];
  if (college_subtype === "club") {
    collegePreNameStack.push("CollegeClubType");
  } else if (college_subtype === "student_community") {
    collegePreNameStack.push("StudentCommunityTheme");
  }

  // Core screens shared by all types after type selection
  const coreStack = [
    "CommunityName",
    "CommunityLogo",
    "CommunityBio",
    "CommunityCategory",
  ];

  // Location branch
  let locationStack = [];
  if (!isStudentCommunity) {
    if (community_type === "individual_organizer") {
      locationStack = ["IndividualLocation"];
    } else {
      locationStack = ["CommunityLocation"];
    }
  }

  // Post-location screens vary by type:
  // - College -> CollegeHeads -> CommunitySponsorType -> CommunityUsername
  // - Organization -> CommunityHeadName -> CommunityPhone -> CommunitySponsorType -> CommunityUsername
  // - Individual -> CommunityHeadName -> CommunityPhone -> CommunityUsername (no SponsorType)
  const orgPostStack = [
    "CommunityHeadName",
    "CommunityPhone",
    "CommunitySponsorType",
  ];
  const collegePostStack = ["CollegeHeads", "CommunitySponsorType"];
  const individualPostStack = ["CommunityHeadName", "CommunityPhone"];

  // Build the full ordered path based on community type
  let fullPath;
  if (isCollege) {
    fullPath = [
      ...baseStack,
      ...collegePreNameStack,
      ...coreStack,
      ...locationStack,
      ...collegePostStack,
      "CommunityUsername",
    ];
  } else if (community_type === "organization") {
    fullPath = [
      ...baseStack,
      ...coreStack,
      ...locationStack,
      ...orgPostStack,
      "CommunityUsername",
    ];
  } else {
    // Individual organizer — Phone + HeadName, then directly to Username (no SponsorType)
    fullPath = [
      ...baseStack,
      ...coreStack,
      ...locationStack,
      ...individualPostStack,
      "CommunityUsername",
    ];
  }

  // Find where the resume screen falls in the full path
  const resumeScreen = getCommunityResumeScreen(lastStep);
  const resumeIndex = fullPath.indexOf(resumeScreen);

  if (resumeIndex === -1) {
    // Screen not in known path — safe fallback
    return ["CommunityTypeSelect"];
  }

  // Return the stack up to and including the resume screen
  return fullPath.slice(0, resumeIndex + 1);
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
  getCommunityResumeStack,
};
