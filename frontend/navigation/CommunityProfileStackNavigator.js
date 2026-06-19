import React from "react";
import { Platform } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import CommunityProfileScreen from "../screens/profile/community/CommunityProfileScreen";
import CommunityFollowersListScreen from "../screens/profile/community/CommunityFollowersListScreen";
import CommunityFollowingListScreen from "../screens/profile/community/CommunityFollowingListScreen";
import EditCommunityProfileScreen from "../screens/profile/community/EditCommunityProfileScreen";
import CommunityHostsScreen from "../screens/profile/community/CommunityHostsScreen";
import CommunityMonetizationScreen from "../screens/profile/community/CommunityMonetizationScreen";
import FollowersListScreen from "../screens/profile/member/FollowersListScreen";
import FollowingListScreen from "../screens/profile/member/FollowingListScreen";
import OpportunityViewScreen from "../screens/home/member/OpportunityViewScreen";
import SettingsScreen from "../screens/profile/member/SettingsScreen";
import LinkedAccountsScreen from "../screens/profile/member/LinkedAccountsScreen";
import BlockedAccountsScreen from "../screens/profile/member/BlockedAccountsScreen";
import CircleListScreen from "../screens/profile/member/CircleListScreen";
import CircleRequestsScreen from "../screens/profile/member/CircleRequestsScreen";
import SavedPostsScreen from "../screens/SavedPostsScreen";
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
        animation: Platform.OS === "ios" ? "ios" : "default",
        gestureEnabled: true,
        ...(Platform.OS === "ios" ? { animationDuration: 350 } : {}),
      }}
      initialRouteName="Profile"
    >
      <Stack.Screen name="Profile" component={CommunityProfileScreen} />
      <Stack.Screen
        name="CommunityFollowersList"
        component={CommunityFollowersListScreen}
      />
      <Stack.Screen
        name="CommunityFollowingList"
        component={CommunityFollowingListScreen}
      />
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
      <Stack.Screen name="FollowersList" component={FollowersListScreen} />
      <Stack.Screen name="FollowingList" component={FollowingListScreen} />
      <Stack.Screen name="OpportunityView" component={OpportunityViewScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="SavedPostsScreen" component={SavedPostsScreen} />
      <Stack.Screen name="LinkedAccounts" component={LinkedAccountsScreen} />
      <Stack.Screen name="BlockedAccounts" component={BlockedAccountsScreen} />
      <Stack.Screen name="CircleList" component={CircleListScreen} />
      <Stack.Screen name="CircleRequests" component={CircleRequestsScreen} />
      <Stack.Screen name="MyDataScreen" component={MyDataScreen} />
      <Stack.Screen name="EventDetails" component={EventDetails} />
      <Stack.Screen name="DeleteAccount" component={DeleteAccountScreen} />
      <Stack.Screen name="CommunityEventsList" component={CommunityEventsListScreen} />
      <Stack.Screen name="CommunityCreatePost" component={CommunityCreatePostScreen} />
    </Stack.Navigator>
  );
}
