import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { mockData } from '../../../data/mockData';
import CreateEventModal from '../../../components/modals/CreateEventModal';

const PRIMARY_COLOR = '#6A0DAD';
const TEXT_COLOR = '#1D1D1F';
const LIGHT_TEXT_COLOR = '#8E8E93';

export default function CommunityDashboardScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [showCreateEventModal, setShowCreateEventModal] = useState(false);
  const [activeTab, setActiveTab] = useState('upcoming'); // 'upcoming' or 'previous'
  const [metrics, setMetrics] = useState({
    totalMembers: 1250,
    eventsHosted: 15,
    collaborations: 3
  });
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [previousEvents, setPreviousEvents] = useState([]);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      
      // Fetch real events from API
      const { getCommunityEvents } = await import('../../../api/events');
      const eventsData = await getCommunityEvents();
      
      if (eventsData?.events) {
        // Separate upcoming and past events
        const upcoming = eventsData.events.filter(event => !event.is_past);
        const past = eventsData.events.filter(event => event.is_past);
        
        setUpcomingEvents(upcoming);
        setPreviousEvents(past);
        
        // Update metrics
        setMetrics(prev => ({
          ...prev,
          eventsHosted: eventsData.events.length
        }));
      }
    } catch (error) {
      console.error('Error loading dashboard:', error);
      // Fallback to empty arrays on error
      setUpcomingEvents([]);
      setPreviousEvents([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEvent = () => {
    setShowCreateEventModal(true);
  };

  const handleEventCreated = (event) => {
    console.log('Event created:', event);
    // Refresh dashboard metrics and events list
    loadDashboard();
  };

  const handleCreatePost = () => {
    // Navigate to post creation screen with role param
    navigation.navigate('CommunityCreatePost', { role: 'community' });
  };

  const handleViewEvent = (event) => {
    console.log('View event:', event.id);
  };

  const handleViewAllEvents = () => {
    console.log('View all events');
  };

  const renderEventCard = ({ item }) => (
    <TouchableOpacity
      style={styles.eventCard}
      onPress={() => handleViewEvent(item)}
    >
      <Image
        source={{ uri: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=200' }}
        style={styles.eventImage}
      />
      <View style={styles.eventInfo}>
        <Text style={styles.eventTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.eventDate}>
          {new Date(item.event_date).toLocaleDateString()}
        </Text>
        <View style={styles.eventStats}>
          <Ionicons name="people" size={12} color={LIGHT_TEXT_COLOR} />
          <Text style={styles.eventAttendees}>
            {item.current_attendees} attendees
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={PRIMARY_COLOR} />
          <Text style={styles.loadingText}>Loading dashboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Dashboard</Text>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleCreateEvent}
            >
              <View style={styles.actionIconContainer}>
                <Ionicons name="calendar" size={32} color="#FFFFFF" />
              </View>
              <Text style={styles.actionButtonText}>Create Event</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleCreatePost}
            >
              <View style={styles.actionIconContainer}>
                <Ionicons name="add" size={32} color="#FFFFFF" />
              </View>
              <Text style={styles.actionButtonText}>Create Post</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Community Metrics */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Community Metrics</Text>
          <View style={styles.metricsContainer}>
            <View style={styles.metricCard}>
              <Ionicons name="people" size={32} color={PRIMARY_COLOR} />
              <Text style={styles.metricNumber}>{metrics.totalMembers}</Text>
              <Text style={styles.metricLabel}>Total Members</Text>
            </View>
            
            <View style={styles.metricCard}>
              <Ionicons name="calendar" size={32} color={PRIMARY_COLOR} />
              <Text style={styles.metricNumber}>{metrics.eventsHosted}</Text>
              <Text style={styles.metricLabel}>Events Hosted</Text>
            </View>
            
            <View style={styles.metricCard}>
              <Ionicons name="handshake" size={32} color={PRIMARY_COLOR} />
              <Text style={styles.metricNumber}>{metrics.collaborations}</Text>
              <Text style={styles.metricLabel}>Collaborations</Text>
            </View>
          </View>
        </View>

        {/* Events Section with Tabs */}
        <View style={styles.section}>
          <View style={styles.tabsContainer}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'upcoming' && styles.activeTab]}
              onPress={() => setActiveTab('upcoming')}
            >
              <Text style={[styles.tabText, activeTab === 'upcoming' && styles.activeTabText]}>
                Upcoming Events
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'previous' && styles.activeTab]}
              onPress={() => setActiveTab('previous')}
            >
              <Text style={[styles.tabText, activeTab === 'previous' && styles.activeTabText]}>
                Previous Events
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.eventsHeader}>
            <TouchableOpacity onPress={handleViewAllEvents}>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={activeTab === 'upcoming' ? upcomingEvents : previousEvents}
            renderItem={renderEventCard}
            keyExtractor={(item) => item.id.toString()}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.eventsList}
            ListEmptyComponent={() => (
              <View style={styles.emptyContainer}>
                <Ionicons name="calendar-outline" size={40} color={LIGHT_TEXT_COLOR} />
                <Text style={styles.emptyText}>
                  {activeTab === 'upcoming' ? 'No upcoming events' : 'No previous events'}
                </Text>
              </View>
            )}
          />
        </View>
      </ScrollView>

      <CreateEventModal
        visible={showCreateEventModal}
        onClose={() => setShowCreateEventModal(false)}
        onEventCreated={handleEventCreated}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: LIGHT_TEXT_COLOR,
    marginTop: 10,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: TEXT_COLOR,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: TEXT_COLOR,
    marginBottom: 15,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 15,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#F8F5FF',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: PRIMARY_COLOR,
  },
  actionIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: PRIMARY_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_COLOR,
  },
  metricsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 15,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#F8F5FF',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  metricNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: PRIMARY_COLOR,
    marginTop: 10,
    marginBottom: 5,
  },
  metricLabel: {
    fontSize: 12,
    color: LIGHT_TEXT_COLOR,
    textAlign: 'center',
  },
  tabsContainer: {
    flexDirection: 'row',
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: PRIMARY_COLOR,
  },
  tabText: {
    fontSize: 16,
    fontWeight: '500',
    color: LIGHT_TEXT_COLOR,
  },
  activeTabText: {
    color: PRIMARY_COLOR,
    fontWeight: 'bold',
  },
  eventsHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: 15,
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: PRIMARY_COLOR,
  },
  eventsList: {
    paddingRight: 20,
  },
  eventCard: {
    width: 200,
    marginRight: 15,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    overflow: 'hidden',
  },
  eventImage: {
    width: '100%',
    height: 120,
    backgroundColor: '#F8F5FF',
  },
  eventInfo: {
    padding: 12,
  },
  eventTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: TEXT_COLOR,
    marginBottom: 4,
  },
  eventDate: {
    fontSize: 12,
    color: LIGHT_TEXT_COLOR,
    marginBottom: 8,
  },
  eventStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  eventAttendees: {
    fontSize: 11,
    color: LIGHT_TEXT_COLOR,
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: LIGHT_TEXT_COLOR,
    marginTop: 10,
  },
});

