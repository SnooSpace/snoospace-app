import React from "react";
import { Platform } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import CommunityDashboardScreen from "../screens/home/community/CommunityDashboardScreen";
import CommunityEventsListScreen from "../screens/home/community/CommunityEventsListScreen";
import OpportunitiesListScreen from "../screens/home/community/OpportunitiesListScreen";
import CreateOpportunityScreen from "../screens/home/community/CreateOpportunityScreen";
import EventAttendeesScreen from "../screens/events/EventAttendeesScreen";
import EventDetailsScreen from "../screens/events/EventDetailsScreen";
import ShareTicketScreen from "../screens/events/ShareTicketScreen";
import AudienceIntelligenceScreen from "../screens/home/community/AudienceIntelligenceScreen";
import EventQualityScreen from "../screens/home/community/EventQualityScreen";
import InviteMembersScreen from "../screens/home/community/InviteMembersScreen";

const Stack = createNativeStackNavigator();

export default function CommunityDashboardStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        gestureEnabled: true,
        animation: "slide_from_right",
        contentStyle: { backgroundColor: "#FFFFFF" },
        ...(Platform.OS === "ios" ? { animationDuration: 350 } : {}),
      }}
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
      <Stack.Screen name="ShareTicket" component={ShareTicketScreen} />
      <Stack.Screen name="AudienceIntelligence" component={AudienceIntelligenceScreen} />
      <Stack.Screen name="EventQuality" component={EventQualityScreen} />
      <Stack.Screen name="InviteMembers" component={InviteMembersScreen} />
    </Stack.Navigator>
  );
}
