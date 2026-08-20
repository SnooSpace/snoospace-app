import React from "react";
import { Platform } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import YourEventsScreen from "../screens/events/YourEventsScreen";

const Stack = createNativeStackNavigator();

export default function EventsStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        gestureEnabled: true,
        animation: "slide_from_right", // Native horizontal slide
        contentStyle: { backgroundColor: "#FFFFFF" },
        ...(Platform.OS === "ios" ? { animationDuration: 350 } : {}),
      }}
    >
      <Stack.Screen name="YourEventsList" component={YourEventsScreen} />
    </Stack.Navigator>
  );
}
