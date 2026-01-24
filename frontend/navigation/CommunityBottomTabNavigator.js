import React, { useEffect } from "react";
import { View, StyleSheet, Platform, Dimensions } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { getFocusedRouteNameFromRoute } from "@react-navigation/native";
import { House, Search, LayoutGrid, Inbox, User } from "lucide-react-native";
import { BlurView } from "expo-blur";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";

// Import Community screens
import CommunityHomeStackNavigator from "./CommunityHomeStackNavigator";
import CommunitySearchStackNavigator from "./CommunitySearchStackNavigator";
import CommunityDashboardStackNavigator from "./CommunityDashboardStackNavigator";
import CommunityRequestsScreen from "../screens/home/community/CommunityRequestsScreen";
import CommunityProfileStackNavigator from "./CommunityProfileStackNavigator";
import ProfileTabIcon from "../components/ProfileTabIcon";

const Tab = createBottomTabNavigator();

const PRIMARY_COLOR = "#5f27cd";
const LIGHT_TEXT_COLOR = "#6c757d";

const CommunityBottomTabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let IconComponent;

          if (route.name === "Home") {
            IconComponent = House;
          } else if (route.name === "Search") {
            IconComponent = Search;
          } else if (route.name === "Dashboard") {
            IconComponent = LayoutGrid;
          } else if (route.name === "Requests") {
            IconComponent = Inbox;
          }

          if (route.name === "Profile") {
            return (
              <ProfileTabIcon
                focused={focused}
                color={color}
                userType="community"
              />
            );
          }

          return (
            <View
              style={{
                width: 30,
                height: 30,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <IconComponent
                size={26}
                color={focused ? "#3565F2" : "#999999"}
                fill={focused ? "rgba(53, 101, 242, 0.15)" : "transparent"}
                strokeWidth={focused ? 2.5 : 2.2}
              />
            </View>
          );
        },
        tabBarShowLabel: false,
        tabBarStyle: {
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: Platform.OS === "ios" ? "transparent" : "#FFFFFF",
          borderTopWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
          height: Platform.OS === "ios" ? 95 : 80,
          paddingTop: 12, // Add top padding for breathing room
          paddingBottom: Platform.OS === "ios" ? 20 : 10,
        },
        tabBarBackground: () =>
          Platform.OS === "ios" ? (
            <View style={StyleSheet.absoluteFill}>
              {/* 
                iOS Glass Implementation:
                - tint="systemChromeMaterialLight": Matches native iOS navigation bars (the "standard" blur).
                - intensity={100}: Ensures complete smoothing of content behind.
              */}
              <BlurView
                tint="systemChromeMaterialLight"
                intensity={100}
                style={StyleSheet.absoluteFill}
              />
              {/* Subtle Top Divider: 0.5px hairline for crisp separation */}
              <View
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  height: StyleSheet.hairlineWidth, // ~0.33px on retina, 0.5px on standard
                  backgroundColor: "rgba(0, 0, 0, 0.2)", // Standard iOS separator opacity
                }}
              />
            </View>
          ) : (
            // Android Fallback: Solid white with subtle divider
            <View style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
              <View
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 1,
                  backgroundColor: "rgba(0, 0, 0, 0.05)",
                }}
              />
            </View>
          ),
        headerShown: false,
      })}
    >
      <Tab.Screen
        name="Home"
        component={CommunityHomeStackNavigator}
        options={({ route }) => ({
          tabBarLabel: "Home",
          tabBarStyle: (() => {
            const routeName = getFocusedRouteNameFromRoute(route) ?? "HomeFeed";
            // Hide for Chat functionality
            if (
              routeName === "ConversationsList" ||
              routeName === "Chat" ||
              routeName === "Notifications" ||
              routeName === "PromptReplies"
            ) {
              return { display: "none" };
            }
            return {
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor:
                Platform.OS === "ios" ? "transparent" : "#FFFFFF",
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
        options={{ tabBarLabel: "Dashboard" }}
      />
      <Tab.Screen
        name="Requests"
        component={CommunityRequestsScreen}
        options={{ tabBarLabel: "Requests" }}
      />
      <Tab.Screen
        name="Profile"
        component={CommunityProfileStackNavigator}
        options={{ tabBarLabel: "Profile" }}
      />
    </Tab.Navigator>
  );
};

export default CommunityBottomTabNavigator;
