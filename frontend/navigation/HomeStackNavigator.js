import React from "react";
import { createStackNavigator } from "@react-navigation/stack";
import HomeFeedScreen from "../screens/home/member/HomeFeedScreen";
import NotificationsScreen from "../screens/notifications/NotificationsScreen";
import ConversationsListScreen from "../screens/messages/ConversationsListScreen";
import ChatScreen from "../screens/messages/ChatScreen";
import CommunityPublicProfileScreen from "../screens/profile/community/CommunityPublicProfileScreen";
import MemberPublicProfileScreen from "../screens/profile/member/MemberPublicProfileScreen";
import SponsorProfileScreen from "../screens/profile/sponsor/SponsorProfileScreen";
import VenueProfileScreen from "../screens/profile/venue/VenueProfileScreen";

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
      <Stack.Screen 
        name="CommunityPublicProfile" 
        component={CommunityPublicProfileScreen}
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
      <Stack.Screen 
        name="SponsorProfile" 
        component={SponsorProfileScreen}
        options={{ 
          headerShown: false,
        }}
      />
      <Stack.Screen 
        name="VenueProfile" 
        component={VenueProfileScreen}
        options={{ 
          headerShown: false,
        }}
      />
    </Stack.Navigator>
  );
}

