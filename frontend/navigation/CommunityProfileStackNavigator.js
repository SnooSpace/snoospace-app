import React from "react";
import { Platform } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import CommunityProfileScreen from "../screens/profile/community/CommunityProfileScreen";

import EditCommunityProfileScreen from "../screens/profile/community/EditCommunityProfileScreen";
import CommunityHostsScreen from "../screens/profile/community/CommunityHostsScreen";
import CommunityMonetizationScreen from "../screens/profile/community/CommunityMonetizationScreen";

import OpportunityViewScreen from "../screens/home/member/OpportunityViewScreen";
import SettingsScreen from "../screens/profile/member/SettingsScreen";
import LinkedAccountsScreen from "../screens/profile/member/LinkedAccountsScreen";
import BlockedAccountsScreen from "../screens/profile/member/BlockedAccountsScreen";


import MyDataScreen from "../screens/Privacy/MyDataScreen";
import EventDetails from "../screens/events/EventDetailsScreen";
import DeleteAccountScreen from "../screens/profile/DeleteAccountScreen";
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
        name="CommunityMonetization"
        component={CommunityMonetizationScreen}
      />

      <Stack.Screen name="OpportunityView" component={OpportunityViewScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />

      <Stack.Screen name="LinkedAccounts" component={LinkedAccountsScreen} />
      <Stack.Screen name="BlockedAccounts" component={BlockedAccountsScreen} />

      <Stack.Screen name="MyDataScreen" component={MyDataScreen} />
      <Stack.Screen name="EventDetails" component={EventDetails} />
      <Stack.Screen name="DeleteAccount" component={DeleteAccountScreen} />
      <Stack.Screen name="CommunityEventsList" component={CommunityEventsListScreen} />
      <Stack.Screen name="CommunityCreatePost" component={CommunityCreatePostScreen} />
    </Stack.Navigator>
  );
}
