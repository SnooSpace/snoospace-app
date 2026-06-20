import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import SearchScreen from "../screens/search/SearchScreen";
import VenueProfileScreen from "../screens/profile/venue/VenueProfileScreen";

import CommunityPublicProfileScreen from "../screens/profile/community/CommunityPublicProfileScreen";
import TabSwipeHandler from "../components/navigation/TabSwipeHandler";

const SearchScreenWithSwipe = (props) => (
  <TabSwipeHandler currentTab="Search">
    <SearchScreen {...props} />
  </TabSwipeHandler>
);

const Stack = createNativeStackNavigator();

export default function SearchStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        gestureEnabled: true,
        animation: "slide_from_right", // Native horizontal slide
      }}
      initialRouteName="Search"
    >
      <Stack.Screen name="Search" component={SearchScreenWithSwipe} />
      <Stack.Screen name="VenueProfile" component={VenueProfileScreen} />
      <Stack.Screen
        name="CommunityPublicProfile"
        component={CommunityPublicProfileScreen}
      />
    </Stack.Navigator>
  );
}
