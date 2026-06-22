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

import { ToastProvider } from "./context/ToastContext";
import AccountSwitchOverlay from "./components/ui/AccountSwitchOverlay";

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
                      <AppContent />
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
