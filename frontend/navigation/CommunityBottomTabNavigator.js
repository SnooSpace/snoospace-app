import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

// Import Community screens
import CommunityHomeFeedScreen from '../screens/home/community/CommunityHomeFeedScreen';
import CommunitySearchScreen from '../screens/home/community/CommunitySearchScreen';
import CommunityDashboardScreen from '../screens/home/community/CommunityDashboardScreen';
import CommunityRequestsScreen from '../screens/home/community/CommunityRequestsScreen';
import CommunityProfileStackNavigator from './CommunityProfileStackNavigator';

const Tab = createBottomTabNavigator();

const PRIMARY_COLOR = '#5f27cd';
const LIGHT_TEXT_COLOR = '#6c757d';

const CommunityBottomTabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Search') {
            iconName = focused ? 'search' : 'search-outline';
          } else if (route.name === 'Dashboard') {
            iconName = focused ? 'grid' : 'grid-outline';
          } else if (route.name === 'Requests') {
            iconName = focused ? 'mail' : 'mail-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: PRIMARY_COLOR,
        tabBarInactiveTintColor: LIGHT_TEXT_COLOR,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
          marginTop: 2,
        },
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#E5E5EA',
          paddingBottom: 5,
          paddingTop: 5,
          height: 90,
        },
        headerShown: false,
      })}
    >
      <Tab.Screen 
        name="Home" 
        component={CommunityHomeFeedScreen}
        options={{ tabBarLabel: 'Home' }}
      />
      <Tab.Screen 
        name="Search" 
        component={CommunitySearchScreen}
        options={{ tabBarLabel: 'Search' }}
      />
      <Tab.Screen 
        name="Dashboard" 
        component={CommunityDashboardScreen}
        options={{ tabBarLabel: 'Dashboard' }}
      />
      <Tab.Screen 
        name="Requests" 
        component={CommunityRequestsScreen}
        options={{ tabBarLabel: 'Requests' }}
      />
      <Tab.Screen 
        name="Profile" 
        component={CommunityProfileStackNavigator}
        options={{ tabBarLabel: 'Profile' }}
      />
    </Tab.Navigator>
  );
};

export default CommunityBottomTabNavigator;
