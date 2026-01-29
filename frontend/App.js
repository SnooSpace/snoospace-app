import "react-native-get-random-values";
import React, { useEffect, useState } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { NavigationContainer, CommonActions } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { KeyboardProvider } from "react-native-keyboard-controller";
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
import { StatusBarManagerProvider } from "./contexts/StatusBarManager";
import { VideoProvider } from "./context/VideoContext";

function AppContent() {
  const { currentBanner, setCurrentBanner } = useNotifications();
  const navigationRef = React.useRef(null);
  const removeAppStateListenerRef = React.useRef(null);

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
      <NavigationContainer ref={navigationRef}>
        <AppNavigator initialRouteName={"AuthGate"} />
      </NavigationContainer>
      <NotificationBanner
        notification={currentBanner}
        onPress={handleBannerPress}
        onDismiss={() => setCurrentBanner(null)}
      />
    </>
  );
}

export default function App() {
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

  // Show loading screen while fonts are loading
  if (!fontsLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1976D2" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <KeyboardProvider>
        <StatusBarManagerProvider>
          <AuthStateProvider>
            <NotificationsProvider>
              <VideoProvider>
                <AppContent />
              </VideoProvider>
            </NotificationsProvider>
          </AuthStateProvider>
        </StatusBarManagerProvider>
      </KeyboardProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FAF9F7",
  },
});
