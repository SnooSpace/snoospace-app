import React from "react";
import { createStackNavigator, CardStyleInterpolators } from "@react-navigation/stack";
import CommunityProfileScreen from "../screens/profile/community/CommunityProfileScreen";
import CommunityFollowersListScreen from "../screens/profile/community/CommunityFollowersListScreen";
import CommunityFollowingListScreen from "../screens/profile/community/CommunityFollowingListScreen";
import CommunityPublicProfileScreen from "../screens/profile/community/CommunityPublicProfileScreen";
import EditCommunityProfileScreen from "../screens/profile/community/EditCommunityProfileScreen";
import CommunityHostsScreen from "../screens/profile/community/CommunityHostsScreen";
import MemberPublicProfileScreen from "../screens/profile/member/MemberPublicProfileScreen";
import FollowersListScreen from "../screens/profile/member/FollowersListScreen";
import FollowingListScreen from "../screens/profile/member/FollowingListScreen";
import OpportunityViewScreen from "../screens/home/member/OpportunityViewScreen";

const Stack = createStackNavigator();

export default function CommunityProfileStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        gestureEnabled: true,
        gestureDirection: "horizontal",
        transitionSpec: {
          open: {
            animation: "spring",
            config: {
              stiffness: 1000,
              damping: 500,
              mass: 3,
              overshootClamping: true,
              restDisplacementThreshold: 0.01,
              restSpeedThreshold: 0.01,
            },
          },
          close: {
            animation: "spring",
            config: {
              stiffness: 1000,
              damping: 500,
              mass: 3,
              overshootClamping: true,
              restDisplacementThreshold: 0.01,
              restSpeedThreshold: 0.01,
            },
          },
        },
        cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
      }}
      initialRouteName="Profile"
    >
      <Stack.Screen name="Profile" component={CommunityProfileScreen} />
      <Stack.Screen
        name="CommunityFollowersList"
        component={CommunityFollowersListScreen}
      />
      <Stack.Screen
        name="CommunityFollowingList"
        component={CommunityFollowingListScreen}
      />
      <Stack.Screen
        name="CommunityPublicProfile"
        component={CommunityPublicProfileScreen}
      />
      <Stack.Screen
        name="EditCommunityProfile"
        component={EditCommunityProfileScreen}
      />
      <Stack.Screen
        name="CommunityHosts"
        component={CommunityHostsScreen}
      />
      <Stack.Screen
        name="MemberPublicProfile"
        component={MemberPublicProfileScreen}
      />
      <Stack.Screen name="FollowersList" component={FollowersListScreen} />
      <Stack.Screen name="FollowingList" component={FollowingListScreen} />
      <Stack.Screen name="OpportunityView" component={OpportunityViewScreen} />
    </Stack.Navigator>
  );
}
