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
import CommunityEventsListScreen from "../screens/home/community/CommunityEventsListScreen";
import CreatePostScreen from "../components/CreatePostScreen";
import CommunityCreatePostScreen from "../screens/home/community/CommunityCreatePostScreen";

import EventDetailsScreen from "../screens/events/EventDetailsScreen";
import TicketSelectionScreen from "../screens/events/TicketSelectionScreen";
import CheckoutScreen from "../screens/events/CheckoutScreen";
import TicketViewScreen from "../screens/events/TicketViewScreen";
import CategoryEventsScreen from "../screens/events/CategoryEventsScreen";
import MemberPublicProfileScreen from "../screens/profile/member/MemberPublicProfileScreen";
import CommunityPublicProfileScreen from "../screens/profile/community/CommunityPublicProfileScreen";
import { CropScreen, BatchCropScreen } from "../components/MediaCrop";

const Stack = createStackNavigator();

export default function AppNavigator({ initialRouteName }) {
  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false }}
      initialRouteName={initialRouteName}
    >
      <Stack.Screen name="AuthGate" component={AuthGate} />
      <Stack.Screen name="Landing" component={LandingScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="LoginOtp" component={LoginOtpScreen} />
      <Stack.Screen name="MemberSignup" component={MemberSignupNavigator} />
      <Stack.Screen
        name="CommunitySignup"
        component={CommunitySignupNavigator}
      />
      <Stack.Screen name="SponsorSignup" component={SponsorSignupNavigator} />
      <Stack.Screen name="VenueSignup" component={VenueSignupNavigator} />
      <Stack.Screen
        name="MemberHome"
        component={BottomTabNavigator}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="CommunityHome"
        component={CommunityBottomTabNavigator}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="SponsorHome"
        component={SponsorBottomTabNavigator}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="VenueHome"
        component={VenueBottomTabNavigator}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="CommunityEventsList"
        component={CommunityEventsListScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="CommunityCreatePost"
        component={CommunityCreatePostScreen}
        options={{ headerShown: false, presentation: "fullScreenModal" }}
      />
      <Stack.Screen
        name="EventDetails"
        component={EventDetailsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="TicketSelection"
        component={TicketSelectionScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Checkout"
        component={CheckoutScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="TicketView"
        component={TicketViewScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="CategoryEvents"
        component={CategoryEventsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="MemberPublicProfile"
        component={MemberPublicProfileScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="CommunityPublicProfile"
        component={CommunityPublicProfileScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="CommunityPublicEventsList"
        component={
          require("../screens/profile/community/CommunityPublicEventsListScreen")
            .default
        }
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="CropScreen"
        component={CropScreen}
        options={{
          headerShown: false,
          presentation: "fullScreenModal",
          animation: "slide_from_bottom",
        }}
      />
      <Stack.Screen
        name="BatchCropScreen"
        component={BatchCropScreen}
        options={{
          headerShown: false,
          presentation: "fullScreenModal",
          animation: "slide_from_bottom",
        }}
      />
    </Stack.Navigator>
  );
}
