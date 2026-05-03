import React from "react";
import { Platform } from "react-native";
import { getFocusedRouteNameFromRoute } from "@react-navigation/native";

// Import Community screens
import CommunityHomeStackNavigator from "./CommunityHomeStackNavigator";
import CommunitySearchStackNavigator from "./CommunitySearchStackNavigator";
import CommunityDashboardStackNavigator from "./CommunityDashboardStackNavigator";
import CommunityRequestsScreen from "../screens/home/community/CommunityRequestsScreen";
import CommunityProfileStackNavigator from "./CommunityProfileStackNavigator";

import { createSwipeablePagerNavigator } from "./SwipeablePagerNavigator";
import { getActiveAccount, getAllAccounts, switchAccount } from "../api/auth";
import { Pressable } from "react-native";

const Tab = createSwipeablePagerNavigator();

const ProfileTabButton = (props) => {
  const { onPress, ...rest } = props;
  const lastTapRef = React.useRef(0);

  const handlePress = async (e) => {
    const now = Date.now();
    const DOUBLE_PRESS_DELAY = 300;

    if (now - lastTapRef.current < DOUBLE_PRESS_DELAY) {
      lastTapRef.current = 0;
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
            }
          }
        }
      } catch (err) {
        console.error("Error cycling accounts:", err);
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
          tabBarStyle: (() => {
            const routeName = getFocusedRouteNameFromRoute(route) ?? "HomeFeed";
            const hiddenRoutes = [
              "ConversationsList",
              "Chat",
              "Notifications",
              "PromptReplies",
              "CreateGroupChat",
              "GroupInfo",
            ];
            if (hiddenRoutes.includes(routeName)) {
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
          })(),
        })}
      />
      <Tab.Screen
        name="Search"
        component={CommunitySearchStackNavigator}
        options={{ tabBarLabel: "Search" }}
      />
      <Tab.Screen
        name="Dashboard"
        component={CommunityDashboardStackNavigator}
        options={({ route }) => ({
          tabBarLabel: "Dashboard",
          tabBarStyle: (() => {
            const routeName = getFocusedRouteNameFromRoute(route) ?? "DashboardHome";
            if (routeName === "AudienceIntelligence") {
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
          })(),
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
          tabBarStyle: (() => {
            const routeName = getFocusedRouteNameFromRoute(route) ?? "Profile";
            const hiddenRoutes = ["EditProfile"];
            if (hiddenRoutes.includes(routeName)) {
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
          })(),
        })}
      />
    </Tab.Navigator>
  );
};

export default CommunityBottomTabNavigator;
