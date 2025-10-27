import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { mockData } from '../../../data/mockData';

const PRIMARY_COLOR = '#6A0DAD';
const TEXT_COLOR = '#1D1D1F';
const LIGHT_TEXT_COLOR = '#8E8E93';

export default function CommunityEventsScreen({ navigation }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('All');

  const filters = ['All', 'Upcoming', 'Past', 'My Events'];

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      setLoading(true);
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Use mock data - in real app, this would be API call
      setEvents(mockData.events);
    } catch (error) {
      console.error('Error loading events:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredEvents = () => {
    switch (activeFilter) {
      case 'Upcoming':
        return events.filter(event => !event.is_past);
      case 'Past':
        return events.filter(event => event.is_past);
      case 'My Events':
        return events.filter(event => event.registration_status === 'registered' || event.registration_status === 'attended');
      default:
        return events;
    }
  };

  const handleCreateEvent = () => {
    // Navigate to create event screen
    console.log('Navigate to create event');
  };

  const handleEventPress = (event) => {
    // Navigate to event details
    console.log('Navigate to event details:', event.id);
  };

  const handleEditEvent = (event) => {
    // Navigate to edit event screen
    console.log('Edit event:', event.id);
  };

  const handleViewAttendees = (event) => {
    // Navigate to attendees screen
    console.log('View attendees for event:', event.id);
  };

  const renderEvent = ({ item }) => (
    <TouchableOpacity
      style={styles.eventCard}
      onPress={() => handleEventPress(item)}
    >
      <View style={styles.eventHeader}>
        <View style={styles.eventInfo}>
          <Text style={styles.eventTitle}>{item.title}</Text>
          <View style={[
            styles.eventStatusBadge,
            item.is_past ? styles.pastEventBadge : styles.upcomingEventBadge
          ]}>
            <Text style={[
              styles.eventStatusText,
              item.is_past ? styles.pastEventText : styles.upcomingEventText
            ]}>
              {item.is_past ? 'Past' : 'Upcoming'}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.moreButton}
          onPress={() => {
            Alert.alert(
              'Event Options',
              'What would you like to do?',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Edit Event', onPress: () => handleEditEvent(item) },
                { text: 'View Attendees', onPress: () => handleViewAttendees(item) },
              ]
            );
          }}
        >
          <Ionicons name="ellipsis-horizontal" size={20} color={LIGHT_TEXT_COLOR} />
        </TouchableOpacity>
      </View>

      <Text style={styles.eventDescription}>{item.description}</Text>

      <View style={styles.eventDetails}>
        <View style={styles.eventDetailItem}>
          <Ionicons name="calendar-outline" size={16} color={LIGHT_TEXT_COLOR} />
          <Text style={styles.eventDetailText}>
            {new Date(item.event_date).toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </Text>
        </View>

        <View style={styles.eventDetailItem}>
          <Ionicons name="location-outline" size={16} color={LIGHT_TEXT_COLOR} />
          <Text style={styles.eventDetailText}>{item.location}</Text>
        </View>

        <View style={styles.eventDetailItem}>
          <Ionicons name="people-outline" size={16} color={PRIMARY_COLOR} />
          <Text style={[styles.eventDetailText, { color: PRIMARY_COLOR }]}>
            {item.current_attendees}/{item.max_attendees} attendees
          </Text>
        </View>
      </View>

      <View style={styles.eventActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleViewAttendees(item)}
        >
          <Ionicons name="people" size={16} color={PRIMARY_COLOR} />
          <Text style={styles.actionButtonText}>Attendees</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleEditEvent(item)}
        >
          <Ionicons name="create-outline" size={16} color={LIGHT_TEXT_COLOR} />
          <Text style={[styles.actionButtonText, { color: LIGHT_TEXT_COLOR }]}>Edit</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const renderFilter = (filter) => (
    <TouchableOpacity
      key={filter}
      style={[
        styles.filterTab,
        activeFilter === filter && styles.activeFilterTab
      ]}
      onPress={() => setActiveFilter(filter)}
    >
      <Text style={[
        styles.filterText,
        activeFilter === filter && styles.activeFilterText
      ]}>
        {filter}
      </Text>
    </TouchableOpacity>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="calendar-outline" size={60} color={LIGHT_TEXT_COLOR} />
      <Text style={styles.emptyTitle}>No Events Found</Text>
      <Text style={styles.emptyText}>
        {activeFilter === 'All' 
          ? 'No events have been created yet'
          : `No ${activeFilter.toLowerCase()} events found`
        }
      </Text>
      <TouchableOpacity 
        style={styles.createButton}
        onPress={handleCreateEvent}
      >
        <Text style={styles.createButtonText}>Create First Event</Text>
      </TouchableOpacity>
    </View>
  );

  const filteredEvents = getFilteredEvents();

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Events</Text>
        <TouchableOpacity
          style={styles.createEventButton}
          onPress={handleCreateEvent}
        >
          <Ionicons name="add" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Filters */}
      <View style={styles.filtersContainer}>
        <FlatList
          data={filters}
          renderItem={({ item }) => renderFilter(item)}
          keyExtractor={(item) => item}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersList}
        />
      </View>

      {/* Events List */}
      <View style={styles.eventsContainer}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={PRIMARY_COLOR} />
            <Text style={styles.loadingText}>Loading events...</Text>
          </View>
        ) : (
          <FlatList
            data={filteredEvents}
            renderItem={renderEvent}
            keyExtractor={(item) => item.id.toString()}
            ListEmptyComponent={renderEmpty}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContainer}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: TEXT_COLOR,
  },
  createEventButton: {
    backgroundColor: PRIMARY_COLOR,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filtersContainer: {
    paddingVertical: 10,
  },
  filtersList: {
    paddingHorizontal: 20,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 10,
    borderRadius: 20,
    backgroundColor: '#F8F9FA',
  },
  activeFilterTab: {
    backgroundColor: PRIMARY_COLOR,
  },
  filterText: {
    fontSize: 14,
    color: LIGHT_TEXT_COLOR,
    fontWeight: '500',
  },
  activeFilterText: {
    color: '#FFFFFF',
  },
  eventsContainer: {
    flex: 1,
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
  listContainer: {
    flexGrow: 1,
  },
  eventCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  eventInfo: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: TEXT_COLOR,
    marginBottom: 8,
  },
  eventStatusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pastEventBadge: {
    backgroundColor: '#F2F2F7',
  },
  upcomingEventBadge: {
    backgroundColor: '#E8F5E8',
  },
  eventStatusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  pastEventText: {
    color: LIGHT_TEXT_COLOR,
  },
  upcomingEventText: {
    color: '#34C759',
  },
  moreButton: {
    padding: 5,
  },
  eventDescription: {
    fontSize: 14,
    color: LIGHT_TEXT_COLOR,
    lineHeight: 20,
    marginBottom: 15,
  },
  eventDetails: {
    marginBottom: 15,
  },
  eventDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  eventDetailText: {
    fontSize: 14,
    color: LIGHT_TEXT_COLOR,
    marginLeft: 8,
  },
  eventActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  actionButtonText: {
    fontSize: 14,
    color: PRIMARY_COLOR,
    marginLeft: 5,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: TEXT_COLOR,
    marginTop: 20,
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 16,
    color: LIGHT_TEXT_COLOR,
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 22,
  },
  createButton: {
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 12,
    paddingHorizontal: 30,
    paddingVertical: 15,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
