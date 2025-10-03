import React from "react";
import { createStackNavigator } from "@react-navigation/stack";

import CommunityEmailScreen from "./CommunityEmailScreen";
import CommunityOtpScreen from "./CommunityOtpScreen";
import CommunityDetailsScreen from "./CommunityDetailsScreen";

const Stack = createStackNavigator();

export default function CommunitySignupNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="CommunityEmail" component={CommunityEmailScreen} />
      <Stack.Screen name="CommunityOtp" component={CommunityOtpScreen} />
      <Stack.Screen name="CommunityDetails" component={CommunityDetailsScreen} />
    </Stack.Navigator>
  );
}
