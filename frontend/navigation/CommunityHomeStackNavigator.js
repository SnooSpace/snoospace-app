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
import ChallengeVideoRecorderScreen from "../screens/home/ChallengeVideoRecorderScreen";
import CreateOpportunityScreen from "../screens/home/community/CreateOpportunityScreen";
import OpportunityViewScreen from "../screens/home/member/OpportunityViewScreen";
import ApplyToOpportunityScreen from "../screens/home/member/ApplyToOpportunityScreen";
import CreateGroupScreen from "../screens/messages/CreateGroupScreen";
import GroupInfoScreen from "../screens/messages/GroupInfoScreen";
import TabSwipeHandler from "../components/navigation/TabSwipeHandler";
// [VIDEO INSIGHTS - DEFERRED] import VideoInsightsScreen from "../screens/insights/VideoInsightsScreen";

const Stack = createStackNavigator();

const CommunityTabs = ["Home", "Search", "Dashboard", "Requests", "Profile"];

const HomeFeedWithSwipe = (props) => (
  <TabSwipeHandler currentTab="Home" tabs={CommunityTabs}>
    <HomeFeedScreen {...props} role="community" />
  </TabSwipeHandler>
);

export default function CommunityHomeStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false }}
      initialRouteName="HomeFeed"
    >
      <Stack.Screen name="HomeFeed" component={HomeFeedWithSwipe} />
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
        name="CreateGroupChat"
        component={CreateGroupScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="GroupInfo"
        component={GroupInfoScreen}
        options={{ headerShown: false }}
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
      <Stack.Screen
        name="ChallengeVideoRecorder"
        component={ChallengeVideoRecorderScreen}
        options={{
          headerShown: false,
          presentation: "fullScreenModal",
        }}
      />
      <Stack.Screen
        name="CreateOpportunityScreen"
        component={CreateOpportunityScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="OpportunityView"
        component={OpportunityViewScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="ApplyToOpportunity"
        component={ApplyToOpportunityScreen}
        options={{
          headerShown: false,
        }}
      />
      {/* [VIDEO INSIGHTS - DEFERRED] <Stack.Screen name="VideoInsights" component={VideoInsightsScreen} options={{ headerShown: false }} /> */}
    </Stack.Navigator>
  );
}
