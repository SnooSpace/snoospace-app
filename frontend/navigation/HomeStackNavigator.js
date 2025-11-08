import React from "react";
import { createStackNavigator } from "@react-navigation/stack";
import HomeFeedScreen from "../screens/home/member/HomeFeedScreen";
import NotificationsScreen from "../screens/notifications/NotificationsScreen";

const Stack = createStackNavigator();

export default function HomeStackNavigator() {
  return (
    <Stack.Navigator 
      screenOptions={{ headerShown: false }}
      initialRouteName="HomeFeed"
    >
      <Stack.Screen name="HomeFeed" component={HomeFeedScreen} />
      <Stack.Screen 
        name="Notifications" 
        component={NotificationsScreen}
        options={{ 
          headerShown: false,
        }}
      />
    </Stack.Navigator>
  );
}

