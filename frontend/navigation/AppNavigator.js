// navigation/AppNavigator.js
import React from "react";
import { createStackNavigator } from "@react-navigation/stack";

import LandingScreen from "../screens/LandingScreen";
import AuthGate from "../screens/AuthGate";
import MemberSignupNavigator from "../screens/signup/member/MemberSignupNavigator";
import CommunitySignupNavigator from "../screens/signup/community/CommunitySignupNavigator";
import SponsorSignupNavigator from "../screens/signup/sponsor/SponsorSignupNavigator";
import VenueSignupNavigator from "../screens/signup/venue/VenueSignupNavigator";
import LoginScreen from "../screens/signin/LoginScreen";
import LoginOtpScreen from "../screens/signin/LoginOtpScreen";
import MemberHomeScreen from "../screens/MemberHomeScreen";
import CommunityHomeScreen from "../screens/CommunityHomeScreen";
import SponsorHomeScreen from "../screens/SponsorHomeScreen";
import VenueHomeScreen from "../screens/VenueHomeScreen";

const Stack = createStackNavigator();

export default function AppNavigator({ initialRouteName }) {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName={initialRouteName}>
      <Stack.Screen name="AuthGate" component={AuthGate} />
      <Stack.Screen name="Landing" component={LandingScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="LoginOtp" component={LoginOtpScreen} />
      <Stack.Screen name="MemberSignup" component={MemberSignupNavigator} />
      <Stack.Screen name="CommunitySignup" component={CommunitySignupNavigator} />
      <Stack.Screen name="SponsorSignup" component={SponsorSignupNavigator} />
      <Stack.Screen name="VenueSignup" component={VenueSignupNavigator} />
      <Stack.Screen name="MemberHome" component={MemberHomeScreen} />
      <Stack.Screen name="CommunityHome" component={CommunityHomeScreen} />
      <Stack.Screen name="SponsorHome" component={SponsorHomeScreen} />
      <Stack.Screen name="VenueHome" component={VenueHomeScreen} />
    </Stack.Navigator>
  );
}
