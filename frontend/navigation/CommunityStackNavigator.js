import React from "react";
import { createStackNavigator } from "@react-navigation/stack";

import CommunityPublicProfileScreen from "../screens/profile/community/CommunityPublicProfileScreen";
import CommunityFollowersListScreen from "../screens/profile/community/CommunityFollowersListScreen";
import CommunityFollowingListScreen from "../screens/profile/community/CommunityFollowingListScreen";
import EditCommunityProfileScreen from "../screens/profile/community/EditCommunityProfileScreen";
import NotificationsScreen from "../screens/notifications/NotificationsScreen";
import CommunitySearchScreen from "../screens/search/CommunitySearchScreen";
import MemberPublicProfileScreen from "../screens/profile/member/MemberPublicProfileScreen";
import SponsorProfileScreen from "../screens/profile/sponsor/SponsorProfileScreen";
import VenueProfileScreen from "../screens/profile/venue/VenueProfileScreen";

const Stack = createStackNavigator();

export default function CommunityStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="CommunityPublicProfile" component={CommunityPublicProfileScreen} />
      <Stack.Screen name="MemberPublicProfile" component={MemberPublicProfileScreen} />
      <Stack.Screen name="SponsorProfile" component={SponsorProfileScreen} />
      <Stack.Screen name="VenueProfile" component={VenueProfileScreen} />
      <Stack.Screen name="CommunityFollowersList" component={CommunityFollowersListScreen} />
      <Stack.Screen name="CommunityFollowingList" component={CommunityFollowingListScreen} />
      <Stack.Screen name="EditCommunityProfile" component={EditCommunityProfileScreen} />
      <Stack.Screen name="CommunitySearch" component={CommunitySearchScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ headerShown: true }} />
    </Stack.Navigator>
  );
}

