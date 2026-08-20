import React from "react";
import { Platform } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import SearchScreen from "../screens/search/SearchScreen";
import VenueProfileScreen from "../screens/profile/venue/VenueProfileScreen";
import CommunityPublicProfileScreen from "../screens/profile/community/CommunityPublicProfileScreen";

const Stack = createNativeStackNavigator();

export default function SearchStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        gestureEnabled: true,
        animation: "slide_from_right", // Native horizontal slide
        contentStyle: { backgroundColor: "#FFFFFF" },
        ...(Platform.OS === "ios" ? { animationDuration: 350 } : {}),
      }}
      initialRouteName="SearchMain"
    >
      <Stack.Screen name="SearchMain" component={SearchScreen} />
      <Stack.Screen name="VenueProfile" component={VenueProfileScreen} />
      <Stack.Screen
        name="CommunityPublicProfile"
        component={CommunityPublicProfileScreen}
      />
    </Stack.Navigator>
  );
}
