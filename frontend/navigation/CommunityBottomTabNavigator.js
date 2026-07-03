import React from "react";
import { Platform } from "react-native";
import { Pressable } from "react-native-gesture-handler";
import { getFocusedRouteNameFromRoute, useNavigation, CommonActions } from "@react-navigation/native";

// Import Community screens
import CommunityHomeStackNavigator from "./CommunityHomeStackNavigator";
import CommunitySearchStackNavigator from "./CommunitySearchStackNavigator";
import CommunityDashboardStackNavigator from "./CommunityDashboardStackNavigator";
import CommunityRequestsScreen from "../screens/home/community/CommunityRequestsScreen";
import CommunityProfileStackNavigator from "./CommunityProfileStackNavigator";

import { createSwipeablePagerNavigator } from "./SwipeablePagerNavigator";
import { getActiveAccount, getAllAccounts, switchAccount } from "../api/auth";
import EventBus from "../utils/EventBus";
import * as Haptics from "expo-haptics";

const Tab = createSwipeablePagerNavigator();

const ProfileTabButton = (props) => {
  const { onPress, ...rest } = props;
  const lastTapRef = React.useRef(0);
  const navigation = useNavigation();

  const handlePress = async (e) => {
    const now = Date.now();
    const DOUBLE_PRESS_DELAY = 300;

    if (now - lastTapRef.current < DOUBLE_PRESS_DELAY) {
      lastTapRef.current = 0;
      // Provide instant feedback
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      EventBus.emit("account-switch-start");

      try {
        const allAccounts = await getAllAccounts();
        if (allAccounts && allAccounts.length > 1) {
          const activeAccount = await getActiveAccount();
          if (activeAccount) {
            // CRITICAL: Use composite key (type_id) so member_28 and community_28
            // are distinguished correctly and we find the exact active account.
            const activeCompositeId = `${activeAccount.type}_${activeAccount.id}`;
            const activeIndex = allAccounts.findIndex(
              (a) => `${a.type}_${a.id}` === activeCompositeId,
            );
            if (activeIndex !== -1) {
              const nextIndex = (activeIndex + 1) % allAccounts.length;
              const nextAccount = allAccounts[nextIndex];
              // Pass composite key so accountManager picks the exact account type
              const nextCompositeId = `${nextAccount.type}_${nextAccount.id}`;
              await switchAccount(nextCompositeId);
              EventBus.emit("account-switch-done", {
                name: nextAccount.name || nextAccount.username || "",
                username: nextAccount.username || "",
                photoUrl: nextAccount.profilePicture || null,
              });

              // 350ms delay: gives Reanimated spring/scroll animations time to
              // fully settle before React tears down the current component tree.
              // 50ms was too short and caused "Expected static flag was missing".
              setTimeout(() => {
                const routeMap = {
                  member: "MemberHome",
                  community: "CommunityHome",
                  sponsor: "SponsorHome",
                  venue: "VenueHome",
                };
                const routeName = routeMap[nextAccount.type] || "Landing";

                // Guard: getParent() can return undefined (not null) after
                // a background→foreground transition.
                let rootNav = navigation;
                let parent = rootNav.getParent ? rootNav.getParent() : null;
                while (parent) {
                  rootNav = parent;
                  parent = rootNav.getParent ? rootNav.getParent() : null;
                }

                if (!rootNav || !rootNav.dispatch) {
                  console.warn('[CommunityBottomTabNavigator] Root navigator unavailable after account switch');
                  return;
                }

                rootNav.dispatch(
                  CommonActions.reset({
                    index: 0,
                    routes: [{ name: routeName }],
                  })
                );
              }, 350);
            }
          }
        }
      } catch (err) {
        console.error("Error cycling accounts:", err);
      } finally {
        EventBus.emit("account-switch-end");
      }
    } else {
      lastTapRef.current = now;
      if (onPress) {
        onPress(e);
      }
    }
  };

  return <Pressable onPress={handlePress} {...rest} />;
};

const getTabBarStyle = (route, customHiddenRoutes = []) => {
  const routeName = getFocusedRouteNameFromRoute(route) ?? "";
  const baseHiddenRoutes = [
    "FollowersList",
    "FollowingList",
    "CommunityFollowersList",
    "CommunityFollowingList",
    "MemberPublicProfile",
    "CommunityPublicProfile",
    "OpportunityView",
    "ApplyToOpportunity",
    "CreateOpportunity",
    "CreateOpportunityScreen",
    "CommunityEventsList",
    "EventAttendees",
    "ShareTicket",
    "Settings",
    "SavedPostsScreen",
    "LinkedAccounts",
    "BlockedAccounts",
    "MyDataScreen",
    "EventDetails",
    "DeleteAccount",
    "CommunityCreatePost",
    "CircleList",
    "CircleRequests",
  ];
  const allHiddenRoutes = [...baseHiddenRoutes, ...customHiddenRoutes];
  
  if (routeName && allHiddenRoutes.includes(routeName)) {
    return { display: "none" };
  }
  
  return {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Platform.OS === "ios" ? "transparent" : "#FFFFFF",
    borderTopWidth: 0,
    elevation: 0,
    shadowOpacity: 0,
    height: Platform.OS === "ios" ? 95 : 80,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 20 : 10,
  };
};

const CommunityBottomTabNavigator = ({ navigation, route }) => {
  // Handle programmatic tab switching via route params
  React.useEffect(() => {
    const desired = route?.params?.tab;
    if (desired && typeof desired === "string") {
      navigation.navigate(desired);
    }
  }, [route?.params?.tab, navigation]);

  return (
    <Tab.Navigator role="community">
      <Tab.Screen
        name="Home"
        component={CommunityHomeStackNavigator}
        options={({ route }) => ({
          tabBarLabel: "Home",
          tabBarStyle: getTabBarStyle(route, [
            "ConversationsList",
            "Chat",
            "Notifications",
            "PromptReplies",
            "CreateGroupChat",
            "GroupInfo",
            "PromptSubmissions",
            "ChallengeSubmissions",
            "ChallengeSubmit",
            "QnAQuestions",
            "ChallengeVideoRecorder",
          ]),
        })}
      />
      <Tab.Screen
        name="Search"
        component={CommunitySearchStackNavigator}
        options={({ route }) => ({
          tabBarLabel: "Search",
          tabBarStyle: getTabBarStyle(route),
        })}
      />
      <Tab.Screen
        name="Dashboard"
        component={CommunityDashboardStackNavigator}
        options={({ route }) => ({
          tabBarLabel: "Dashboard",
          tabBarStyle: getTabBarStyle(route, ["AudienceIntelligence"]),
        })}
      />
      <Tab.Screen
        name="Requests"
        component={CommunityRequestsScreen}
        options={{ tabBarLabel: "Requests" }}
      />
      <Tab.Screen
        name="Profile"
        component={CommunityProfileStackNavigator}
        options={({ route }) => ({
          tabBarLabel: "Profile",
          tabBarButton: (props) => <ProfileTabButton {...props} />,
          tabBarStyle: getTabBarStyle(route, [
            "EditProfile",
            "EditCommunityProfile",
            "CommunityHosts",
            "CommunityMonetization"
          ]),
        })}
      />
    </Tab.Navigator>
  );
};

export default CommunityBottomTabNavigator;
