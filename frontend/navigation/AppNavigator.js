// navigation/AppNavigator.js
import React from "react";
import { createStackNavigator } from "@react-navigation/stack";

import LandingScreen from "../screens/LandingScreen";
import EmailInputScreen from "../screens/signin/EmailInputScreen";
import VerificationScreen from "../screens/signin/VerificationScreen";
import MemberSignupNavigator from "../screens/signup/member/MemberSignupNavigator";
import MemberHomeScreen from "../screens/MemberHomeScreen";
import CommunityHomeScreen from "../screens/CommunityHomeScreen";
import SponsorHomeScreen from "../screens/SponsorHomeScreen";
import VenueHomeScreen from "../screens/VenueHomeScreen";

const Stack = createStackNavigator();

export default function AppNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Landing" component={LandingScreen} />
      <Stack.Screen name="Login" component={EmailInputScreen} />
      <Stack.Screen name="Verification" component={VerificationScreen} />
      <Stack.Screen name="MemberSignup" component={MemberSignupNavigator} />
      <Stack.Screen name="MemberHome" component={MemberHomeScreen} />
      <Stack.Screen name="CommunityHome" component={CommunityHomeScreen} />
      <Stack.Screen name="SponsorHome" component={SponsorHomeScreen} />
      <Stack.Screen name="VenueHome" component={VenueHomeScreen} />
    </Stack.Navigator>
  );
}
