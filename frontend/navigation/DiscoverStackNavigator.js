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
import TabSwipeHandler from "../components/navigation/TabSwipeHandler";



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
        animation: "slide_from_right",
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
    </Stack.Navigator>
  );
}
