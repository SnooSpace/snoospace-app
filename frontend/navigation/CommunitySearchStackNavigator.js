import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

import SearchScreen from '../screens/search/SearchScreen';
import CommunityPublicProfileScreen from '../screens/profile/community/CommunityPublicProfileScreen';
import MemberPublicProfileScreen from '../screens/profile/member/MemberPublicProfileScreen';
import SponsorProfileScreen from '../screens/profile/sponsor/SponsorProfileScreen';
import VenueProfileScreen from '../screens/profile/venue/VenueProfileScreen';

const Stack = createStackNavigator();

export default function CommunitySearchStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name="CommunitySearchHome"
        component={SearchScreen}
      />
      <Stack.Screen
        name="CommunityPublicProfile"
        component={CommunityPublicProfileScreen}
      />
      <Stack.Screen
        name="MemberPublicProfile"
        component={MemberPublicProfileScreen}
      />
      <Stack.Screen
        name="SponsorProfile"
        component={SponsorProfileScreen}
      />
      <Stack.Screen
        name="VenueProfile"
        component={VenueProfileScreen}
      />
    </Stack.Navigator>
  );
}

