import React from "react";
import { createStackNavigator, CardStyleInterpolators } from "@react-navigation/stack";
import { Easing } from "react-native";

import CommunityEmailScreen from "./CommunityEmailScreen";
import CommunityOtpScreen from "./CommunityOtpScreen";
// NEW: Community type selection screens
import CommunityTypeSelectScreen from "./CommunityTypeSelectScreen";
import CollegeSearchScreen from "./CollegeSearchScreen";
import CollegeSubtypeSelectScreen from "./CollegeSubtypeSelectScreen";
import CollegeClubTypeScreen from "./CollegeClubTypeScreen";
import StudentCommunityThemeScreen from "./StudentCommunityThemeScreen";
// Existing screens
import CommunityNameScreen from "./CommunityNameScreen";
import CommunityLogoscreen from "./CommunityLogoscreen";
import CommunityBioScreen from "./CommunityBioScreen";
import CommunityCategoryScreen from "./CommunityCategoryScreen";
import CommunityLocationQuestionScreen from "./CommunityLocationQuestionScreen";
import CommunityLocationScreen from "./CommunityLocationScreen";
import IndividualLocationScreen from "./IndividualLocationScreen";
import CommunityPhoneNoScreen from "./CommunityPhoneNoScreen";
import CommunityHeadNameScreen from "./CommunityHeadNameScreen";
import CollegeHeadsScreen from "./CollegeHeadsScreen";
import CommunitySponsorTypeSelect from "./CommunitySponsorTypeSelect";
import CommunityUsernameScreen from "./CommunityUsernameScreen";

const Stack = createStackNavigator();

const verticalAnimation = {
  gestureDirection: "vertical",
  transitionSpec: {
    open: {
      animation: "timing",
      config: {
        duration: 350,
        easing: Easing.out(Easing.poly(4)),
      },
    },
    close: {
      animation: "timing",
      config: {
        duration: 300,
        easing: Easing.out(Easing.poly(4)),
      },
    },
  },
  cardStyleInterpolator: ({ current, next, layouts }) => {
    return {
      cardStyle: {
        transform: [
          {
            translateY: current.progress.interpolate({
              inputRange: [0, 1],
              outputRange: [layouts.screen.height * 0.05, 0],
            }),
          },
        ],
        opacity: current.progress,
      },
    };
  },
};

export default function CommunitySignupNavigator() {
  return (
    <Stack.Navigator 
      screenOptions={{ 
        headerShown: false,
        ...verticalAnimation
      }}
    >
      <Stack.Screen name="CommunityEmail" component={CommunityEmailScreen} />
      <Stack.Screen name="CommunityOtp" component={CommunityOtpScreen} />
      {/* NEW: Type selection after OTP */}
      <Stack.Screen
        name="CommunityTypeSelect"
        component={CommunityTypeSelectScreen}
      />
      {/* NEW: College flow */}
      <Stack.Screen name="CollegeSearch" component={CollegeSearchScreen} />
      <Stack.Screen
        name="CollegeSubtypeSelect"
        component={CollegeSubtypeSelectScreen}
      />
      <Stack.Screen name="CollegeClubType" component={CollegeClubTypeScreen} />
      <Stack.Screen
        name="StudentCommunityTheme"
        component={StudentCommunityThemeScreen}
      />
      {/* Existing flow */}
      <Stack.Screen name="CommunityName" component={CommunityNameScreen} />
      <Stack.Screen name="CommunityLogo" component={CommunityLogoscreen} />
      <Stack.Screen name="CommunityBio" component={CommunityBioScreen} />
      <Stack.Screen
        name="CommunityCategory"
        component={CommunityCategoryScreen}
      />
      <Stack.Screen
        name="CommunityLocationQuestion"
        component={CommunityLocationQuestionScreen}
      />
      <Stack.Screen
        name="CommunityLocation"
        component={CommunityLocationScreen}
      />
      <Stack.Screen
        name="IndividualLocation"
        component={IndividualLocationScreen}
      />
      <Stack.Screen name="CommunityPhone" component={CommunityPhoneNoScreen} />
      <Stack.Screen
        name="CommunityHeadName"
        component={CommunityHeadNameScreen}
      />
      <Stack.Screen name="CollegeHeads" component={CollegeHeadsScreen} />
      <Stack.Screen
        name="CommunitySponsorType"
        component={CommunitySponsorTypeSelect}
      />
      <Stack.Screen
        name="CommunityUsername"
        component={CommunityUsernameScreen}
      />
    </Stack.Navigator>
  );
}
