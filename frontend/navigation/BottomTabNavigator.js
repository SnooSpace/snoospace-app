import React, { useEffect } from "react";
import { View, StyleSheet, Platform, Dimensions } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { getFocusedRouteNameFromRoute } from "@react-navigation/native";
import { House, Search, Compass, Calendar, User } from "lucide-react-native";
import { BlurView } from "expo-blur";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";

// Import stack navigators
import HomeStackNavigator from "./HomeStackNavigator";
import SearchStackNavigator from "./SearchStackNavigator";
import ProfileStackNavigator from "./ProfileStackNavigator";
import DiscoverStackNavigator from "./DiscoverStackNavigator";
import EventsStackNavigator from "./EventsStackNavigator";
import ProfileTabIcon from "../components/ProfileTabIcon";

const Tab = createBottomTabNavigator();

import { COLORS } from "../constants/theme"; // Use COLORS theme

// Local constants removed in favor of theme constants
const { width } = Dimensions.get("window");

const TabIcon = ({ name, focused, color }) => {
  const scale = useSharedValue(focused ? 1.2 : 1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(scale.value, { damping: 10 }) }],
  }));

  useEffect(() => {
    scale.value = focused ? 1.2 : 1;
  }, [focused]);

  return (
    <Animated.View
      style={[
        { alignItems: "center", justifyContent: "center", top: 10 },
        animatedStyle,
      ]}
    >
      <Ionicons name={name} size={24} color={color} />
    </Animated.View>
  );
};

const BottomTabNavigator = ({ navigation, route }) => {
  // Handle programmatic tab switching via route params
  React.useEffect(() => {
    const desired = route?.params?.tab;
    if (desired && typeof desired === "string") {
      navigation.navigate(desired);
    }
  }, [route?.params?.tab, navigation]);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let IconComponent;

          if (route.name === "Home") {
            IconComponent = House;
          } else if (route.name === "Search") {
            IconComponent = Search;
          } else if (route.name === "Discover") {
            IconComponent = Compass;
          } else if (route.name === "YourEvents") {
            IconComponent = Calendar;
          }

          if (route.name === "Profile") {
            return (
              <ProfileTabIcon
                focused={focused}
                color={color}
                userType="member"
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
        component={HomeStackNavigator}
        options={({ route }) => ({
          tabBarLabel: "Home",
          tabBarStyle: (() => {
            const routeName = getFocusedRouteNameFromRoute(route) ?? "HomeFeed";
            const hiddenRoutes = [
              "ConversationsList",
              "Chat",
              "CreatePost",
              "PromptReplies",
            ];
            if (hiddenRoutes.includes(routeName)) {
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
        component={SearchStackNavigator}
        options={{ tabBarLabel: "Search" }}
      />
      <Tab.Screen
        name="Discover"
        component={DiscoverStackNavigator}
        options={({ route }) => ({
          tabBarLabel: "Discover",
          tabBarStyle: (() => {
            const routeName =
              getFocusedRouteNameFromRoute(route) ?? "DiscoverHome";
            const hiddenRoutes = [
              "ProfileFeed",
              "NetworkingProfile",
              "Chat",
              "EditDiscoverProfile",
              "OpenerSelection",
            ];
            if (hiddenRoutes.includes(routeName)) {
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
        name="YourEvents"
        component={EventsStackNavigator}
        options={{ tabBarLabel: "Your Events" }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileStackNavigator}
        options={({ route }) => ({
          tabBarLabel: "Profile",
          tabBarStyle: (() => {
            const routeName = getFocusedRouteNameFromRoute(route) ?? "Profile";
            const hiddenRoutes = ["CreatePost", "EditProfile"];
            if (hiddenRoutes.includes(routeName)) {
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
    </Tab.Navigator>
  );
};

export default BottomTabNavigator;
