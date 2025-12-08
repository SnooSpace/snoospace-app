import React from 'react';
import { View, StyleSheet, Platform, Dimensions } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

// Import stack navigators
import HomeStackNavigator from './HomeStackNavigator';
import SearchStackNavigator from './SearchStackNavigator';
import ProfileStackNavigator from './ProfileStackNavigator';
// Import screens
import MatchingScreen from '../screens/matching/MatchingScreen';
import YourEventsScreen from '../screens/events/YourEventsScreen';

const Tab = createBottomTabNavigator();

const PRIMARY_COLOR = '#6A0DAD';
const LIGHT_TEXT_COLOR = '#8E8E93';
const { width } = Dimensions.get('window');

const BottomTabNavigator = ({ navigation, route }) => {
  // Handle programmatic tab switching via route params
  React.useEffect(() => {
    const desired = route?.params?.tab;
    if (desired && typeof desired === 'string') {
      navigation.navigate(desired);
    }
  }, [route?.params?.tab, navigation]);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Search') {
            iconName = focused ? 'search' : 'search-outline';
          } else if (route.name === 'Matching') {
            iconName = focused ? 'heart' : 'heart-outline';
          } else if (route.name === 'YourEvents') {
            iconName = focused ? 'calendar' : 'calendar-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          }

          return (
            <View style={{ alignItems: 'center', justifyContent: 'center', top: 10 }}>
              <Ionicons name={iconName} size={24} color={color} />
              {focused && (
                <View style={{
                  width: 4,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: PRIMARY_COLOR,
                  marginTop: 4,
                }} />
              )}
            </View>
          );
        },
        tabBarShowLabel: false,
        tabBarActiveTintColor: PRIMARY_COLOR,
        tabBarInactiveTintColor: LIGHT_TEXT_COLOR,
        tabBarStyle: {
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: 'transparent', // Transparent to let BlurView show
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          height: 85, // Fixed height for docked bar
          borderTopWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
          paddingBottom: 0,
        },
        tabBarBackground: () => (
  <View style={[StyleSheet.absoluteFill, { 
    borderTopLeftRadius: 24, 
    borderTopRightRadius: 24, 
    overflow: 'hidden',
    // Fallback color for Android if blur fails or loads slowly
    backgroundColor: 'rgba(255,255,255,0.6)', 
  }]}>
     <BlurView 
       // Switch to "systemThickMaterialLight" for a denser, heavier glass on iOS
       // Keep "light" if you want it purely white but just blurrier
       tint={Platform.OS === 'ios' ? "systemThickMaterialLight" : "light"} 
       
       // Max out intensity to 100
       intensity={100} 
       
       // CRITICAL for Android: Enables real blur instead of just transparency
       experimentalBlurMethod="dimezisBlurView" 
       
       style={StyleSheet.absoluteFill} 
     />
     
     {/* Subtle Top Border */}
     <View style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 1,
        backgroundColor: 'rgba(0,0,0,0.1)', // Slightly darker border for better contrast
     }} />
  </View>
),
        headerShown: false,
      })}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeStackNavigator}
        options={({ route }) => ({
          tabBarLabel: 'Home',
          tabBarStyle: (() => {
            const routeName = getFocusedRouteNameFromRoute(route) ?? 'HomeFeed';
            if (routeName === 'ConversationsList' || routeName === 'Chat') {
              return { display: 'none' };
            }
            return {
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: 'transparent',
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
        component={SearchStackNavigator}
        options={{ tabBarLabel: 'Search' }}
      />
      <Tab.Screen 
        name="Matching" 
        component={MatchingScreen}
        options={{ tabBarLabel: 'Matching' }}
      />
      <Tab.Screen 
        name="YourEvents" 
        component={YourEventsScreen}
        options={{ tabBarLabel: 'Your Events' }}
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileStackNavigator}
        options={{ tabBarLabel: 'Profile' }}
      />
    </Tab.Navigator>
  );
};

export default BottomTabNavigator;
