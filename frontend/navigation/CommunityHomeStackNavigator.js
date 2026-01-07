import React from "react";
import { createStackNavigator } from "@react-navigation/stack";
import HomeFeedScreen from "../components/HomeFeedScreen";
import NotificationsScreen from "../screens/notifications/NotificationsScreen";
import ConversationsListScreen from "../screens/messages/ConversationsListScreen";
import ChatScreen from "../screens/messages/ChatScreen";
import MemberPublicProfileScreen from "../screens/profile/member/MemberPublicProfileScreen";
import FollowersListScreen from "../screens/profile/member/FollowersListScreen";
import FollowingListScreen from "../screens/profile/member/FollowingListScreen";
import CommunityFollowersListScreen from "../screens/profile/community/CommunityFollowersListScreen";
import CommunityFollowingListScreen from "../screens/profile/community/CommunityFollowingListScreen";
import PromptSubmissionsScreen from "../screens/home/PromptSubmissionsScreen";
import PromptRepliesScreen from "../screens/home/PromptRepliesScreen";
import QnAQuestionsScreen from "../screens/home/QnAQuestionsScreen";
import ChallengeSubmissionsScreen from "../screens/home/ChallengeSubmissionsScreen";
import ChallengeSubmitScreen from "../screens/home/ChallengeSubmitScreen";

const Stack = createStackNavigator();

export default function CommunityHomeStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false }}
      initialRouteName="HomeFeed"
    >
      <Stack.Screen name="HomeFeed">
        {(props) => <HomeFeedScreen {...props} role="community" />}
      </Stack.Screen>
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
      <Stack.Screen name="FollowersList" component={FollowersListScreen} />
      <Stack.Screen name="FollowingList" component={FollowingListScreen} />
      <Stack.Screen
        name="CommunityFollowersList"
        component={CommunityFollowersListScreen}
      />
      <Stack.Screen
        name="CommunityFollowingList"
        component={CommunityFollowingListScreen}
      />
      <Stack.Screen
        name="PromptSubmissions"
        component={PromptSubmissionsScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="PromptReplies"
        component={PromptRepliesScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="QnAQuestions"
        component={QnAQuestionsScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="ChallengeSubmissions"
        component={ChallengeSubmissionsScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="ChallengeSubmit"
        component={ChallengeSubmitScreen}
        options={{
          headerShown: false,
          presentation: "modal",
        }}
      />
    </Stack.Navigator>
  );
}
