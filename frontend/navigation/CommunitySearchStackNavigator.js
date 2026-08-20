import React from "react";
import { Platform } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import SearchScreen from "../screens/search/SearchScreen";
import SponsorProfileScreen from "../screens/profile/sponsor/SponsorProfileScreen";
import VenueProfileScreen from "../screens/profile/venue/VenueProfileScreen";

const Stack = createNativeStackNavigator();

export default function CommunitySearchStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        gestureEnabled: true,
        animation: "slide_from_right",
        contentStyle: { backgroundColor: "#FFFFFF" },
        ...(Platform.OS === "ios" ? { animationDuration: 350 } : {}),
      }}
    >
      <Stack.Screen name="CommunitySearchHome" component={SearchScreen} />
      <Stack.Screen name="SponsorProfile" component={SponsorProfileScreen} />
      <Stack.Screen name="VenueProfile" component={VenueProfileScreen} />
    </Stack.Navigator>
  );
}
