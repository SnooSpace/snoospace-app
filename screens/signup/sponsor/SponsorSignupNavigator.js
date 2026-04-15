import React from "react";
import { createStackNavigator } from "@react-navigation/stack";

import SponsorEmailScreen from "./SponsorEmailScreen";
import SponsorOtpScreen from "./SponsorOtpScreen";
import SponsorPhoneNoScreen from "./SponsorPhoneNoScreen";
import SponsorBrandNameScreen from "./SponsorBrandNameScreen";
import SponsorLogoScreen from "./SponsorLogoScreen";
import SponsorBioScreen from "./SponsorBioScreen";
import SponsorCategoryScreen from "./SponsorCategoryScreen";
import SponsorInterestsScreen from "./SponsorInterestsScreen";
import SponsorUsernameScreen from "./SponsorUsernameScreen";

const Stack = createStackNavigator();

export default function SponsorSignupNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SponsorEmail" component={SponsorEmailScreen} />
      <Stack.Screen name="SponsorOtp" component={SponsorOtpScreen} />
      <Stack.Screen name="SponsorPhone" component={SponsorPhoneNoScreen} />
      <Stack.Screen name="SponsorName" component={SponsorBrandNameScreen} />
      <Stack.Screen name="SponsorLogo" component={SponsorLogoScreen} />
      <Stack.Screen name="SponsorBio" component={SponsorBioScreen} />
      <Stack.Screen name="SponsorCategory" component={SponsorCategoryScreen} />
      <Stack.Screen
        name="SponsorInterests"
        component={SponsorInterestsScreen}
      />
      <Stack.Screen name="SponsorUsername" component={SponsorUsernameScreen} />
    </Stack.Navigator>
  );
}
