import React from "react";
import { createStackNavigator } from "@react-navigation/stack";
import MemberProfileScreen from "../screens/profile/member/MemberProfileScreen";
import FollowersListScreen from "../screens/profile/member/FollowersListScreen";
import FollowingListScreen from "../screens/profile/member/FollowingListScreen";
import MemberPublicProfileScreen from "../screens/profile/member/MemberPublicProfileScreen";
import EditProfileScreen from "../screens/profile/member/EditProfileScreen";
import CreatePostScreen from "../screens/home/member/CreatePostScreen";

const Stack = createStackNavigator();

export default function ProfileStackNavigator() {
  return (
    <Stack.Navigator 
      screenOptions={{ headerShown: false }}
      initialRouteName="Profile"
    >
      <Stack.Screen name="Profile" component={MemberProfileScreen} />
      <Stack.Screen name="FollowersList" component={FollowersListScreen} />
      <Stack.Screen name="FollowingList" component={FollowingListScreen} />
      <Stack.Screen name="MemberPublicProfile" component={MemberPublicProfileScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="CreatePost" component={CreatePostScreen} />
    </Stack.Navigator>
  );
}

