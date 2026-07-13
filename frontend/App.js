import "react-native-gesture-handler";
import "react-native-get-random-values";
import React, { useEffect, useState } from "react";
import { View, StyleSheet } from "react-native";
import { NavigationContainer, CommonActions, DefaultTheme } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useFonts } from "expo-font";
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
} from "@expo-google-fonts/manrope";
import AppNavigator from "./navigation/AppNavigator";
import {
  getAuthToken,
  getAuthEmail,
  getPendingOtp,
  clearPendingOtp,
} from "./api/auth";
import { apiPost } from "./api/client";
import {
  NotificationsProvider,
  useNotifications,
} from "./context/NotificationsContext";
import NotificationBanner from "./components/NotificationBanner";
import { useTokenRefresh } from "./hooks/useTokenRefresh";
import { AuthStateProvider } from "./contexts/AuthStateContext";
import { ProfileCacheProvider } from "./context/ProfileCacheContext";
import { StatusBarManagerProvider } from "./contexts/StatusBarManager";
import { VideoProvider } from "./context/VideoContext";
import AnimatedSplashScreen from "./components/ui/AnimatedSplashScreen";
import { initSessionTracker, trackScreenVisit } from "./utils/sessionTracker";

import * as Notifications from "expo-notifications";
import { registerPushTokenWithBackend } from "./services/pushNotificationService";
import { connectSocket, disconnectSocket } from "./services/socketService";
import { useAuthState } from "./contexts/AuthStateContext";
import { useAppResume } from "./hooks/useAppResume";

import { ToastProvider } from "./context/ToastContext";
import AccountSwitchOverlay from "./components/ui/AccountSwitchOverlay";
import { EventVerificationProvider } from "./context/EventVerificationContext";
import EventVerificationOverlay from "./components/EventVerificationOverlay";

// NOTE: Notifications.setNotificationHandler is configured at module level
// in services/pushNotificationService.js. No duplicate call needed here.

const SnooTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: "#FFFFFF",
  },
};

