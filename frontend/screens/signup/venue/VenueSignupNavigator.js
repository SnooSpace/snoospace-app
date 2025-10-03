import React from "react";
import { createStackNavigator } from "@react-navigation/stack";

import VenueEmailScreen from "./VenueEmailScreen";
import VenueOtpScreen from "./VenueOtpScreen";
import VenueDetailsScreen from "./VenueDetailsScreen";

const Stack = createStackNavigator();

export default function VenueSignupNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="VenueEmail" component={VenueEmailScreen} />
      <Stack.Screen name="VenueOtp" component={VenueOtpScreen} />
      <Stack.Screen name="VenueDetails" component={VenueDetailsScreen} />
    </Stack.Navigator>
  );
}
