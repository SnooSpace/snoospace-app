import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiGet } from '../../api/client';
import { getAuthToken } from '../../api/auth';
import { openMapsNavigation } from '../../utils/openMapsNavigation';

const PRIMARY_COLOR = '#6A0DAD';
const TEXT_COLOR = '#1D1D1F';
const LIGHT_TEXT_COLOR = '#8E8E93';

// Helper function to extract place name from Google Maps URL
const getLocationNameFromUrl = (url) => {
  try {
    // Google Maps URLs have format: /place/Location+Name/data=...
    const match = url.match(/\/place\/([^\/]+)/);
    if (match) {
      return decodeURIComponent(match[1].replace(/\+/g, ' '));
    }
    return 'View Location';
  } catch {
    return 'View Location';
  }
};

export default function YourEventsScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState('Going');
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadEvents = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      const token = await getAuthToken();
      const response = await apiGet('/events/my-events', 15000, token);
      const allEvents = response?.events || [];
      setEvents(allEvents);
    } catch (error) {
      console.error('Error loading events:', error);
    } finally {
      if (isRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const getFilteredEvents = () => {
    const now = new Date();
    switch (activeTab) {
      case 'Going':
        return events.filter(e => {
          const eventDate = new Date(e.event_date);
          return (e.registration_status === 'registered' && eventDate >= now) ||
                 (e.registration_status === 'attended' && eventDate >= now);
        });
      case 'Interested':
        // For now, return empty array (bookmarking functionality to be added later)
        return [];
      case 'Past':
        return events.filter(e => {
          const eventDate = new Date(e.event_date);
          return e.is_past || (eventDate < now && e.registration_status === 'attended');
        });
      default:
        return [];
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  };

  const renderEvent = ({ item }) => (
    <TouchableOpacity style={styles.eventCard}>
      <View style={styles.eventHeader}>
        <Text style={styles.eventTitle}>{item.title}</Text>
        <View style={styles.eventStatus}>
          <Text style={styles.eventStatusText}>
            {item.registration_status === 'attended' ? 'Attended' : 
             item.registration_status === 'registered' ? 'Registered' : 
             'Past'}
          </Text>
        </View>
      </View>
      {item.description && (
        <Text style={styles.eventDescription} numberOfLines={2}>
          {item.description}
        </Text>
      )}
      <View style={styles.eventDetails}>
        <View style={styles.eventDetailRow}>
          <Ionicons name="calendar-outline" size={16} color={LIGHT_TEXT_COLOR} />
          <Text style={styles.eventDetailText}>{formatDate(item.event_date)}</Text>
        </View>
        {item.location_url && (
          <TouchableOpacity 
            style={styles.eventDetailRow}
            onPress={() => openMapsNavigation(item.location_url)}
            activeOpacity={0.7}
          >
            <Ionicons name="location" size={16} color={PRIMARY_COLOR} />
            <Text style={[styles.eventDetailText, styles.locationText]} numberOfLines={1}>
              {getLocationNameFromUrl(item.location_url)}
            </Text>
            <Ionicons name="navigate-outline" size={14} color={PRIMARY_COLOR} />
          </TouchableOpacity>
        )}
        {(item.community_name || item.venue_name) && (
          <View style={styles.eventDetailRow}>
            <Ionicons name="people-outline" size={16} color={LIGHT_TEXT_COLOR} />
            <Text style={styles.eventDetailText}>
              {item.community_name || item.venue_name}
            </Text>
          </View>
        )}
        {item.attendee_count !== undefined && (
          <View style={styles.eventDetailRow}>
            <Ionicons name="person-outline" size={16} color={LIGHT_TEXT_COLOR} />
            <Text style={styles.eventDetailText}>
              {item.attendee_count} {item.attendee_count === 1 ? 'attendee' : 'attendees'}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  const filteredEvents = getFilteredEvents();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Your Events</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {['Going', 'Interested', 'Past'].map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.activeTab]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Events List */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={PRIMARY_COLOR} />
        </View>
      ) : (
        <FlatList
          data={filteredEvents}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderEvent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadEvents(true)}
              tintColor={PRIMARY_COLOR}
              colors={[PRIMARY_COLOR]}
            />
          }
          ListEmptyComponent={
            <View style={styles.centerContainer}>
              <Text style={styles.emptyText}>
                {activeTab === 'Going' && "You're not going to any events"}
                {activeTab === 'Interested' && "You haven't bookmarked any events yet"}
                {activeTab === 'Past' && "You haven't attended any past events"}
              </Text>
            </View>
          }
          contentContainerStyle={filteredEvents.length === 0 ? { flexGrow: 1 } : { paddingBottom: 20 }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: TEXT_COLOR,
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: PRIMARY_COLOR,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: LIGHT_TEXT_COLOR,
  },
  activeTabText: {
    color: PRIMARY_COLOR,
    fontWeight: '600',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 16,
    color: LIGHT_TEXT_COLOR,
    textAlign: 'center',
  },
  eventCard: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: TEXT_COLOR,
    flex: 1,
    marginRight: 12,
  },
  eventStatus: {
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  eventStatusText: {
    fontSize: 12,
    fontWeight: '500',
    color: PRIMARY_COLOR,
  },
  eventDescription: {
    fontSize: 14,
    color: LIGHT_TEXT_COLOR,
    marginBottom: 12,
    lineHeight: 20,
  },
  eventDetails: {
    gap: 8,
  },
  eventDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  eventDetailText: {
    fontSize: 14,
    color: TEXT_COLOR,
  },
  locationText: {
    color: PRIMARY_COLOR,
    textDecorationLine: 'underline',
    flex: 1,
  },
});

