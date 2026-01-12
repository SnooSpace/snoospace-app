// screens/signup/member/MemberSignupNavigator.js
import React from "react";
import { createStackNavigator } from "@react-navigation/stack";

// Import Member Signup Screens
import MemberEmailScreen from "./MemberEmailScreen";
import MemberOtpScreen from "./MemberOtpScreen";
import MemberPhoneScreen from "./MemberPhoneScreen";
import MemberNameScreen from "./MemberNameScreen";
import MemberGenderScreen from "./MemberGenderScreen";
import MemberPronounsScreen from "./MemberPronounsScreen";
import MemberAgeScreen from "./MemberAgeScreen";
import MemberInterestsScreen from "./MemberInterestsScreen";
import MemberLocationScreen from "./MemberLocationScreen";
import MemberProfilePicScreen from "./MemberProfilePicScreen";
import MemberUsernameScreen from "./MemberUsernameScreen";

const Stack = createStackNavigator();

export default function MemberSignupNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MemberEmail" component={MemberEmailScreen} />
      <Stack.Screen name="MemberOtp" component={MemberOtpScreen} />
      <Stack.Screen name="MemberPhone" component={MemberPhoneScreen} />
      <Stack.Screen name="MemberName" component={MemberNameScreen} />
      <Stack.Screen name="MemberGender" component={MemberGenderScreen} />
      <Stack.Screen name="MemberPronouns" component={MemberPronounsScreen} />
      <Stack.Screen name="MemberAge" component={MemberAgeScreen} />
      <Stack.Screen name="MemberInterests" component={MemberInterestsScreen} />
      <Stack.Screen name="MemberLocation" component={MemberLocationScreen} />
      <Stack.Screen
        name="MemberProfilePic"
        component={MemberProfilePicScreen}
      />
      <Stack.Screen name="MemberUsername" component={MemberUsernameScreen} />
    </Stack.Navigator>
  );
}
