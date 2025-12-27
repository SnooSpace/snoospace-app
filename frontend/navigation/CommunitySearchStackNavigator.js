import React from "react";
import { createStackNavigator } from "@react-navigation/stack";

import SearchScreen from "../screens/search/SearchScreen";
import CommunityPublicProfileScreen from "../screens/profile/community/CommunityPublicProfileScreen";
import MemberPublicProfileScreen from "../screens/profile/member/MemberPublicProfileScreen";
import SponsorProfileScreen from "../screens/profile/sponsor/SponsorProfileScreen";
import VenueProfileScreen from "../screens/profile/venue/VenueProfileScreen";
import FollowersListScreen from "../screens/profile/member/FollowersListScreen";
import FollowingListScreen from "../screens/profile/member/FollowingListScreen";
import CommunityFollowersListScreen from "../screens/profile/community/CommunityFollowersListScreen";
import CommunityFollowingListScreen from "../screens/profile/community/CommunityFollowingListScreen";

const Stack = createStackNavigator();

export default function CommunitySearchStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="CommunitySearchHome" component={SearchScreen} />
      <Stack.Screen
        name="CommunityPublicProfile"
        component={CommunityPublicProfileScreen}
      />
      <Stack.Screen
        name="MemberPublicProfile"
        component={MemberPublicProfileScreen}
      />
      <Stack.Screen name="SponsorProfile" component={SponsorProfileScreen} />
      <Stack.Screen component={VenueProfileScreen} />
      <Stack.Screen name="FollowersList" component={FollowersListScreen} />
      <Stack.Screen name="FollowingList" component={FollowingListScreen} />
      <Stack.Screen
        name="CommunityFollowersList"
        component={CommunityFollowersListScreen}
      />
      <Stack.Screen
        name="CommunityFollowingList"
        component={CommunityFollowingListScreen}
      />
    </Stack.Navigator>
  );
}
