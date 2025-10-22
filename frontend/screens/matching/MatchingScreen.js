import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  Alert,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiGet, apiPost } from '../../api/client';

const { width: screenWidth } = Dimensions.get('window');
const PRIMARY_COLOR = '#6A0DAD';
const TEXT_COLOR = '#1D1D1F';
const LIGHT_TEXT_COLOR = '#8E8E93';

export default function MatchingScreen({ navigation }) {
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [attendees, setAttendees] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      setLoading(true);
      const response = await apiGet('/events/registered');
      setEvents(response.events || []);
    } catch (error) {
      console.error('Error loading events:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectEvent = async (event) => {
    try {
      setSelectedEvent(event);
      const response = await apiGet(`/events/${event.id}/attendees`);
      setAttendees(response.attendees || []);
      setCurrentIndex(0);
    } catch (error) {
      console.error('Error loading attendees:', error);
      Alert.alert('Error', 'Failed to load attendees');
    }
  };

  const handleSwipe = async (direction) => {
    if (currentIndex >= attendees.length) return;

    const attendee = attendees[currentIndex];
    
    try {
      await apiPost(`/events/${selectedEvent.id}/swipe`, {
        liked_id: attendee.id,
        swipe_direction: direction
      });

      if (direction === 'right') {
        Alert.alert('Match!', `You liked ${attendee.name}! They'll be notified.`);
      }

      setCurrentIndex(prev => prev + 1);
    } catch (error) {
      console.error('Error swiping:', error);
      Alert.alert('Error', 'Failed to record swipe');
    }
  };

  const requestNextEvent = () => {
    Alert.alert(
      'Request to Join Next Event',
      'This feature is coming soon! You\'ll be able to request to join upcoming events.',
      [{ text: 'OK' }]
    );
  };

  const renderEventCard = (event) => (
    <TouchableOpacity
      key={event.id}
      style={[
        styles.eventCard,
        selectedEvent?.id === event.id && styles.selectedEventCard
      ]}
      onPress={() => selectEvent(event)}
    >
      <View style={styles.eventInfo}>
        <Text style={styles.eventTitle}>{event.title}</Text>
        <Text style={styles.eventDate}>
          {new Date(event.event_date).toLocaleDateString()}
        </Text>
        <Text style={styles.eventAttendees}>
          {event.attendee_count || 0} attendees
        </Text>
      </View>
      <Ionicons 
        name="chevron-forward" 
        size={20} 
        color={LIGHT_TEXT_COLOR} 
      />
    </TouchableOpacity>
  );

  const renderAttendeeCard = (attendee) => (
    <View style={styles.attendeeCard}>
      <View style={styles.attendeeImageContainer}>
        <Image 
          source={{ uri: attendee.profile_photo_url || 'https://via.placeholder.com/300' }} 
          style={styles.attendeeImage}
        />
        <View style={styles.attendeeInfo}>
          <Text style={styles.attendeeName}>{attendee.name}</Text>
          <Text style={styles.attendeeAge}>{attendee.age} years old</Text>
        </View>
      </View>
      
      <View style={styles.attendeeBio}>
        <Text style={styles.bioText}>{attendee.bio}</Text>
      </View>

      <View style={styles.interestsContainer}>
        <Text style={styles.interestsTitle}>Interests:</Text>
        <View style={styles.interestsList}>
          {attendee.interests?.slice(0, 3).map((interest, index) => (
            <View key={index} style={styles.interestTag}>
              <Text style={styles.interestText}>{interest}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.actionButtons}>
        <TouchableOpacity 
          style={[styles.actionButton, styles.passButton]}
          onPress={() => handleSwipe('left')}
        >
          <Ionicons name="close" size={30} color="#FFFFFF" />
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.actionButton, styles.undoButton]}
          onPress={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
        >
          <Ionicons name="arrow-undo" size={24} color="#FFFFFF" />
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.actionButton, styles.likeButton]}
          onPress={() => handleSwipe('right')}
        >
          <Ionicons name="heart" size={30} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </View>
  );

  if (selectedEvent && attendees.length > 0) {
    const currentAttendee = attendees[currentIndex];
    
    if (currentIndex >= attendees.length) {
      return (
        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => setSelectedEvent(null)}
            >
              <Ionicons name="arrow-back" size={24} color={TEXT_COLOR} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Matching Complete</Text>
            <View style={styles.headerRight} />
          </View>

          <View style={styles.completeContainer}>
            <Ionicons name="checkmark-circle" size={80} color={PRIMARY_COLOR} />
            <Text style={styles.completeTitle}>All Done!</Text>
            <Text style={styles.completeText}>
              You've seen all attendees for {selectedEvent.title}
            </Text>
            
            <TouchableOpacity 
              style={styles.nextEventButton}
              onPress={requestNextEvent}
            >
              <Text style={styles.nextEventButtonText}>Request to Join Next Event</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      );
    }

    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => setSelectedEvent(null)}
          >
            <Ionicons name="arrow-back" size={24} color={TEXT_COLOR} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{selectedEvent.title}</Text>
          <TouchableOpacity style={styles.filterButton}>
            <Ionicons name="options" size={24} color={TEXT_COLOR} />
          </TouchableOpacity>
        </View>

        <View style={styles.swipeContainer}>
          {renderAttendeeCard(currentAttendee)}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Matching</Text>
        <TouchableOpacity style={styles.filterButton}>
          <Ionicons name="options" size={24} color={TEXT_COLOR} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Events</Text>
          <Text style={styles.sectionSubtitle}>
            Select an event to start matching with other attendees
          </Text>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading events...</Text>
          </View>
        ) : events.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar-outline" size={60} color={LIGHT_TEXT_COLOR} />
            <Text style={styles.emptyTitle}>No Events Yet</Text>
            <Text style={styles.emptyText}>
              Register for events to start matching with other attendees
            </Text>
            <TouchableOpacity 
              style={styles.exploreButton}
              onPress={() => navigation.navigate('Search')}
            >
              <Text style={styles.exploreButtonText}>Explore Events</Text>
            </TouchableOpacity>
          </View>
        ) : (
          events.map(renderEventCard)
        )}

        <TouchableOpacity 
          style={styles.requestButton}
          onPress={requestNextEvent}
        >
          <Text style={styles.requestButtonText}>Request to Join Next Event</Text>
        </TouchableOpacity>
      </ScrollView>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: TEXT_COLOR,
  },
  filterButton: {
    padding: 5,
  },
  headerRight: {
    width: 34,
  },
  content: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: TEXT_COLOR,
    marginBottom: 5,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: LIGHT_TEXT_COLOR,
  },
  eventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  selectedEventCard: {
    borderColor: PRIMARY_COLOR,
    backgroundColor: '#F8F5FF',
  },
  eventInfo: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: TEXT_COLOR,
    marginBottom: 5,
  },
  eventDate: {
    fontSize: 14,
    color: LIGHT_TEXT_COLOR,
    marginBottom: 3,
  },
  eventAttendees: {
    fontSize: 12,
    color: PRIMARY_COLOR,
  },
  swipeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  attendeeCard: {
    width: screenWidth - 40,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  attendeeImageContainer: {
    position: 'relative',
    marginBottom: 20,
  },
  attendeeImage: {
    width: '100%',
    height: 300,
    borderRadius: 16,
  },
  attendeeInfo: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 8,
  },
  attendeeName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  attendeeAge: {
    fontSize: 14,
    color: '#FFFFFF',
    marginTop: 2,
  },
  attendeeBio: {
    marginBottom: 20,
  },
  bioText: {
    fontSize: 16,
    color: TEXT_COLOR,
    lineHeight: 22,
  },
  interestsContainer: {
    marginBottom: 30,
  },
  interestsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_COLOR,
    marginBottom: 10,
  },
  interestsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  interestTag: {
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  interestText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  actionButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  passButton: {
    backgroundColor: '#FF3B30',
  },
  undoButton: {
    backgroundColor: '#8E8E93',
  },
  likeButton: {
    backgroundColor: PRIMARY_COLOR,
  },
  completeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  completeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: TEXT_COLOR,
    marginTop: 20,
    marginBottom: 10,
  },
  completeText: {
    fontSize: 16,
    color: LIGHT_TEXT_COLOR,
    textAlign: 'center',
    marginBottom: 30,
  },
  nextEventButton: {
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 12,
    paddingHorizontal: 30,
    paddingVertical: 15,
  },
  nextEventButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  loadingText: {
    fontSize: 16,
    color: LIGHT_TEXT_COLOR,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 50,
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
  },
  exploreButton: {
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 12,
    paddingHorizontal: 30,
    paddingVertical: 15,
  },
  exploreButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  requestButton: {
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 15,
    marginHorizontal: 20,
    marginBottom: 20,
    alignItems: 'center',
  },
  requestButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: PRIMARY_COLOR,
  },
});
