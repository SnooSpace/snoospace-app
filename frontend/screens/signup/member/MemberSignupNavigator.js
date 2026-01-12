// screens/signup/member/MemberSignupNavigator.js
import React from "react";
import { createStackNavigator } from "@react-navigation/stack";

// Import Member Signup Screens
import MemberEmailScreen from "./MemberEmailScreen";
import MemberOtpScreen from "./MemberOtpScreen";
import MemberNameScreen from "./MemberNameScreen";
import MemberProfilePicScreen from "./MemberProfilePicScreen";
import MemberAgeScreen from "./MemberAgeScreen";
import MemberPronounsScreen from "./MemberPronounsScreen";
import MemberGenderScreen from "./MemberGenderScreen";
import MemberLocationScreen from "./MemberLocationScreen";
import MemberInterestsScreen from "./MemberInterestsScreen";
import MemberPhoneScreen from "./MemberPhoneScreen";
import MemberUsernameScreen from "./MemberUsernameScreen";

const Stack = createStackNavigator();

/**
 * Signup Flow Order (Multi-Account System):
 * 1. Email → 2. OTP → 3. Name → 4. ProfilePic → 5. Age →
 * 6. Pronouns → 7. Gender → 8. Location → 9. Interests →
 * 10. Phone → 11. Username (FINAL)
 */
export default function MemberSignupNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MemberEmail" component={MemberEmailScreen} />
      <Stack.Screen name="MemberOtp" component={MemberOtpScreen} />
      <Stack.Screen name="MemberName" component={MemberNameScreen} />
      <Stack.Screen
        name="MemberProfilePic"
        component={MemberProfilePicScreen}
      />
      <Stack.Screen name="MemberAge" component={MemberAgeScreen} />
      <Stack.Screen name="MemberPronouns" component={MemberPronounsScreen} />
      <Stack.Screen name="MemberGender" component={MemberGenderScreen} />
      <Stack.Screen name="MemberLocation" component={MemberLocationScreen} />
      <Stack.Screen name="MemberInterests" component={MemberInterestsScreen} />
      <Stack.Screen name="MemberPhone" component={MemberPhoneScreen} />
      <Stack.Screen name="MemberUsername" component={MemberUsernameScreen} />
    </Stack.Navigator>
  );
}
