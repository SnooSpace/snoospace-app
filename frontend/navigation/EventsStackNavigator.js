import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import YourEventsScreen from "../screens/events/YourEventsScreen";
import TabSwipeHandler from "../components/navigation/TabSwipeHandler";

const YourEventsScreenWithSwipe = (props) => (
  <TabSwipeHandler currentTab="YourEvents">
    <YourEventsScreen {...props} />
  </TabSwipeHandler>
);

const Stack = createNativeStackNavigator();

export default function EventsStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        gestureEnabled: true,
        animation: "slide_from_right", // Native horizontal slide
      }}
    >
      <Stack.Screen name="YourEventsList" component={YourEventsScreenWithSwipe} />
    </Stack.Navigator>
  );
}
