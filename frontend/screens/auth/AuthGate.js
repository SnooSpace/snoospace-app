/**
 * AuthGate.js
 *
 * Entry point for app navigation.
 * Handles session restore, draft recovery, and pending OTP flows.
 *
 * IMPORTANT: A draft is NOT a real account.
 * The logged-in account remains active until signup completes.
 */

import React, { useEffect, useState } from "react";
import { View } from "react-native";
import {
  getPendingOtp,
  getAuthToken,
  getAuthEmail,
  getRefreshToken,
  getPendingAccountSelection,
} from "../../api/auth";
import { apiPost } from "../../api/client";
import { COLORS } from "../../constants/theme";
import {
  getSignupDraft,
  deleteSignupDraft,
  getResumeScreen,
  getPeopleProfileResumeScreen,
  getCommunitySignupDraft,
  deleteCommunitySignupDraft,
  getCommunityResumeScreen,
  getCommunityResumeStack,
} from "../../utils/signupDraftManager";
import {
  startForegroundWatch,
  attachAppStateListener,
} from "../../services/LocationTracker";
import DraftRecoveryModal from "../../components/modals/DraftRecoveryModal";

export default function AuthGate({ navigation }) {
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [draft, setDraft] = useState(null);
  const [draftType, setDraftType] = useState(null); // "member" or "community"
  const [pendingNavigation, setPendingNavigation] = useState(null);

  useEffect(() => {
    initializeApp();
  }, []);

  async function initializeApp() {
    try {
      // STEP 1: Migrate existing user to multi-account system (if needed)
      const { migrateExistingUser } = require("../../utils/accountManager");
      await migrateExistingUser();

      // Pre-emptive: refresh access token if we have a refresh token
      try {
        const rt = await getRefreshToken();
        if (rt && rt.length >= 20) {
          const sessionManager = require("../../utils/sessionManager");
          await sessionManager.refreshTokens(rt);
        }
      } catch {}

      // STEP 2: Check for pending OTP (highest priority)
      const pending = await getPendingOtp();
      if (pending && pending.email) {
        if (pending.flow === "login") {
          navigation.reset({
            index: 0,
            routes: [{ name: "LoginOtp", params: { email: pending.email } }],
          });
          return;
        }
        if (pending.flow === "signup_member") {
          navigation.reset({
            index: 0,
            routes: [
              {
                name: "MemberSignup",
                state: {
                  index: 1,
                  routes: [
                    { name: "MemberEmail" },
                    { name: "MemberOtp", params: { email: pending.email } },
                  ],
                },
              },
            ],
          });
          return;
        }
      }

      // STEP 2.5: Check for pending account selection (mid-picker crash/kill recovery)
      // This takes priority over session navigation — user must finish account selection.
      const pendingSelection = await getPendingAccountSelection();
      if (pendingSelection && pendingSelection.email && pendingSelection.accounts?.length > 0) {
        console.log('[AuthGate] Pending account selection found, redirecting to OTP screen for picker restore');
        if (pendingSelection.flow === 'login') {
          navigation.reset({
            index: 0,
            routes: [{ name: 'LoginOtp', params: { email: pendingSelection.email } }],
          });
          return;
        }
        if (pendingSelection.flow === 'signup_member') {
          navigation.reset({
            index: 0,
            routes: [{
              name: 'MemberSignup',
              state: {
                index: 1,
                routes: [
                  { name: 'MemberEmail' },
                  { name: 'MemberOtp', params: { email: pendingSelection.email } },
                ],
              },
            }],
          });
          return;
        }
        if (pendingSelection.flow === 'signup_community') {
          navigation.reset({
            index: 0,
            routes: [{
              name: 'CommunitySignup',
              state: {
                index: 1,
                routes: [
                  { name: 'CommunityEmail' },
                  { name: 'CommunityOtp', params: { email: pendingSelection.email } },
                ],
              },
            }],
          });
          return;
        }
      }

      // STEP 3: Check for active session
      const token = await getAuthToken();
      const email = await getAuthEmail();

      if (!token || !email) {
        // No session - go to landing
        navigation.reset({ index: 0, routes: [{ name: "Landing" }] });
        return;
      }

      // STEP 4: Check for signup drafts (Member or Community)
      console.log("[AuthGate] 🔍 Checking for signup drafts...");

      // Check Member draft first
      const memberDraft = await getSignupDraft();
      if (memberDraft) {
        console.log(
          "[AuthGate] 📋 Found Member draft:",
          memberDraft.id,
          "step:",
          memberDraft.currentStep
        );
        setDraft(memberDraft);
        setDraftType("member");

        // Store navigation info for after user decision
        const profile = await apiPost(
          "/auth/get-user-profile",
          { email },
          8000,
          token
        );
        const role = profile?.role;
        const homeRoute =
          role === "member"
            ? "MemberHome"
            : role === "community"
            ? "CommunityHome"
            : role === "sponsor"
            ? "SponsorHome"
            : role === "venue"
            ? "VenueHome"
            : "Landing";

        setPendingNavigation({ route: homeRoute });
        setShowRecoveryModal(true);
        return;
      }

      // Check Community draft
      const communityDraft = await getCommunitySignupDraft();
      if (communityDraft) {
        console.log(
          "[AuthGate] 📋 Found Community draft:",
          communityDraft.id,
          "step:",
          communityDraft.currentStep
        );
        setDraft(communityDraft);
        setDraftType("community");

        // Store navigation info for after user decision
        const profile = await apiPost(
          "/auth/get-user-profile",
          { email },
          8000,
          token
        );
        const role = profile?.role;
        const homeRoute =
          role === "member"
            ? "MemberHome"
            : role === "community"
            ? "CommunityHome"
            : role === "sponsor"
            ? "SponsorHome"
            : role === "venue"
            ? "VenueHome"
            : "Landing";

        setPendingNavigation({ route: homeRoute });
        setShowRecoveryModal(true);
        return;
      }

      // STEP 5: No draft - proceed to home
      console.log("[AuthGate] ℹ️ No draft, proceeding to home");
      await navigateToHome(email, token);
    } catch (error) {
      console.error("[AuthGate] Error:", error);
      navigation.reset({ index: 0, routes: [{ name: "Landing" }] });
    }
  }

  async function navigateToHome(email, token) {
    try {
      const profile = await apiPost(
        "/auth/get-user-profile",
        { email },
        8000,
        token
      );
      const role = profile?.role;
      const routeName =
        role === "member"
          ? "MemberHome"
          : role === "community"
          ? "CommunityHome"
          : role === "sponsor"
          ? "SponsorHome"
          : role === "venue"
          ? "VenueHome"
          : "Landing";

      console.log("[AuthGate] Starting location tracking...");
      await startForegroundWatch();
      attachAppStateListener();

      navigation.reset({ index: 0, routes: [{ name: routeName }] });

      // Background token validation (non-blocking)
      try {
        const { validateToken } = require("../../api/auth");
        const isValid = await validateToken(token);
        if (!isValid) {
          console.log("[AuthGate] Token expired - will prompt on next action");
        }
      } catch {}
    } catch {
      navigation.reset({ index: 0, routes: [{ name: "Landing" }] });
    }
  }

  async function handleContinueDraft() {
    if (!draft) return;

    console.log(
      "[AuthGate] 🚀 Continuing",
      draftType,
      "draft at:",
      draft.currentStep
    );
    setShowRecoveryModal(false);

    if (draftType === "member") {
      const isPeopleProfile = !!draft.data?.fromCommunitySignup;

      if (isPeopleProfile) {
        // People-profile draft: community session is still active.
        if (draft.currentStep === "PeopleProfilePrompt") {
          // User was on PeopleProfilePromptScreen (hadn't chosen "Set up now" yet).
          // Take them back there so they can make their choice.
          console.log("[AuthGate] People-profile draft at PeopleProfilePrompt → returning to prompt screen");
          navigation.reset({
            index: 0,
            routes: [
              {
                name: "PeopleProfilePromptScreen",
                params: {
                  prefillRecovery: draft.data?.prefill || {},
                },
              },
            ],
          });
        } else {
          // User had already chosen "Set up now" — resume inside MemberSignup.
          const resumeScreen = getPeopleProfileResumeScreen(draft.currentStep);
          console.log("[AuthGate] Resuming People-profile draft at:", resumeScreen);
          navigation.reset({
            index: 0,
            routes: [
              {
                name: "MemberSignup",
                state: {
                  index: 0,
                  routes: [
                    {
                      name: resumeScreen,
                      params: {
                        ...draft.data,
                        prefill: draft.data?.prefill || {},
                        fromCommunitySignup: true,
                        isResumingDraft: true,
                      },
                    },
                  ],
                },
              },
            ],
          });
        }
      } else {
        // Normal member draft (has email + OTP)
        const resumeScreen = getResumeScreen(draft.currentStep);
        navigation.reset({
          index: 0,
          routes: [
            {
              name: "MemberSignup",
              state: {
                index: 0,
                routes: [
                  {
                    name: resumeScreen,
                    params: {
                      ...draft.data,
                      isResumingDraft: true,
                    },
                  },
                ],
              },
            },
          ],
        });
      }
    } else if (draftType === "community") {
      const screenStack = getCommunityResumeStack(draft.currentStep, draft.data || {});
      const sharedParams = {
        ...draft.data,
        isResumingDraft: true,
      };
      navigation.reset({
        index: 0,
        routes: [
          {
            name: "CommunitySignup",
            state: {
              index: screenStack.length - 1,
              routes: screenStack.map((screenName, i) => ({
                name: screenName,
                // Only pass full params to the resume (top) screen;
                // earlier screens hydrate from draft on their own
                params: i === screenStack.length - 1 ? sharedParams : { isResumingDraft: true },
              })),
            },
          },
        ],
      });
    }
  }

  async function handleDiscardDraft() {
    console.log("[AuthGate] 🗑️ Discarding", draftType, "draft");

    const isPeopleProfile = draftType === "member" && !!draft?.data?.fromCommunitySignup;

    if (draftType === "member") {
      await deleteSignupDraft();
    } else if (draftType === "community") {
      await deleteCommunitySignupDraft();
    }

    setShowRecoveryModal(false);
    setDraft(null);
    setDraftType(null);

    if (isPeopleProfile) {
      // User is still logged into their community account — go back to community home
      const token = await getAuthToken();
      const email = await getAuthEmail();
      await navigateToHome(email, token);
    } else if (pendingNavigation) {
      // Navigate to origin account home
      const token = await getAuthToken();
      const email = await getAuthEmail();
      await navigateToHome(email, token);
    } else {
      navigation.reset({ index: 0, routes: [{ name: "Landing" }] });
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <DraftRecoveryModal
        visible={showRecoveryModal}
        draftEmail={draft?.data?.fromCommunitySignup ? null : draft?.data?.email}
        draftType={draftType === "community" ? "Community" : "Member"}
        isPeopleProfile={!!(draftType === "member" && draft?.data?.fromCommunitySignup)}
        onContinue={handleContinueDraft}
        onDiscard={handleDiscardDraft}
      />
    </View>
  );
}
