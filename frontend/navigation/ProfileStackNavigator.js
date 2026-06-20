import React from "react";
import { Platform } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import MemberProfileScreen from "../screens/profile/member/MemberProfileScreen";

import EditProfileScreen from "../screens/profile/member/EditProfileScreen";
import CreatePostScreen from "../components/CreatePostScreen";

import SettingsScreen from "../screens/profile/member/SettingsScreen";
import LinkedAccountsScreen from "../screens/profile/member/LinkedAccountsScreen";
import BlockedAccountsScreen from "../screens/profile/member/BlockedAccountsScreen";


import MyDataScreen from "../screens/Privacy/MyDataScreen";
import OpportunityView from "../screens/home/member/OpportunityViewScreen";
import EventDetails from "../screens/events/EventDetailsScreen";
import CommunityMonetizationScreen from "../screens/profile/community/CommunityMonetizationScreen";
import DeleteAccountScreen from "../screens/profile/DeleteAccountScreen";
import PlanDetailScreen from "../screens/plans/PlanDetailScreen";
import HostRequestsScreen from "../screens/plans/HostRequestsScreen";
// [VIDEO INSIGHTS - DEFERRED] import VideoInsightsScreen from "../screens/insights/VideoInsightsScreen";

const Stack = createNativeStackNavigator();

export default function ProfileStackNavigator() {
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
      <Stack.Screen name="Profile" component={MemberProfileScreen} />

      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="CreatePost" component={CreatePostScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />

      <Stack.Screen name="LinkedAccounts" component={LinkedAccountsScreen} />
      <Stack.Screen name="BlockedAccounts" component={BlockedAccountsScreen} />

      <Stack.Screen name="MyDataScreen" component={MyDataScreen} />
      <Stack.Screen name="OpportunityView" component={OpportunityView} />
      <Stack.Screen name="EventDetails" component={EventDetails} />
      <Stack.Screen name="CreatorMonetization" component={CommunityMonetizationScreen} />
      <Stack.Screen name="DeleteAccount" component={DeleteAccountScreen} />
      <Stack.Screen name="PlanDetail" component={PlanDetailScreen} />
      <Stack.Screen name="HostRequests" component={HostRequestsScreen} />
      {/* [VIDEO INSIGHTS - DEFERRED] <Stack.Screen name="VideoInsights" component={VideoInsightsScreen} options={{ headerShown: false }} /> */}
    </Stack.Navigator>
  );
}
