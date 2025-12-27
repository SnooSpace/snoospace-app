import React from "react";
import { createStackNavigator } from "@react-navigation/stack";
import SearchScreen from "../screens/search/SearchScreen";
import VenueProfileScreen from "../screens/profile/venue/VenueProfileScreen";
import FollowersListScreen from "../screens/profile/member/FollowersListScreen";
import FollowingListScreen from "../screens/profile/member/FollowingListScreen";
import CommunityFollowersListScreen from "../screens/profile/community/CommunityFollowersListScreen";
import CommunityFollowingListScreen from "../screens/profile/community/CommunityFollowingListScreen";
import CommunityPublicProfileScreen from "../screens/profile/community/CommunityPublicProfileScreen";

const Stack = createStackNavigator();

export default function SearchStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false }}
      initialRouteName="Search"
    >
      <Stack.Screen name="Search" component={SearchScreen} />
      <Stack.Screen name="VenueProfile" component={VenueProfileScreen} />
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
      <Stack.Screen
        name="CommunityPublicProfile"
        component={CommunityPublicProfileScreen}
      />
    </Stack.Navigator>
  );
}
