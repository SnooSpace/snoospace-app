import React from "react";
import { createStackNavigator } from "@react-navigation/stack";

import SponsorEmailScreen from "./SponsorEmailScreen";
import SponsorOtpScreen from "./SponsorOtpScreen";
import SponsorDetailsScreen from "./SponsorDetailsScreen";

const Stack = createStackNavigator();

export default function SponsorSignupNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SponsorEmail" component={SponsorEmailScreen} />
      <Stack.Screen name="SponsorOtp" component={SponsorOtpScreen} />
      <Stack.Screen name="SponsorDetails" component={SponsorDetailsScreen} />
    </Stack.Navigator>
  );
}
