import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

// Import stack navigators
import HomeStackNavigator from './HomeStackNavigator';
import SearchStackNavigator from './SearchStackNavigator';
import ProfileStackNavigator from './ProfileStackNavigator';
// Import screens
import MatchingScreen from '../screens/matching/MatchingScreen';
import CreatePostScreen from '../screens/home/member/CreatePostScreen';

const Tab = createBottomTabNavigator();

const PRIMARY_COLOR = '#6A0DAD';
const LIGHT_TEXT_COLOR = '#8E8E93';

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
          } else if (route.name === 'Create') {
            iconName = focused ? 'add-circle' : 'add-circle-outline';
          } else           if (route.name === 'Profile') {
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
        component={HomeStackNavigator}
        options={{ tabBarLabel: 'Home' }}
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
        name="Create" 
        options={{ tabBarLabel: 'Create' }}
      >
        {(props) => (
          <CreatePostScreen 
            {...props} 
            onPostCreated={() => navigation.navigate('Home')} 
          />
        )}
      </Tab.Screen>
      <Tab.Screen 
        name="Profile" 
        component={ProfileStackNavigator}
        options={{ tabBarLabel: 'Profile' }}
      />
    </Tab.Navigator>
  );
};

export default BottomTabNavigator;
