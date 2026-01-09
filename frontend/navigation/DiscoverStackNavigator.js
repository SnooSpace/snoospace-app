import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import DiscoverScreen from "../screens/discover/DiscoverScreen";
import ProfileFeedScreen from "../screens/discover/ProfileFeedScreen";
import EditDiscoverProfileScreen from "../screens/discover/EditDiscoverProfileScreen";
import ChatScreen from "../screens/messages/ChatScreen";

const Stack = createNativeStackNavigator();

export default function DiscoverStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="DiscoverHome" component={DiscoverScreen} />
      <Stack.Screen name="ProfileFeed" component={ProfileFeedScreen} />
      <Stack.Screen
        name="EditDiscoverProfile"
        component={EditDiscoverProfileScreen}
      />
      <Stack.Screen name="Chat" component={ChatScreen} />
    </Stack.Navigator>
  );
}
