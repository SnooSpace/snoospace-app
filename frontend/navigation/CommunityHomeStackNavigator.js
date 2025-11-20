import React from "react";
import { createStackNavigator } from "@react-navigation/stack";
import CommunityHomeFeedScreen from "../screens/home/community/CommunityHomeFeedScreen";
import NotificationsScreen from "../screens/notifications/NotificationsScreen";
import ConversationsListScreen from "../screens/messages/ConversationsListScreen";
import ChatScreen from "../screens/messages/ChatScreen";
import MemberPublicProfileScreen from "../screens/profile/member/MemberPublicProfileScreen";

const Stack = createStackNavigator();

export default function CommunityHomeStackNavigator() {
  return (
    <Stack.Navigator 
      screenOptions={{ headerShown: false }}
      initialRouteName="HomeFeed"
    >
      <Stack.Screen name="HomeFeed" component={CommunityHomeFeedScreen} />
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
      <Stack.Screen 
        name="MemberPublicProfile" 
        component={MemberPublicProfileScreen}
        options={{ 
          headerShown: false,
        }}
      />
    </Stack.Navigator>
  );
}

