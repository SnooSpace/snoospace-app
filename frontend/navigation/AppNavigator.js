// navigation/AppNavigator.js
import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

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
import ChatScreen from "../screens/messages/ChatScreen";
import { CropScreen, BatchCropScreen } from "../components/MediaCrop";
import SavedPostsScreen from "../screens/SavedPostsScreen";
import DeleteAccountScreen from "../screens/profile/DeleteAccountScreen";
import DeleteConfirmationScreen from "../screens/profile/DeleteConfirmationScreen";
import ConsentScreen from "../screens/Privacy/ConsentScreen";
import MyDataScreen from "../screens/Privacy/MyDataScreen";
import OpportunityViewScreen from "../screens/home/member/OpportunityViewScreen";
import SettingsScreen from "../screens/profile/member/SettingsScreen";
import LinkedAccountsScreen from "../screens/profile/member/LinkedAccountsScreen";
import BlockedAccountsScreen from "../screens/profile/member/BlockedAccountsScreen";
import CommunityMonetizationScreen from "../screens/profile/community/CommunityMonetizationScreen";
import ApplyToOpportunityScreen from "../screens/home/member/ApplyToOpportunityScreen";
import ApplicantsListScreen from "../screens/home/community/ApplicantsListScreen";
import ApplicantDetailScreen from "../screens/home/community/ApplicantDetailScreen";
import QRScannerScreen from "../screens/events/QRScannerScreen";
import UniversalFollowersScreen from "../screens/profile/UniversalFollowersScreen";
import UniversalFollowingScreen from "../screens/profile/UniversalFollowingScreen";
import FollowersListScreen from "../screens/profile/member/FollowersListScreen";
import FollowingListScreen from "../screens/profile/member/FollowingListScreen";
import CommunityFollowersListScreen from "../screens/profile/community/CommunityFollowersListScreen";
import CommunityFollowingListScreen from "../screens/profile/community/CommunityFollowingListScreen";
import CircleListScreen from "../screens/profile/member/CircleListScreen";
import CircleRequestsScreen from "../screens/profile/member/CircleRequestsScreen";
import CreatorFollowersScreen from "../screens/profile/member/CreatorFollowersScreen";
import CommunityFollowersScreen from "../screens/profile/community/CommunityFollowersScreen";

import PlansDiscoverFeedScreen from "../screens/plans/PlansDiscoverFeedScreen";
import PlanDetailScreen from "../screens/plans/PlanDetailScreen";
import HostRequestsScreen from "../screens/plans/HostRequestsScreen";
import MyPlansScreen from "../screens/plans/MyPlansScreen";
import BlockedUsersScreen from "../screens/plans/BlockedUsersScreen";
import VerificationSubmitScreen from "../screens/plans/VerificationSubmitScreen";

const Stack = createNativeStackNavigator();

