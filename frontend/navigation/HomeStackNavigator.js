import React from "react";
import { createStackNavigator } from "@react-navigation/stack";
import HomeFeedScreen from "../screens/home/member/HomeFeedScreen";
import NotificationsScreen from "../screens/notifications/NotificationsScreen";
import ConversationsListScreen from "../screens/messages/ConversationsListScreen";
import ChatScreen from "../screens/messages/ChatScreen";

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
      <Stack.Screen 
        name="ConversationsList" 
        component={ConversationsListScreen}
        options={{ 
          headerShown: false,
        }}
      />
      <Stack.Screen 
        name="Chat" 
        component={ChatScreen}
        options={{ 
          headerShown: false,
        }}
      />
    </Stack.Navigator>
  );
}

