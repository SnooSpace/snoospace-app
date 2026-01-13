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
} from "../../api/auth";
import { apiPost } from "../../api/client";
import { COLORS } from "../../constants/theme";
import {
  getSignupDraft,
  deleteSignupDraft,
  getResumeScreen,
} from "../../utils/signupDraftManager";
import {
  startForegroundWatch,
  attachAppStateListener,
} from "../../services/LocationTracker";
import DraftRecoveryModal from "../../components/modals/DraftRecoveryModal";

export default function AuthGate({ navigation }) {
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [draft, setDraft] = useState(null);
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

      // STEP 3: Check for active session
      const token = await getAuthToken();
      const email = await getAuthEmail();

      if (!token || !email) {
        // No session - go to landing
        navigation.reset({ index: 0, routes: [{ name: "Landing" }] });
        return;
      }

      // STEP 4: Check for signup draft (show recovery modal if exists)
      console.log("[AuthGate] 🔍 Checking for signup draft...");
      const signupDraft = await getSignupDraft();

      if (signupDraft) {
        console.log(
          "[AuthGate] 📋 Found draft:",
          signupDraft.id,
          "step:",
          signupDraft.currentStep
        );
        setDraft(signupDraft);

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

    console.log("[AuthGate] 🚀 Continuing draft signup at:", draft.currentStep);
    setShowRecoveryModal(false);

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

  async function handleDiscardDraft() {
    console.log("[AuthGate] 🗑️ Discarding draft");
    await deleteSignupDraft();
    setShowRecoveryModal(false);
    setDraft(null);

    // Navigate to origin account home
    if (pendingNavigation) {
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
        draftEmail={draft?.data?.email}
        onContinue={handleContinueDraft}
        onDiscard={handleDiscardDraft}
      />
    </View>
  );
}
