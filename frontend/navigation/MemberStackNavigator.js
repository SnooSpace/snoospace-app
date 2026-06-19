import React from "react";
import { createStackNavigator } from "@react-navigation/stack";

import MemberPublicProfileScreen from "../screens/profile/member/MemberPublicProfileScreen";

import EditProfileScreen from "../screens/profile/member/EditProfileScreen";
import NotificationsScreen from "../screens/notifications/NotificationsScreen";
import CommunityPublicProfileScreen from "../screens/profile/community/CommunityPublicProfileScreen";
import SponsorProfileScreen from "../screens/profile/sponsor/SponsorProfileScreen";
import VenueProfileScreen from "../screens/profile/venue/VenueProfileScreen";


const Stack = createStackNavigator();

export default function MemberStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MemberPublicProfile" component={MemberPublicProfileScreen} />
      <Stack.Screen name="CommunityPublicProfile" component={CommunityPublicProfileScreen} />
      <Stack.Screen name="SponsorProfile" component={SponsorProfileScreen} />
      <Stack.Screen name="VenueProfile" component={VenueProfileScreen} />

      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ headerShown: true }} />

    </Stack.Navigator>
  );
}

