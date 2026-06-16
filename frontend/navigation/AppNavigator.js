// navigation/AppNavigator.js
import React from "react";
import { createStackNavigator, CardStyleInterpolators } from "@react-navigation/stack";

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
import CreateOpportunityScreen from "../screens/home/community/CreateOpportunityScreen";
import CelebrationScreen from "../screens/signup/CelebrationScreen";
import PeopleProfilePromptScreen from "../screens/signup/community/PeopleProfilePromptScreen";

import EventDetailsScreen from "../screens/events/EventDetailsScreen";
import ProfileFeedScreen from "../screens/discover/ProfileFeedScreen";
import TicketSelectionScreen from "../screens/events/TicketSelectionScreen";
import CheckoutScreen from "../screens/events/CheckoutScreen";
import TicketViewScreen from "../screens/events/TicketViewScreen";
import EventGalleryScreen from "../screens/events/EventGalleryScreen";
import CategoryEventsScreen from "../screens/events/CategoryEventsScreen";
import MemberPublicProfileScreen from "../screens/profile/member/MemberPublicProfileScreen";
import CommunityPublicProfileScreen from "../screens/profile/community/CommunityPublicProfileScreen";
import { CropScreen, BatchCropScreen } from "../components/MediaCrop";
import DeleteAccountScreen from "../screens/profile/DeleteAccountScreen";
import DeleteConfirmationScreen from "../screens/profile/DeleteConfirmationScreen";
import SavedPostsScreen from "../screens/SavedPostsScreen";
import ConsentScreen from "../screens/Privacy/ConsentScreen";
import MyDataScreen from "../screens/Privacy/MyDataScreen";
import OpportunityViewScreen from "../screens/home/member/OpportunityViewScreen";
import ApplyToOpportunityScreen from "../screens/home/member/ApplyToOpportunityScreen";
import ApplicantsListScreen from "../screens/home/community/ApplicantsListScreen";
import ApplicantDetailScreen from "../screens/home/community/ApplicantDetailScreen";
import QRScannerScreen from "../screens/events/QRScannerScreen";
import UniversalFollowersScreen from "../screens/profile/UniversalFollowersScreen";
import UniversalFollowingScreen from "../screens/profile/UniversalFollowingScreen";
import FollowingListScreen from "../screens/profile/member/FollowingListScreen";
import CircleListScreen from "../screens/profile/member/CircleListScreen";
import CircleRequestsScreen from "../screens/profile/member/CircleRequestsScreen";

const Stack = createStackNavigator();

const forFadeFromCenter = ({ current }) => ({
  cardStyle: {
    opacity: current.progress,
  },
});

