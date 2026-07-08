import React from "react";
import { Platform } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import CommunityProfileScreen from "../screens/profile/community/CommunityProfileScreen";

import EditCommunityProfileScreen from "../screens/profile/community/EditCommunityProfileScreen";
import CommunityHostsScreen from "../screens/profile/community/CommunityHostsScreen";
import CommunityHostManagementScreen from "../screens/profile/community/CommunityHostManagementScreen";

import OpportunityViewScreen from "../screens/home/member/OpportunityViewScreen";
import CommunityEventsListScreen from "../screens/home/community/CommunityEventsListScreen";
import CommunityCreatePostScreen from "../screens/home/community/CommunityCreatePostScreen";

const Stack = createNativeStackNavigator();

export default function CommunityProfileStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
        gestureEnabled: true,
        ...(Platform.OS === "ios" ? { animationDuration: 350 } : {}),
      }}
      initialRouteName="Profile"
    >
      <Stack.Screen name="Profile" component={CommunityProfileScreen} />

      <Stack.Screen
        name="EditCommunityProfile"
        component={EditCommunityProfileScreen}
      />
      <Stack.Screen
        name="CommunityHosts"
        component={CommunityHostsScreen}
      />
      <Stack.Screen
        name="CommunityHostManagement"
        component={CommunityHostManagementScreen}
      />

      <Stack.Screen name="OpportunityView" component={OpportunityViewScreen} />
      <Stack.Screen name="CommunityEventsList" component={CommunityEventsListScreen} />
      <Stack.Screen name="CommunityCreatePost" component={CommunityCreatePostScreen} />
    </Stack.Navigator>
  );
}
