import React from "react";
import { Platform } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
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
import ApplicantsListScreen from "../screens/home/community/ApplicantsListScreen";
import ApplicantDetailScreen from "../screens/home/community/ApplicantDetailScreen";
import CreateGroupScreen from "../screens/messages/CreateGroupScreen";
import GroupInfoScreen from "../screens/messages/GroupInfoScreen";
// [VIDEO INSIGHTS - DEFERRED] import VideoInsightsScreen from "../screens/insights/VideoInsightsScreen";

const CommunityHomeFeed = (props) => (
  <HomeFeedScreen {...props} role="community" />
);

const Stack = createNativeStackNavigator();

export default function CommunityHomeStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        // Native stack keeps transitions outside the JS layout tree so
        // SwipeablePagerNavigator never receives layout events during push/pop.
        animation: Platform.OS === "ios" ? "ios" : "default",
        gestureEnabled: true,
        ...(Platform.OS === "ios" ? { animationDuration: 350 } : {}),
      }}
      initialRouteName="HomeFeed"
    >
      <Stack.Screen name="HomeFeed" component={CommunityHomeFeed} />
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
          animation: "slide_from_bottom",
        }}
      />
      <Stack.Screen
        name="ChallengeVideoRecorder"
        component={ChallengeVideoRecorderScreen}
        options={{
          headerShown: false,
          presentation: "fullScreenModal",
          animation: "slide_from_bottom",
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
      <Stack.Screen
        name="ApplicantsList"
        component={ApplicantsListScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="ApplicantDetail"
        component={ApplicantDetailScreen}
        options={{
          headerShown: false,
        }}
      />
      {/* [VIDEO INSIGHTS - DEFERRED] <Stack.Screen name="VideoInsights" component={VideoInsightsScreen} options={{ headerShown: false }} /> */}
    </Stack.Navigator>
  );
}
