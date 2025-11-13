import React from "react";
import { createStackNavigator } from "@react-navigation/stack";
import SearchScreen from "../screens/search/SearchScreen";
import MemberPublicProfileScreen from "../screens/profile/member/MemberPublicProfileScreen";
import CommunityPublicProfileScreen from "../screens/profile/community/CommunityPublicProfileScreen";

const Stack = createStackNavigator();

export default function SearchStackNavigator() {
  return (
    <Stack.Navigator 
      screenOptions={{ headerShown: false }}
      initialRouteName="Search"
    >
      <Stack.Screen name="Search" component={SearchScreen} />
      <Stack.Screen name="MemberPublicProfile" component={MemberPublicProfileScreen} />
      <Stack.Screen name="CommunityPublicProfile" component={CommunityPublicProfileScreen} />
    </Stack.Navigator>
  );
}

