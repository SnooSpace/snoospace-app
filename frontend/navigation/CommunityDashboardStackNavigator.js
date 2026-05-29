import React from "react";
import { createStackNavigator, CardStyleInterpolators } from "@react-navigation/stack";
import CommunityDashboardScreen from "../screens/home/community/CommunityDashboardScreen";
import CommunityEventsListScreen from "../screens/home/community/CommunityEventsListScreen";
import OpportunitiesListScreen from "../screens/home/community/OpportunitiesListScreen";
import CreateOpportunityScreen from "../screens/home/community/CreateOpportunityScreen";
import ApplicantsListScreen from "../screens/home/community/ApplicantsListScreen";
import ApplicantDetailScreen from "../screens/home/community/ApplicantDetailScreen";
import EventAttendeesScreen from "../screens/events/EventAttendeesScreen";
import EventDetailsScreen from "../screens/events/EventDetailsScreen";
import MemberPublicProfileScreen from "../screens/profile/member/MemberPublicProfileScreen";
import ShareTicketScreen from "../screens/events/ShareTicketScreen";
import AudienceIntelligenceScreen from "../screens/home/community/AudienceIntelligenceScreen";
import EventQualityScreen from "../screens/home/community/EventQualityScreen";

import TabSwipeHandler from "../components/navigation/TabSwipeHandler";

const CommunityTabs = ["Home", "Search", "Dashboard", "Requests", "Profile"];

const DashboardHomeWithSwipe = (props) => (
  <TabSwipeHandler currentTab="Dashboard" tabs={CommunityTabs}>
    <CommunityDashboardScreen {...props} />
  </TabSwipeHandler>
);

const Stack = createStackNavigator();

export default function CommunityDashboardStackNavigator() {
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
        cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
      }}
      initialRouteName="DashboardHome"
    >
      <Stack.Screen name="DashboardHome" component={DashboardHomeWithSwipe} />
      <Stack.Screen
        name="CommunityEventsList"
        component={CommunityEventsListScreen}
      />
      <Stack.Screen
        name="OpportunitiesList"
        component={OpportunitiesListScreen}
      />
      <Stack.Screen
        name="CreateOpportunity"
        component={CreateOpportunityScreen}
      />
      <Stack.Screen name="ApplicantsList" component={ApplicantsListScreen} />
      <Stack.Screen name="ApplicantDetail" component={ApplicantDetailScreen} />
      <Stack.Screen name="EventAttendees" component={EventAttendeesScreen} />
      <Stack.Screen
        name="MemberPublicProfile"
        component={MemberPublicProfileScreen}
      />
      <Stack.Screen name="ShareTicket" component={ShareTicketScreen} />
      <Stack.Screen name="AudienceIntelligence" component={AudienceIntelligenceScreen} />
      <Stack.Screen name="EventQuality" component={EventQualityScreen} />
    </Stack.Navigator>
  );
}
