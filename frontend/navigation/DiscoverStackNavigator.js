import React from "react";
import { Platform } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import DiscoverScreen from "../screens/discover/DiscoverScreen";
import ProfileFeedScreen from "../screens/discover/ProfileFeedScreen";
import EditDiscoverProfileScreen from "../screens/discover/EditDiscoverProfileScreen";
import OpenerSelectionScreen from "../screens/discover/OpenerSelectionScreen";
import ActivityInsightsScreen from "../screens/discover/ActivityInsightsScreen";
import ChatScreen from "../screens/messages/ChatScreen";
import OpportunityViewScreen from "../screens/home/member/OpportunityViewScreen";
import ApplyToOpportunityScreen from "../screens/home/member/ApplyToOpportunityScreen";
import ApplicantsListScreen from "../screens/home/community/ApplicantsListScreen";
import ApplicantDetailScreen from "../screens/home/community/ApplicantDetailScreen";
import TabSwipeHandler from "../components/navigation/TabSwipeHandler";

// Open Plans screens
import PlansDiscoverFeedScreen from "../screens/plans/PlansDiscoverFeedScreen";
import PlanDetailScreen from "../screens/plans/PlanDetailScreen";
import HostRequestsScreen from "../screens/plans/HostRequestsScreen";
import MyPlansScreen from "../screens/plans/MyPlansScreen";
import BlockedUsersScreen from "../screens/plans/BlockedUsersScreen";
import VerificationSubmitScreen from "../screens/plans/VerificationSubmitScreen";

const DiscoverScreenWithSwipe = (props) => (
  <TabSwipeHandler currentTab="Discover">
    <DiscoverScreen {...props} />
  </TabSwipeHandler>
);

const Stack = createNativeStackNavigator();

export default function DiscoverStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: Platform.OS === "ios" ? "ios" : "default",
        gestureEnabled: true,
        ...(Platform.OS === "ios" ? { animationDuration: 350 } : {}),
      }}
    >
      <Stack.Screen name="DiscoverHome" component={DiscoverScreenWithSwipe} />
      <Stack.Screen name="ProfileFeed" component={ProfileFeedScreen} />
      <Stack.Screen
        name="EditDiscoverProfile"
        component={EditDiscoverProfileScreen}
      />
      <Stack.Screen name="OpenerSelection" component={OpenerSelectionScreen} />
      <Stack.Screen
        name="ActivityInsights"
        component={ActivityInsightsScreen}
      />
      <Stack.Screen name="Chat" component={ChatScreen} />
      <Stack.Screen name="OpportunityView" component={OpportunityViewScreen} />
      <Stack.Screen
        name="ApplyToOpportunity"
        component={ApplyToOpportunityScreen}
      />
      <Stack.Screen name="ApplicantsList" component={ApplicantsListScreen} />
      <Stack.Screen name="ApplicantDetail" component={ApplicantDetailScreen} />

      {/* ── Open Plans ─────────────────────────────────────────────────── */}
      <Stack.Screen name="PlansDiscoverFeed" component={PlansDiscoverFeedScreen} />
      <Stack.Screen name="PlanDetail" component={PlanDetailScreen} />
      <Stack.Screen name="HostRequests" component={HostRequestsScreen} />
      <Stack.Screen name="MyPlans" component={MyPlansScreen} />
      <Stack.Screen name="BlockedUsers" component={BlockedUsersScreen} />
      <Stack.Screen name="VerificationSubmit" component={VerificationSubmitScreen} />
    </Stack.Navigator>
  );
}
