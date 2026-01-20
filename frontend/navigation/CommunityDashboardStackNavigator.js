import React from "react";
import { createStackNavigator } from "@react-navigation/stack";
import CommunityDashboardScreen from "../screens/home/community/CommunityDashboardScreen";
import CommunityEventsListScreen from "../screens/home/community/CommunityEventsListScreen";
import OpportunitiesListScreen from "../screens/home/community/OpportunitiesListScreen";
import CreateOpportunityScreen from "../screens/home/community/CreateOpportunityScreen";
import EventAttendeesScreen from "../screens/events/EventAttendeesScreen";
import EventDetailsScreen from "../screens/events/EventDetailsScreen";
import MemberPublicProfileScreen from "../screens/profile/member/MemberPublicProfileScreen";
import QRScannerScreen from "../screens/events/QRScannerScreen";
import ShareTicketScreen from "../screens/events/ShareTicketScreen";

const Stack = createStackNavigator();

export default function CommunityDashboardStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false }}
      initialRouteName="DashboardHome"
    >
      <Stack.Screen name="DashboardHome" component={CommunityDashboardScreen} />
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
      <Stack.Screen name="EventAttendees" component={EventAttendeesScreen} />
      <Stack.Screen
        name="MemberPublicProfile"
        component={MemberPublicProfileScreen}
      />
      <Stack.Screen name="QRScanner" component={QRScannerScreen} />
      <Stack.Screen name="ShareTicket" component={ShareTicketScreen} />
    </Stack.Navigator>
  );
}
