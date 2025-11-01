import React, { useState } from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Import screens
import HomeFeedScreen from '../screens/home/member/HomeFeedScreen';
import SearchScreen from '../screens/search/SearchScreen';
import MatchingScreen from '../screens/matching/MatchingScreen';
import CreatePostScreen from '../screens/home/member/CreatePostScreen';
import MemberProfileScreen from '../screens/profile/member/MemberProfileScreen';

const PRIMARY_COLOR = '#6A0DAD';
const TEXT_COLOR = '#1D1D1F';
const LIGHT_TEXT_COLOR = '#8E8E93';

const BottomTabNavigator = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState('Home');

  const tabs = [
    { name: 'Home', icon: 'home', component: HomeFeedScreen },
    { name: 'Search', icon: 'search', component: SearchScreen },
    { name: 'Matching', icon: 'heart', component: MatchingScreen },
    { name: 'Create', icon: 'add-circle', component: CreatePostScreen },
    { name: 'Profile', icon: 'person', component: MemberProfileScreen },
  ];

  const renderScreen = () => {
    const activeTabData = tabs.find(tab => tab.name === activeTab);
    const ScreenComponent = activeTabData?.component || HomeFeedScreen;
    // Pass setActiveTab callback to CreatePostScreen so it can switch to Home after posting
    if (activeTabData?.name === 'Create') {
      return <ScreenComponent navigation={navigation} onPostCreated={() => setActiveTab('Home')} />;
    }
    return <ScreenComponent navigation={navigation} />;
  };

  return (
    <View style={styles.container}>
      <View style={styles.screenContainer}>
        {renderScreen()}
      </View>
      
      <View style={styles.tabBar}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.name}
            style={styles.tab}
            onPress={() => setActiveTab(tab.name)}
          >
            <Ionicons
              name={activeTab === tab.name ? tab.icon : `${tab.icon}-outline`}
              size={24}
              color={activeTab === tab.name ? PRIMARY_COLOR : LIGHT_TEXT_COLOR}
            />
            <Text
              style={[
                styles.tabLabel,
                { color: activeTab === tab.name ? PRIMARY_COLOR : LIGHT_TEXT_COLOR }
              ]}
            >
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
  screenContainer: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
    paddingBottom: 5,
    paddingTop: 5,
    height: 90,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 5,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
});

export default BottomTabNavigator;