export default function AppNavigator({ initialRouteName }) {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        gestureEnabled: true,
        gestureDirection: "horizontal",
        transitionSpec: {
          open: {
            animation: "spring",
            config: {
              stiffness: 1000,
              damping: 500,
              mass: 3,
              overshootClamping: true,
              restDisplacementThreshold: 0.01,
              restSpeedThreshold: 0.01,
            },
          },
          close: {
            animation: "spring",
            config: {
              stiffness: 1000,
              damping: 500,
              mass: 3,
              overshootClamping: true,
              restDisplacementThreshold: 0.01,
              restSpeedThreshold: 0.01,
            },
          },
        },
        cardStyleInterpolator: forFadeFromCenter,
      }}
      initialRouteName={initialRouteName}
    >
      <Stack.Screen name="AuthGate" component={AuthGate} />
      <Stack.Screen
        name="Landing"
        component={LandingScreen}
        options={{ gestureEnabled: false }}
      />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="LoginOtp" component={LoginOtpScreen} />
      <Stack.Screen name="MemberSignup" component={MemberSignupNavigator} />
      <Stack.Screen
        name="CommunitySignup"
        component={CommunitySignupNavigator}
      />
      <Stack.Screen name="SponsorSignup" component={SponsorSignupNavigator} />
      <Stack.Screen name="VenueSignup" component={VenueSignupNavigator} />
      <Stack.Screen name="Celebration" component={CelebrationScreen} />
      <Stack.Screen name="PeopleProfilePromptScreen" component={PeopleProfilePromptScreen} />
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
        options={{
          headerShown: false,
          cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
        }}
      />
      <Stack.Screen
        name="CommunityCreatePost"
        component={CommunityCreatePostScreen}
        options={{
          headerShown: false,
          presentation: "fullScreenModal",
          cardStyleInterpolator: CardStyleInterpolators.forVerticalIOS,
        }}
      />
      <Stack.Screen
        name="CreateOpportunity"
        component={CreateOpportunityScreen}
        options={{
          headerShown: false,
          presentation: "fullScreenModal",
          cardStyleInterpolator: CardStyleInterpolators.forVerticalIOS,
        }}
      />
      <Stack.Screen
        name="EventDetails"
        component={EventDetailsScreen}
        options={{
          headerShown: false,
          cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
        }}
      />
      <Stack.Screen
        name="ProfileFeed"
        component={ProfileFeedScreen}
        options={{
          headerShown: false,
          cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
        }}
      />
      <Stack.Screen
        name="TicketSelection"
        component={TicketSelectionScreen}
        options={{
          headerShown: false,
          cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
        }}
      />
      <Stack.Screen
        name="Checkout"
        component={CheckoutScreen}
        options={{
          headerShown: false,
          cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
        }}
      />
      <Stack.Screen
        name="TicketView"
        component={TicketViewScreen}
        options={{
          headerShown: false,
          cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
        }}
      />
      <Stack.Screen
        name="CategoryEvents"
        component={CategoryEventsScreen}
        options={{
          headerShown: false,
          cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
        }}
      />
      <Stack.Screen
        name="EventGallery"
        component={EventGalleryScreen}
        options={{
          headerShown: false,
          presentation: "fullScreenModal",
          cardStyleInterpolator: CardStyleInterpolators.forVerticalIOS,
        }}
      />
      <Stack.Screen
        name="MemberPublicProfile"
        component={MemberPublicProfileScreen}
        options={{
          headerShown: false,
          cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
        }}
      />
      <Stack.Screen
        name="CommunityPublicProfile"
        component={CommunityPublicProfileScreen}
        options={{
          headerShown: false,
          cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
        }}
      />
      <Stack.Screen
        name="CommunityPublicEventsList"
        component={
          require("../screens/profile/community/CommunityPublicEventsListScreen")
            .default
        }
        options={{
          headerShown: false,
          cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
        }}
      />
      <Stack.Screen
        name="CropScreen"
        component={CropScreen}
        options={{
          headerShown: false,
          presentation: "fullScreenModal",
          cardStyleInterpolator: CardStyleInterpolators.forVerticalIOS,
        }}
      />
      <Stack.Screen
        name="BatchCropScreen"
        component={BatchCropScreen}
        options={{
          headerShown: false,
          presentation: "fullScreenModal",
          cardStyleInterpolator: CardStyleInterpolators.forVerticalIOS,
        }}
      />
      <Stack.Screen
        name="DeleteAccount"
        component={DeleteAccountScreen}
        options={{
          headerShown: false,
          cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
        }}
      />
      <Stack.Screen
        name="DeleteConfirmation"
        component={DeleteConfirmationScreen}
        options={{
          headerShown: false,
          cardStyleInterpolator: forFadeFromCenter,
        }}
      />
      <Stack.Screen
        name="SavedPostsScreen"
        component={SavedPostsScreen}
        options={{
          headerShown: false,
          cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
        }}
      />
      <Stack.Screen
        name="ConsentScreen"
        component={ConsentScreen}
        options={{
          headerShown: false,
          cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
        }}
      />
      <Stack.Screen
        name="MyDataScreen"
        component={MyDataScreen}
        options={{
          headerShown: false,
          cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
        }}
      />
      <Stack.Screen
        name="OpportunityView"
        component={OpportunityViewScreen}
        options={{
          headerShown: false,
          cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
        }}
      />
      <Stack.Screen
        name="ApplyToOpportunity"
        component={ApplyToOpportunityScreen}
        options={{
          headerShown: false,
          cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
        }}
      />
      <Stack.Screen
        name="ApplicantsList"
        component={ApplicantsListScreen}
        options={{
          headerShown: false,
          cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
        }}
      />
      <Stack.Screen
        name="ApplicantDetail"
        component={ApplicantDetailScreen}
        options={{
          headerShown: false,
          cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
        }}
      />
      <Stack.Screen
        name="QRScanner"
        component={QRScannerScreen}
        options={{
          headerShown: false,
          cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
        }}
      />
      <Stack.Screen
        name="UniversalFollowersList"
        component={UniversalFollowersScreen}
        options={{
          headerShown: false,
          cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
        }}
      />
      <Stack.Screen
        name="UniversalFollowingList"
        component={UniversalFollowingScreen}
        options={{
          headerShown: false,
          cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
        }}
      />
      <Stack.Screen
        name="FollowingList"
        component={FollowingListScreen}
        options={{
          headerShown: false,
          cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
        }}
      />
      <Stack.Screen
        name="CircleList"
        component={CircleListScreen}
        options={{
          headerShown: false,
          cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
        }}
      />
      <Stack.Screen
        name="CircleRequests"
        component={CircleRequestsScreen}
        options={{
          headerShown: false,
          cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
        }}
      />
    </Stack.Navigator>
  );
}
