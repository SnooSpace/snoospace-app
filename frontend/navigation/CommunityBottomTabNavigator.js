import React from "react";
import { View, StyleSheet, Platform, Dimensions } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { getFocusedRouteNameFromRoute } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";

// Import Community screens
import CommunityHomeStackNavigator from "./CommunityHomeStackNavigator";
import CommunitySearchStackNavigator from "./CommunitySearchStackNavigator";
import CommunityDashboardScreen from "../screens/home/community/CommunityDashboardScreen";
import CommunityRequestsScreen from "../screens/home/community/CommunityRequestsScreen";
import CommunityProfileStackNavigator from "./CommunityProfileStackNavigator";

const Tab = createBottomTabNavigator();

const PRIMARY_COLOR = "#5f27cd";
const LIGHT_TEXT_COLOR = "#6c757d";

const CommunityBottomTabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === "Home") {
            iconName = focused ? "home" : "home-outline";
          } else if (route.name === "Search") {
            iconName = focused ? "search" : "search-outline";
          } else if (route.name === "Dashboard") {
            iconName = focused ? "grid" : "grid-outline";
          } else if (route.name === "Requests") {
            iconName = focused ? "mail" : "mail-outline";
          } else if (route.name === "Profile") {
            iconName = focused ? "person" : "person-outline";
          }

          return (
            <View
              style={{
                alignItems: "center",
                justifyContent: "center",
                top: 10,
                ...(focused && {
                  shadowColor: "#00C6FF",
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.6,
                  shadowRadius: 8,
                  elevation: 10,
                }),
              }}
            >
              <Ionicons name={iconName} size={24} color={color} />
            </View>
          );
        },
        tabBarShowLabel: false,
        tabBarActiveTintColor: "#00C6FF", // Cyan color
        tabBarInactiveTintColor: LIGHT_TEXT_COLOR,
        tabBarStyle: {
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: "transparent", // Transparent to let BlurView show
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          height: 85, // Fixed height for docked bar
          borderTopWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
          paddingBottom: 0,
        },
        tabBarBackground: () => (
          <View
            style={[
              StyleSheet.absoluteFill,
              {
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                overflow: "hidden",
                // Fallback color for Android if blur fails or loads slowly
                backgroundColor: "rgba(255,255,255,0.6)",
              },
            ]}
          >
            <BlurView
              // Switch to "systemThickMaterialLight" for a denser, heavier glass on iOS
              // Keep "light" if you want it purely white but just blurrier
              tint={
                Platform.OS === "ios" ? "systemThickMaterialLight" : "light"
              }
              // Max out intensity to 100
              intensity={100}
              // CRITICAL for Android: Enables real blur instead of just transparency
              experimentalBlurMethod="dimezisBlurView"
              style={StyleSheet.absoluteFill}
            />

            {/* Subtle Top Border */}
            <View
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: 1,
                backgroundColor: "rgba(0,0,0,0.1)", // Slightly darker border for better contrast
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
              routeName === "Notifications"
            ) {
              return { display: "none" };
            }
            return {
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: "transparent",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              height: 85,
              borderTopWidth: 0,
              elevation: 0,
              shadowOpacity: 0,
              paddingBottom: 0,
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
        component={CommunityDashboardScreen}
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
