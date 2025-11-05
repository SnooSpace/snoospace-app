// navigation/AppNavigator.js
import React from "react";
import { createStackNavigator } from "@react-navigation/stack";

import LandingScreen from "../screens/auth/LandingScreen";
import AuthGate from "../screens/auth/AuthGate";
import MemberSignupNavigator from "../screens/signup/member/MemberSignupNavigator";
import CommunitySignupNavigator from "../screens/signup/community/CommunitySignupNavigator";
import SponsorSignupNavigator from "../screens/signup/sponsor/SponsorSignupNavigator";
import VenueSignupNavigator from "../screens/signup/venue/VenueSignupNavigator";
import LoginScreen from "../screens/auth/signin/LoginScreen";
import LoginOtpScreen from "../screens/auth/signin/LoginOtpScreen";
import BottomTabNavigator from "./BottomTabNavigator";
import CommunityBottomTabNavigator from "./CommunityBottomTabNavigator";
import SponsorBottomTabNavigator from "./SponsorBottomTabNavigator";
import VenueBottomTabNavigator from "./VenueBottomTabNavigator";
import CommunityCreatePostScreen from "../screens/home/community/CommunityCreatePostScreen";
import MemberPublicProfileScreen from "../screens/profile/member/MemberPublicProfileScreen";
import EditProfileScreen from "../screens/profile/member/EditProfileScreen";
import NotificationsScreen from "../screens/notifications/NotificationsScreen";

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
      <Stack.Screen name="MemberHome" component={BottomTabNavigator} options={{ headerShown: false }} />
      <Stack.Screen name="CommunityHome" component={CommunityBottomTabNavigator} options={{ headerShown: false }} />
      <Stack.Screen name="SponsorHome" component={SponsorBottomTabNavigator} options={{ headerShown: false }} />
      <Stack.Screen name="VenueHome" component={VenueBottomTabNavigator} options={{ headerShown: false }} />
      <Stack.Screen name="CommunityCreatePost" component={CommunityCreatePostScreen} options={{ headerShown: false, presentation: 'modal' }} />
      <Stack.Screen name="MemberPublicProfile" component={MemberPublicProfileScreen} options={{ headerShown: false }} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ headerShown: true }} />
    </Stack.Navigator>
  );
}