export default function AppNavigator({ initialRouteName }) {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        gestureEnabled: true,
        animation: "slide_from_right", // Native horizontal slide transition
      }}
      initialRouteName={initialRouteName}
    >
      <Stack.Screen name="AuthGate" component={AuthGate} options={{ animation: "fade" }} />
      <Stack.Screen
        name="Landing"
        component={LandingScreen}
        options={{ gestureEnabled: false, animation: "fade" }}
      />
      <Stack.Screen name="Login" component={LoginScreen} options={{ animation: "fade" }} />
      <Stack.Screen name="LoginOtp" component={LoginOtpScreen} options={{ animation: "fade" }} />
      <Stack.Screen name="MemberSignup" component={MemberSignupNavigator} options={{ animation: "fade" }} />
      <Stack.Screen
        name="CommunitySignup"
        component={CommunitySignupNavigator}
        options={{ animation: "fade" }}
      />
      <Stack.Screen name="SponsorSignup" component={SponsorSignupNavigator} options={{ animation: "fade" }} />
      <Stack.Screen name="VenueSignup" component={VenueSignupNavigator} options={{ animation: "fade" }} />
      <Stack.Screen name="Celebration" component={CelebrationScreen} options={{ animation: "fade" }} />
      <Stack.Screen
        name="PeopleProfilePromptScreen"
        component={PeopleProfilePromptScreen}
        options={{ animation: "fade" }}
      />
      <Stack.Screen
        name="MemberHome"
        component={BottomTabNavigator}
        options={{ animation: "fade" }}
      />
      <Stack.Screen
        name="CommunityHome"
        component={CommunityBottomTabNavigator}
        options={{ animation: "fade" }}
      />
      <Stack.Screen
        name="SponsorHome"
        component={SponsorBottomTabNavigator}
        options={{ animation: "fade" }}
      />
      <Stack.Screen
        name="VenueHome"
        component={VenueBottomTabNavigator}
        options={{ animation: "fade" }}
      />
      <Stack.Screen
        name="CommunityEventsList"
        component={CommunityEventsListScreen}
      />
      <Stack.Screen
        name="CommunityCreatePost"
        component={CommunityCreatePostScreen}
        options={{
          presentation: "fullScreenModal",
        }}
      />
      <Stack.Screen
        name="CreateOpportunity"
        component={CreateOpportunityScreen}
        options={{
          presentation: "fullScreenModal",
        }}
      />
      <Stack.Screen
        name="EventDetails"
        component={EventDetailsScreen}
      />
      <Stack.Screen
        name="ProfileFeed"
        component={ProfileFeedScreen}
      />
      <Stack.Screen
        name="TicketSelection"
        component={TicketSelectionScreen}
      />
      <Stack.Screen
        name="Checkout"
        component={CheckoutScreen}
      />
      <Stack.Screen
        name="TicketView"
        component={TicketViewScreen}
      />
      <Stack.Screen
        name="CategoryEvents"
        component={CategoryEventsScreen}
      />
      <Stack.Screen
        name="EventGallery"
        component={EventGalleryScreen}
        options={{
          presentation: "fullScreenModal",
        }}
      />
      <Stack.Screen
        name="MemberPublicProfile"
        component={MemberPublicProfileScreen}
      />
      <Stack.Screen
        name="CommunityPublicProfile"
        component={CommunityPublicProfileScreen}
      />
      <Stack.Screen
        name="Chat"
        component={ChatScreen}
      />
      <Stack.Screen
        name="CommunityPublicEventsList"
        component={
          require("../screens/profile/community/CommunityPublicEventsListScreen")
            .default
        }
      />
      <Stack.Screen
        name="CropScreen"
        component={CropScreen}
        options={{
          presentation: "fullScreenModal",
        }}
      />
      <Stack.Screen
        name="BatchCropScreen"
        component={BatchCropScreen}
        options={{
          presentation: "fullScreenModal",
        }}
      />
      <Stack.Screen
        name="DeleteAccount"
        component={DeleteAccountScreen}
      />
      <Stack.Screen
        name="DeleteConfirmation"
        component={DeleteConfirmationScreen}
        options={{
          animation: "fade",
        }}
      />
      <Stack.Screen
        name="ConsentScreen"
        component={ConsentScreen}
      />
      <Stack.Screen
        name="MyDataScreen"
        component={MyDataScreen}
      />
      <Stack.Screen
        name="OpportunityView"
        component={OpportunityViewScreen}
      />
      <Stack.Screen
        name="ApplyToOpportunity"
        component={ApplyToOpportunityScreen}
      />
      <Stack.Screen
        name="ApplicantsList"
        component={ApplicantsListScreen}
      />
      <Stack.Screen
        name="ApplicantDetail"
        component={ApplicantDetailScreen}
      />
      <Stack.Screen
        name="QRScanner"
        component={QRScannerScreen}
      />
      <Stack.Screen
        name="UniversalFollowersList"
        component={UniversalFollowersScreen}
      />
      <Stack.Screen
        name="UniversalFollowingList"
        component={UniversalFollowingScreen}
      />
      <Stack.Screen
        name="FollowersList"
        component={FollowersListScreen}
      />
      <Stack.Screen
        name="FollowingList"
        component={FollowingListScreen}
      />
      <Stack.Screen
        name="CommunityFollowersList"
        component={CommunityFollowersListScreen}
      />
      <Stack.Screen
        name="CommunityFollowingList"
        component={CommunityFollowingListScreen}
      />
      <Stack.Screen
        name="CircleList"
        component={CircleListScreen}
      />
      <Stack.Screen
        name="CircleRequests"
        component={CircleRequestsScreen}
      />
      <Stack.Screen
        name="CreatorFollowers"
        component={CreatorFollowersScreen}
      />
      <Stack.Screen
        name="CommunityFollowers"
        component={CommunityFollowersScreen}
      />
      <Stack.Screen
        name="SavedPostsScreen"
        component={SavedPostsScreen}
      />
      <Stack.Screen name="PlansDiscoverFeed" component={PlansDiscoverFeedScreen} />
      <Stack.Screen name="PlanDetail" component={PlanDetailScreen} />
      <Stack.Screen name="HostRequests" component={HostRequestsScreen} />
      <Stack.Screen name="MyPlans" component={MyPlansScreen} />
      <Stack.Screen name="BlockedUsers" component={BlockedUsersScreen} />
      <Stack.Screen name="VerificationSubmit" component={VerificationSubmitScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="LinkedAccounts" component={LinkedAccountsScreen} />
      <Stack.Screen name="BlockedAccounts" component={BlockedAccountsScreen} />
      <Stack.Screen name="CreatorMonetization" component={CommunityMonetizationScreen} />
      <Stack.Screen name="CommunityMonetization" component={CommunityMonetizationScreen} />
    </Stack.Navigator>
  );
}
