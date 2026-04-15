import React from "react";
import { createStackNavigator } from "@react-navigation/stack";

import YourEventsScreen from "../screens/events/YourEventsScreen";
import TicketViewScreen from "../screens/events/TicketViewScreen";
import EventDetailsScreen from "../screens/events/EventDetailsScreen";

const Stack = createStackNavigator();

export default function EventsStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="YourEventsList" component={YourEventsScreen} />
      <Stack.Screen name="TicketView" component={TicketViewScreen} />
    </Stack.Navigator>
  );
}
