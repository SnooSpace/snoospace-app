import React, { useEffect } from "react";
import { View, StyleSheet, Platform, Dimensions } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { getFocusedRouteNameFromRoute } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
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
          let iconName;

          if (route.name === "Home") {
            iconName = focused ? "home" : "home-outline";
          } else if (route.name === "Search") {
            iconName = focused ? "search" : "search-outline";
          } else if (route.name === "Discover") {
            iconName = focused ? "compass" : "compass-outline";
          } else if (route.name === "YourEvents") {
            iconName = focused ? "calendar" : "calendar-outline";
          } else if (route.name === "Profile") {
            iconName = focused ? "person" : "person-outline";
          }

          return (
            <View style={{ alignItems: "center", justifyContent: "center" }}>
              {focused && (
                <View
                  style={{
                    position: "absolute",
                    width: 48,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: "rgba(53, 101, 242, 0.1)", // Light blue pill background
                    zIndex: -1,
                  }}
                />
              )}
              <Ionicons
                name={iconName}
                size={24}
                color={focused ? "#3565F2" : "#9E9E9E"}
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
          backgroundColor: "#FFFFFF", // Solid white
          borderTopLeftRadius: 0, // Removed radius for solid connection
          borderTopRightRadius: 0,
          height: Platform.OS === "ios" ? 85 : 65,
          borderTopWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
          paddingBottom: Platform.OS === "ios" ? 20 : 0,
        },
        // Custom background to add the subtle top divider
        tabBarBackground: () => (
          <View style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
            <View
              style={{
                height: 1,
                backgroundColor: "rgba(0,0,0,0.05)", // Subtle separator
                width: "100%",
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
            if (
              routeName === "ConversationsList" ||
              routeName === "Chat" ||
              routeName === "CreatePost" ||
              routeName === "PromptReplies"
            ) {
              return { display: "none" };
            }
            return {
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: "#FFFFFF",
              height: Platform.OS === "ios" ? 85 : 65,
              borderTopWidth: 0,
              elevation: 0,
              shadowOpacity: 0,
              paddingBottom: Platform.OS === "ios" ? 20 : 0,
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
            if (
              routeName === "ProfileFeed" ||
              routeName === "NetworkingProfile" ||
              routeName === "Chat" ||
              routeName === "EditDiscoverProfile"
            ) {
              return { display: "none" };
            }
            return {
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: "#FFFFFF",
              height: Platform.OS === "ios" ? 85 : 65,
              borderTopWidth: 0,
              elevation: 0,
              shadowOpacity: 0,
              paddingBottom: Platform.OS === "ios" ? 20 : 0,
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
            if (routeName === "CreatePost" || routeName === "EditProfile") {
              return { display: "none" };
            }
            return {
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: "#FFFFFF",
              height: Platform.OS === "ios" ? 85 : 65,
              borderTopWidth: 0,
              elevation: 0,
              shadowOpacity: 0,
              paddingBottom: Platform.OS === "ios" ? 20 : 0,
            };
          })(),
        })}
      />
    </Tab.Navigator>
  );
};

export default BottomTabNavigator;
