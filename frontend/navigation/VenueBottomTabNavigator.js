import React, { useState } from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Import Venue screens
import VenueHomeFeedScreen from '../screens/home/venue/VenueHomeFeedScreen';
import VenueBrowseScreen from '../screens/home/venue/VenueBrowseScreen';
import VenueBookingsScreen from '../screens/home/venue/VenueBookingsScreen';
import VenueCreatePostScreen from '../screens/home/venue/VenueCreatePostScreen';
import VenueProfileScreen from '../screens/profile/venue/VenueProfileScreen';

const PRIMARY_COLOR = '#6A0DAD';
const TEXT_COLOR = '#1D1D1F';
const LIGHT_TEXT_COLOR = '#8E8E93';

const VenueBottomTabNavigator = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState('Home');

  const tabs = [
    {
      name: 'Home',
      icon: 'home-outline',
      activeIcon: 'home',
      component: VenueHomeFeedScreen
    },
    {
      name: 'Browse',
      icon: 'search-outline',
      activeIcon: 'search',
      component: VenueBrowseScreen
    },
    {
      name: 'Bookings',
      icon: 'calendar-outline',
      activeIcon: 'calendar',
      component: VenueBookingsScreen
    },
    {
      name: 'Create',
      icon: 'add-circle-outline',
      activeIcon: 'add-circle',
      component: VenueCreatePostScreen
    },
    {
      name: 'Profile',
      icon: 'person-outline',
      activeIcon: 'person',
      component: VenueProfileScreen
    }
  ];

  const renderScreen = () => {
    const activeTabData = tabs.find(tab => tab.name === activeTab);
    const ScreenComponent = activeTabData?.component || VenueHomeFeedScreen;
    return <ScreenComponent navigation={navigation} />;
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {renderScreen()}
      </View>
      
      <View style={styles.tabBar}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.name}
            style={[
              styles.tab,
              activeTab === tab.name && styles.activeTab
            ]}
            onPress={() => setActiveTab(tab.name)}
          >
            <Ionicons
              name={activeTab === tab.name ? tab.activeIcon : tab.icon}
              size={24}
              color={activeTab === tab.name ? PRIMARY_COLOR : LIGHT_TEXT_COLOR}
            />
            <Text style={[
              styles.tabLabel,
              activeTab === tab.name && styles.activeTabLabel
            ]}>
              {tab.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
    paddingBottom: 8,
    paddingTop: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  activeTab: {
    // Active tab styling
  },
  tabLabel: {
    fontSize: 10,
    color: LIGHT_TEXT_COLOR,
    marginTop: 4,
    fontWeight: '500',
  },
  activeTabLabel: {
    color: PRIMARY_COLOR,
    fontWeight: '600',
  },
});

export default VenueBottomTabNavigator;
