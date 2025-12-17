import React, { useEffect } from "react";
import { View, AppState } from "react-native";
import { getPendingOtp, getAuthToken, getAuthEmail, getRefreshToken } from "../../api/auth";
import { apiPost } from "../../api/client";
import { startForegroundWatch, stopForegroundWatch, attachAppStateListener } from "../../services/LocationTracker";

export default function AuthGate({ navigation }) {
  useEffect(() => {
    (async () => {
      try {
        // STEP 1: Migrate existing user to multi-account system (if needed)
        const { migrateExistingUser } = require('../../utils/accountManager');
        await migrateExistingUser();
        
        // Pre-emptive: refresh access token if we have a refresh token (use V2)
        try {
          const rt = await getRefreshToken();
          if (rt && rt.length >= 20) {
            const sessionManager = require('../../utils/sessionManager');
            await sessionManager.refreshTokens(rt);
          }
        } catch {}

        const pending = await getPendingOtp();
        if (pending && pending.email) {
          if (pending.flow === 'login') {
            navigation.reset({ index: 0, routes: [{ name: 'LoginOtp', params: { email: pending.email } }] });
            return;
          }
          if (pending.flow === 'signup_member') {
            navigation.reset({
              index: 0,
              routes: [
                {
                  name: 'MemberSignup',
                  state: {
                    index: 1,
                    routes: [
                      { name: 'MemberEmail' },
                      { name: 'MemberOtp', params: { email: pending.email } },
                    ],
                  },
                },
              ],
            });
            return;
          }
        }

        const token = await getAuthToken();
        const email = await getAuthEmail();
        if (!token || !email) {
          navigation.reset({ index: 0, routes: [{ name: 'Landing' }] });
          return;
        }
        
        // STEP 2: Get profile and navigate (load UI immediately)
        const profile = await apiPost('/auth/get-user-profile', { email }, 8000, token);
        const role = profile?.role;
        const routeName = role === 'member' ? 'MemberHome'
          : role === 'community' ? 'CommunityHome'
          : role === 'sponsor' ? 'SponsorHome'
          : role === 'venue' ? 'VenueHome'
          : 'Landing';
        
        console.log('[AuthGate] Starting location tracking for authenticated user...');
        // Start location tracking for authenticated users
        // This will only request permission if not already granted (during signup)
        // IMPORTANT: Must await to ensure permission dialog appears before navigation
        await startForegroundWatch();
        
        // Set up AppState listener to manage location tracking lifecycle
        // This ensures tracking resumes when app becomes active
        const removeAppStateListener = attachAppStateListener();
        
        navigation.reset({ index: 0, routes: [{ name: routeName }] });
        
        // STEP 3: Validate token in background (non-blocking)
        try {
          const { validateToken } = require('../../api/auth');
          const isValid = await validateToken(token);
          if (!isValid) {
            console.log('[AuthGate] Token expired - user will need to re-login on next action');
            // Don't force logout immediately - let user continue using app
            // They'll be prompted to login when they try to perform an action
          }
        } catch (error) {
          // Silently handle validation errors during startup
          // Network errors are common during app load and shouldn't block the user
          console.log('[AuthGate] Background token validation failed (non-critical):', error.message);
        }
      } catch {
        navigation.reset({ index: 0, routes: [{ name: 'Landing' }] });
      }
    })();
  }, [navigation]);

  return <View style={{ flex: 1, backgroundColor: '#fff' }} />;
}


