import React from "react";
import { createStackNavigator, CardStyleInterpolators } from "@react-navigation/stack";

import SearchScreen from "../screens/search/SearchScreen";
import SponsorProfileScreen from "../screens/profile/sponsor/SponsorProfileScreen";
import VenueProfileScreen from "../screens/profile/venue/VenueProfileScreen";

import EventDetailsScreen from "../screens/events/EventDetailsScreen";


import TabSwipeHandler from "../components/navigation/TabSwipeHandler";

const CommunityTabs = ["Home", "Search", "Dashboard", "Requests", "Profile"];

const SearchScreenWithSwipe = (props) => (
  <TabSwipeHandler currentTab="Search" tabs={CommunityTabs}>
    <SearchScreen {...props} />
  </TabSwipeHandler>
);

const snappyTransitionSpec = {
  open: {
    animation: "spring",
    config: {
      stiffness: 1000,
      damping: 100,
      mass: 1,
      overshootClamping: true,
      restDisplacementThreshold: 0.01,
      restSpeedThreshold: 0.01,
    },
  },
  close: {
    animation: "spring",
    config: {
      stiffness: 1000,
      damping: 100,
      mass: 1,
      overshootClamping: true,
      restDisplacementThreshold: 0.01,
      restSpeedThreshold: 0.01,
    },
  },
};

const Stack = createStackNavigator();

export default function CommunitySearchStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        gestureEnabled: true,
        gestureDirection: "horizontal",
        transitionSpec: snappyTransitionSpec,
        cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
      }}
    >
      <Stack.Screen name="CommunitySearchHome" component={SearchScreenWithSwipe} />
      <Stack.Screen name="SponsorProfile" component={SponsorProfileScreen} />
      <Stack.Screen name="VenueProfile" component={VenueProfileScreen} />


    </Stack.Navigator>
  );
}
