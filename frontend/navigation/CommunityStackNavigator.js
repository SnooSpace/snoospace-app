import React from "react";
import { createStackNavigator } from "@react-navigation/stack";

import CommunityPublicProfileScreen from "../screens/profile/community/CommunityPublicProfileScreen";
import CommunityFollowersListScreen from "../screens/profile/community/CommunityFollowersListScreen";
import CommunityFollowingListScreen from "../screens/profile/community/CommunityFollowingListScreen";
import EditCommunityProfileScreen from "../screens/profile/community/EditCommunityProfileScreen";
import NotificationsScreen from "../screens/notifications/NotificationsScreen";
import CommunitySearchScreen from "../screens/search/CommunitySearchScreen";

const Stack = createStackNavigator();

export default function CommunityStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="CommunityPublicProfile" component={CommunityPublicProfileScreen} />
      <Stack.Screen name="CommunityFollowersList" component={CommunityFollowersListScreen} />
      <Stack.Screen name="CommunityFollowingList" component={CommunityFollowingListScreen} />
      <Stack.Screen name="EditCommunityProfile" component={EditCommunityProfileScreen} />
      <Stack.Screen name="CommunitySearch" component={CommunitySearchScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ headerShown: true }} />
    </Stack.Navigator>
  );
}

