import React from "react";
import { createStackNavigator, CardStyleInterpolators } from "@react-navigation/stack";
import MemberProfileScreen from "../screens/profile/member/MemberProfileScreen";
import FollowersListScreen from "../screens/profile/member/FollowersListScreen";
import FollowingListScreen from "../screens/profile/member/FollowingListScreen";
import MemberPublicProfileScreen from "../screens/profile/member/MemberPublicProfileScreen";
import EditProfileScreen from "../screens/profile/member/EditProfileScreen";
import CreatePostScreen from "../components/CreatePostScreen";
import CommunityPublicProfileScreen from "../screens/profile/community/CommunityPublicProfileScreen";
import CommunityFollowersListScreen from "../screens/profile/community/CommunityFollowersListScreen";
import CommunityFollowingListScreen from "../screens/profile/community/CommunityFollowingListScreen";
import SettingsScreen from "../screens/profile/member/SettingsScreen";
import LinkedAccountsScreen from "../screens/profile/member/LinkedAccountsScreen";
import BlockedAccountsScreen from "../screens/profile/member/BlockedAccountsScreen";
// [VIDEO INSIGHTS - DEFERRED] import VideoInsightsScreen from "../screens/insights/VideoInsightsScreen";

const Stack = createStackNavigator();

export default function ProfileStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        gestureEnabled: true,
        gestureDirection: "horizontal",
        transitionSpec: {
          open: {
            animation: "spring",
            config: {
              stiffness: 1000,
              damping: 500,
              mass: 3,
              overshootClamping: true,
              restDisplacementThreshold: 0.01,
              restSpeedThreshold: 0.01,
            },
          },
          close: {
            animation: "spring",
            config: {
              stiffness: 1000,
              damping: 500,
              mass: 3,
              overshootClamping: true,
              restDisplacementThreshold: 0.01,
              restSpeedThreshold: 0.01,
            },
          },
        },
        cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
      }}
      initialRouteName="Profile"
    >
      <Stack.Screen name="Profile" component={MemberProfileScreen} />
      <Stack.Screen name="FollowersList" component={FollowersListScreen} />
      <Stack.Screen name="FollowingList" component={FollowingListScreen} />
      <Stack.Screen
        name="MemberPublicProfile"
        component={MemberPublicProfileScreen}
      />
      <Stack.Screen
        name="CommunityPublicProfile"
        component={CommunityPublicProfileScreen}
      />
      <Stack.Screen
        name="CommunityFollowersList"
        component={CommunityFollowersListScreen}
      />
      <Stack.Screen
        name="CommunityFollowingList"
        component={CommunityFollowingListScreen}
      />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="CreatePost" component={CreatePostScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="LinkedAccounts" component={LinkedAccountsScreen} />
      <Stack.Screen name="BlockedAccounts" component={BlockedAccountsScreen} />
      {/* [VIDEO INSIGHTS - DEFERRED] <Stack.Screen name="VideoInsights" component={VideoInsightsScreen} options={{ headerShown: false }} /> */}
    </Stack.Navigator>
  );
}