function AppContent() {
  const { currentBanner, setCurrentBanner } = useNotifications();
  const navigationRef = React.useRef(null);
  const removeAppStateListenerRef = React.useRef(null);
  const { activeAccountEmail, refreshAuthState } = useAuthState();

  // ── Central Foreground Resume Handler ────────────────────────────────────
  // Runs a single ordered sequence on every background → foreground transition:
  //   1. Re-check auth state (detect server-side session invalidation)
  //   2. Reconnect socket and re-register user room
  //   3. Emit 'appResumed' EventBus event for any other subscriber
  // See hooks/useAppResume.js for full rationale.
  useAppResume({ onRefreshAuthState: refreshAuthState });

  // ── Socket.io & Push Notifications Sync ────────────────────────────────────
  useEffect(() => {
    if (activeAccountEmail) {
      console.log("[App] User session active, connecting socket and registering push token...");
      connectSocket();
      registerPushTokenWithBackend();
    } else {
      console.log("[App] No active user session, disconnecting socket...");
      disconnectSocket();
    }

    // Set up click listener for notification interaction (deep linking)
    const subscription = Notifications.addNotificationResponseReceivedListener(async response => {
      const data = response.notification.request.content.data;
      console.log("[App] User tapped notification. Data payload:", data);
      
      if (!data) return;

      const recipientId = data.recipientId;
      const recipientType = data.recipientType;

      if (recipientId && recipientType) {
        try {
          const { getActiveAccount, getAllAccounts, switchAccount } = require("./api/auth");
          const EventBus = require("./utils/EventBus").default;

          const activeAccount = await getActiveAccount();
          const activeCompositeId = activeAccount ? `${activeAccount.type}_${activeAccount.id}` : null;
          const recipientCompositeId = `${recipientType}_${recipientId}`;

          if (activeCompositeId !== recipientCompositeId) {
            const allAccounts = await getAllAccounts();
            const targetAccount = allAccounts.find(acc => `${acc.type}_${acc.id}` === recipientCompositeId);

            if (targetAccount && targetAccount.isLoggedIn !== false) {
              console.log(`[App] Switching account to recipient: ${recipientCompositeId}`);
              
              // Trigger premium switch overlay
              EventBus.emit("account-switch-start");

              // Switch active account in storage and trigger listeners
              await switchAccount(recipientCompositeId);

              // Complete transition toast & haptics
              EventBus.emit("account-switch-done", {
                name: targetAccount.name || targetAccount.username || "",
                username: targetAccount.username || "",
                photoUrl: targetAccount.profilePicture || null,
              });

              // Determine correct home screen
              const routeName =
                targetAccount.type === "member"
                  ? "MemberHome"
                  : targetAccount.type === "community"
                    ? "CommunityHome"
                    : targetAccount.type === "sponsor"
                      ? "SponsorHome"
                      : targetAccount.type === "venue"
                        ? "VenueHome"
                        : "Landing";

              // Reset navigation to target account's home stack, and stack deep link on top if present
              const routes = [{ name: routeName }];
              if (data.screen === "Chat" && data.chatId) {
                routes.push({
                  name: "Chat",
                  params: { conversationId: data.chatId },
                });
              }

              // Safely handle navigation readiness
              const performNavigation = () => {
                navigationRef.current?.reset({
                  index: routes.length - 1,
                  routes,
                });
              };

              if (navigationRef.current) {
                performNavigation();
              } else {
                // If ref is not ready, retry in 100ms
                const interval = setInterval(() => {
                  if (navigationRef.current) {
                    clearInterval(interval);
                    performNavigation();
                  }
                }, 100);
              }
              return;
            } else {
              console.log("[App] Target account not found in switcher or is logged out. Skipping auto-switch.");
            }
          }
        } catch (switchError) {
          console.error("[App] Error switching account from notification:", switchError);
        }
      }

      // Fallback: standard deep linking for active account
      if (data.screen === "Chat" && data.chatId) {
        console.log(`[App] Deep linking to Chat screen with chatId: ${data.chatId}`);
        navigationRef.current?.dispatch(
          CommonActions.navigate({
            name: "Chat",
            params: { conversationId: data.chatId },
          })
        );
      }
    });

    return () => {
      subscription.remove();
    };
  }, [activeAccountEmail]);

  // ── Session Tracking ─────────────────────────────────────────────────────
  // initSessionTracker subscribes to AppState (foreground/background) and
  // starts the first session. Returns a cleanup function for unmount.
  useEffect(() => {
    const cleanup = initSessionTracker();
    return cleanup;
  }, []);

  /**
   * Recursively resolve the currently active route name and its stack depth
   * from React Navigation's state tree.
   *
   * @param {object} navState  - Navigation state (or nested state)
   * @param {number} depth     - Current recursion depth (starts at 1)
   * @returns {{ name: string, depth: number }}
   */
  const getActiveRoute = (navState, depth = 1) => {
    if (!navState || navState.index === undefined) return { name: 'Unknown', depth };
    const route = navState.routes[navState.index];
    if (!route) return { name: 'Unknown', depth };
    if (route.state) {
      return getActiveRoute(route.state, depth + 1);
    }
    return { name: route.name, depth };
  };

  /**
   * Called by NavigationContainer on every navigation state change.
   * Extracts the active screen name and stack depth, then reports to sessionTracker.
   */
  const onNavigationStateChange = (state) => {
    if (!state) return;
    const { name, depth } = getActiveRoute(state);
    trackScreenVisit(name, depth);
  };
  // ─────────────────────────────────────────────────────────────────────────

  const handleBannerPress = () => {
    if (currentBanner?.type === "follow" && currentBanner?.actor_id) {
      // Navigate through nested structure: MemberHome -> MemberStack -> MemberPublicProfile
      navigationRef.current?.dispatch(
        CommonActions.navigate({
          name: "MemberHome",
          params: {
            screen: "MemberStack",
            params: {
              screen: "MemberPublicProfile",
              params: { memberId: currentBanner.actor_id },
            },
          },
        }),
      );
    }
  };

  return (
    <>
      <NavigationContainer
        ref={navigationRef}
        onStateChange={onNavigationStateChange}
        theme={SnooTheme}
      >
        <AppNavigator initialRouteName={"AuthGate"} />
      </NavigationContainer>
      <NotificationBanner
        notification={currentBanner}
        onPress={handleBannerPress}
        onDismiss={() => setCurrentBanner(null)}
      />
      <AccountSwitchOverlay />
      <EventVerificationOverlay />
    </>
  );
}

export default function App() {
  const [isSplashAnimationComplete, setAnimationComplete] = useState(false);

  // Load custom fonts
  const [fontsLoaded] = useFonts({
    "BasicCommercial-Bold": require("./assets/fonts/BasicCommercialLT-Bold.ttf"),
    "BasicCommercial-Black": require("./assets/fonts/BasicCommercialLT-Black.ttf"),
    "Manrope-Regular": Manrope_400Regular,
    "Manrope-Medium": Manrope_500Medium,
    "Manrope-SemiBold": Manrope_600SemiBold,
  });

  // Auto-refresh tokens when app comes to foreground
  useTokenRefresh();

  // The native splash screen stays visible until SplashScreen.hideAsync() is called in AnimatedSplashScreen
  if (!fontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <KeyboardProvider>
          <StatusBarManagerProvider>
            <AuthStateProvider>
              <ProfileCacheProvider>
                <NotificationsProvider>
                  <VideoProvider>
                    <ToastProvider>
                      <EventVerificationProvider>
                        <AppContent />
                      </EventVerificationProvider>
                    </ToastProvider>
                    
                    {!isSplashAnimationComplete && (
                      <AnimatedSplashScreen
                        onAnimationComplete={() => setAnimationComplete(true)}
                      />
                    )}
                  </VideoProvider>
                </NotificationsProvider>
              </ProfileCacheProvider>
            </AuthStateProvider>
          </StatusBarManagerProvider>
        </KeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F9F9F9",
  },
});
