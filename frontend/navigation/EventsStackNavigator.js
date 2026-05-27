import React from "react";
import { createStackNavigator, CardStyleInterpolators } from "@react-navigation/stack";

import YourEventsScreen from "../screens/events/YourEventsScreen";
import EventDetailsScreen from "../screens/events/EventDetailsScreen";
import TabSwipeHandler from "../components/navigation/TabSwipeHandler";

const YourEventsScreenWithSwipe = (props) => (
  <TabSwipeHandler currentTab="YourEvents">
    <YourEventsScreen {...props} />
  </TabSwipeHandler>
);

const Stack = createStackNavigator();

export default function EventsStackNavigator() {
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
    >
      <Stack.Screen name="YourEventsList" component={YourEventsScreenWithSwipe} />
    </Stack.Navigator>
  );
}
