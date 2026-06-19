import React from "react";
import { createStackNavigator, CardStyleInterpolators } from "@react-navigation/stack";
import SearchScreen from "../screens/search/SearchScreen";
import VenueProfileScreen from "../screens/profile/venue/VenueProfileScreen";

import CommunityPublicProfileScreen from "../screens/profile/community/CommunityPublicProfileScreen";
import TabSwipeHandler from "../components/navigation/TabSwipeHandler";

const SearchScreenWithSwipe = (props) => (
  <TabSwipeHandler currentTab="Search">
    <SearchScreen {...props} />
  </TabSwipeHandler>
);

const Stack = createStackNavigator();

export default function SearchStackNavigator() {
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
