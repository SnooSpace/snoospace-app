import React from "react";
import { Platform, Pressable } from "react-native";
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
            const activeIndex = allAccounts.findIndex((a) => a.id === activeAccount.id);
            if (activeIndex !== -1) {
              const nextIndex = (activeIndex + 1) % allAccounts.length;
              const nextAccount = allAccounts[nextIndex];
              await switchAccount(nextAccount.id);
              EventBus.emit("account-switch-done", {
                name: nextAccount.name || nextAccount.username || "",
                username: nextAccount.username || "",
                photoUrl: nextAccount.profilePicture || null,
              });

              // Small delay to ensure state propagates, then navigate to correct home
              setTimeout(() => {
                const routeMap = {
                  member: "MemberHome",
                  community: "CommunityHome",
                  sponsor: "SponsorHome",
                  venue: "VenueHome",
                };
                const routeName = routeMap[nextAccount.type] || "Landing";
                
                let rootNav = navigation;
                while (rootNav.getParent && rootNav.getParent()) {
                  rootNav = rootNav.getParent();
                }
                
                rootNav.dispatch(
                  CommonActions.reset({
                    index: 0,
                    routes: [{ name: routeName }],
                  })
                );
              }, 50);
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
            "CommunityHosts"
          ]),
        })}
      />
    </Tab.Navigator>
  );
};

export default CommunityBottomTabNavigator;
