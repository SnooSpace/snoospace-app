import React from "react";
import { createStackNavigator } from "@react-navigation/stack";
import CommunityProfileScreen from "../screens/profile/community/CommunityProfileScreen";
import CommunityFollowersListScreen from "../screens/profile/community/CommunityFollowersListScreen";
import CommunityFollowingListScreen from "../screens/profile/community/CommunityFollowingListScreen";
import CommunityPublicProfileScreen from "../screens/profile/community/CommunityPublicProfileScreen";
import EditCommunityProfileScreen from "../screens/profile/community/EditCommunityProfileScreen";

const Stack = createStackNavigator();

export default function CommunityProfileStackNavigator() {
  return (
    <Stack.Navigator 
      screenOptions={{ headerShown: false }}
      initialRouteName="Profile"
    >
      <Stack.Screen name="Profile" component={CommunityProfileScreen} />
      <Stack.Screen name="CommunityFollowersList" component={CommunityFollowersListScreen} />
      <Stack.Screen name="CommunityFollowingList" component={CommunityFollowingListScreen} />
      <Stack.Screen name="CommunityPublicProfile" component={CommunityPublicProfileScreen} />
      <Stack.Screen name="EditCommunityProfile" component={EditCommunityProfileScreen} />
    </Stack.Navigator>
  );
}

