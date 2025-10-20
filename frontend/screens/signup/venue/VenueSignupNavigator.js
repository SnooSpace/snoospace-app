import React from "react";
import { createStackNavigator } from "@react-navigation/stack";

import VenueEmailScreen from "./VenueEmailScreen";
import VenueOtpScreen from "./VenueOtpScreen";
import VenueNameScreen from "./VenueNameScreen";
import VenueLogoScreen from "./VenueLogoScreen";
import VenueBioScreen from "./VenueBioScreen";
import VenueCategoryScreen from "./VenueCategoryScreen";
import VenueInterestScreen from "./VenueInterestScreen";
import VenueAddressScreen from "./VenueAddressScreen";
import VenuePricingScreen from "./VenuePricingScreen";
import VenueMaxCapScreen from "./VenueMaxCapScreen";
import VenueHostNamePhoneScreen from "./VenueHostNamePhoneScreen";

const Stack = createStackNavigator();

export default function VenueSignupNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="VenueEmail" component={VenueEmailScreen} />
      <Stack.Screen name="VenueOtp" component={VenueOtpScreen} />
      <Stack.Screen name="VenueName" component={VenueNameScreen} />
      <Stack.Screen name="VenueLogo" component={VenueLogoScreen} />
      <Stack.Screen name="VenueBio" component={VenueBioScreen} />
      <Stack.Screen name="VenueCategory" component={VenueCategoryScreen} />
      <Stack.Screen name="VenueInterest" component={VenueInterestScreen} />
      <Stack.Screen name="VenueAddress" component={VenueAddressScreen} />
      <Stack.Screen name="VenueMaxCap" component={VenueMaxCapScreen} />
      <Stack.Screen name="VenuePricing" component={VenuePricingScreen} />
      <Stack.Screen name="VenueHost" component={VenueHostNamePhoneScreen} />
    </Stack.Navigator>
  );
}
