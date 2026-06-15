import React from "react";
import { Platform } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import HomeFeedScreen from "../components/HomeFeedScreen";
import NotificationsScreen from "../screens/notifications/NotificationsScreen";
import ConversationsListScreen from "../screens/messages/ConversationsListScreen";
import ChatScreen from "../screens/messages/ChatScreen";
import CommunityPublicProfileScreen from "../screens/profile/community/CommunityPublicProfileScreen";
import MemberPublicProfileScreen from "../screens/profile/member/MemberPublicProfileScreen";
import SponsorProfileScreen from "../screens/profile/sponsor/SponsorProfileScreen";
import VenueProfileScreen from "../screens/profile/venue/VenueProfileScreen";
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
import OpportunityViewScreen from "../screens/home/member/OpportunityViewScreen";
import ApplyToOpportunityScreen from "../screens/home/member/ApplyToOpportunityScreen";
import CreateGroupScreen from "../screens/messages/CreateGroupScreen";
import GroupInfoScreen from "../screens/messages/GroupInfoScreen";
import CircleListScreen from "../screens/profile/member/CircleListScreen";
import CircleRequestsScreen from "../screens/profile/member/CircleRequestsScreen";
// [VIDEO INSIGHTS - DEFERRED] import VideoInsightsScreen from "../screens/insights/VideoInsightsScreen";

const MemberHomeFeed = (props) => (
  <HomeFeedScreen {...props} role="member" />
);

const Stack = createNativeStackNavigator();

export default function HomeStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        // Using createNativeStackNavigator (same as DiscoverStackNavigator) so that
        // stack transitions run natively and are fully decoupled from the JS layout
        // tree. This prevents SwipeablePagerNavigator's Animated.ScrollView from
        // receiving layout events during HomeStack push/pop transitions, which was
        // the root cause of the pagingEnabled snap / horizontal drift on HomeFeedScreen.
        // The old createStackNavigator + animationEnabled:false caused an immediate
        // synchronous layout commit that triggered the paging snap.
        animation: Platform.OS === "ios" ? "ios" : "default",
        gestureEnabled: true,
        ...(Platform.OS === "ios" ? { animationDuration: 350 } : {}),
      }}
      initialRouteName="HomeFeed"
    >
      <Stack.Screen name="HomeFeed" component={MemberHomeFeed} />
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
        options={{ headerShown: false }}
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
      <Stack.Screen name="OpportunityView" component={OpportunityViewScreen} />
      <Stack.Screen
        name="ApplyToOpportunity"
        component={ApplyToOpportunityScreen}
      />
      <Stack.Screen name="CircleList" component={CircleListScreen} />
      <Stack.Screen name="CircleRequests" component={CircleRequestsScreen} />
      {/* [VIDEO INSIGHTS - DEFERRED] <Stack.Screen name="VideoInsights" component={VideoInsightsScreen} options={{ headerShown: false }} /> */}
    </Stack.Navigator>
  );
}
