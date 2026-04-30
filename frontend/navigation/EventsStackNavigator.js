import React from "react";
import { createStackNavigator } from "@react-navigation/stack";

import YourEventsScreen from "../screens/events/YourEventsScreen";
import TicketViewScreen from "../screens/events/TicketViewScreen";
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
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="YourEventsList" component={YourEventsScreenWithSwipe} />
      <Stack.Screen name="TicketView" component={TicketViewScreen} />
    </Stack.Navigator>
  );
}
