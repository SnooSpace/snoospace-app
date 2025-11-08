import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { NavigationContainer, CommonActions } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AppNavigator from "./navigation/AppNavigator";
import { getAuthToken, getAuthEmail, getPendingOtp, clearPendingOtp } from "./api/auth";
import { apiPost } from "./api/client";
import { NotificationsProvider, useNotifications } from "./context/NotificationsContext";
import NotificationBanner from "./components/NotificationBanner";

function AppContent() {
  const { currentBanner, setCurrentBanner } = useNotifications();
  const navigationRef = React.useRef(null);

  const handleBannerPress = () => {
    if (currentBanner?.type === 'follow' && currentBanner?.actor_id) {
      // Navigate through nested structure: MemberHome -> MemberStack -> MemberPublicProfile
      navigationRef.current?.dispatch(
        CommonActions.navigate({
          name: 'MemberHome',
          params: {
            screen: 'MemberStack',
            params: {
              screen: 'MemberPublicProfile',
              params: { memberId: currentBanner.actor_id }
            }
          }
        })
      );
    }
  };

  return (
    <>
      <NavigationContainer ref={navigationRef}>
        <AppNavigator initialRouteName={'AuthGate'} />
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
  return (
    <SafeAreaProvider>
      <NotificationsProvider>
        <AppContent />
      </NotificationsProvider>
    </SafeAreaProvider>
  );
}
