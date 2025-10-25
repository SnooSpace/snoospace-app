import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiGet, apiPost } from '../../api/client';
import AttendeeCard from '../../components/AttendeeCard';
import MatchModal from '../../components/MatchModal';
import NextEventRequestModal from '../../components/NextEventRequestModal';

const PRIMARY_COLOR = '#6A0DAD';
const TEXT_COLOR = '#1D1D1F';
const LIGHT_TEXT_COLOR = '#8E8E93';

// Mock data for testing
const mockEvents = [
  {
    id: 1,
    title: 'Tech Meetup 2024',
    description: 'Annual technology conference',
    event_date: '2024-01-15T18:00:00Z',
    location: 'Convention Center, Mumbai',
    community_name: 'Tech Mumbai',
    venue_name: 'Mumbai Convention Center',
    attendee_count: 25,
    is_past: true,
    registration_status: 'attended'
  },
  {
    id: 2,
    title: 'Startup Networking Event',
    description: 'Connect with fellow entrepreneurs',
    event_date: '2024-02-20T19:00:00Z',
    location: 'Co-working Space, Bangalore',
    community_name: 'Startup India',
    venue_name: 'WeWork Bangalore',
    attendee_count: 18,
    is_past: true,
    registration_status: 'attended'
  },
  {
    id: 3,
    title: 'Design Thinking Workshop',
    description: 'Learn design thinking methodologies',
    event_date: '2024-03-10T10:00:00Z',
    location: 'Design Studio, Delhi',
    community_name: 'Design Delhi',
    venue_name: 'Creative Studio Delhi',
    attendee_count: 12,
    is_past: false,
    registration_status: 'registered'
  }
];

const mockAttendees = [
  {
    id: 1,
    name: 'Priya Sharma',
    age: 24,
    city: 'Mumbai',
    pronouns: 'she/her',
    bio: 'Passionate about technology and innovation. Love meeting new people and exploring new ideas.',
    interests: ['Technology', 'Innovation', 'Networking', 'Travel'],
    username: 'priya_tech',
    photos: [
      { id: 1, photo_url: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=400', photo_order: 0 },
      { id: 2, photo_url: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400', photo_order: 1 },
      { id: 3, photo_url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400', photo_order: 2 }
    ]
  },
  {
    id: 2,
    name: 'Arjun Patel',
    age: 26,
    city: 'Bangalore',
    pronouns: 'he/him',
    bio: 'Entrepreneur and startup enthusiast. Always looking for the next big idea and amazing people to work with.',
    interests: ['Entrepreneurship', 'Startups', 'Business', 'Fitness'],
    username: 'arjun_startup',
    photos: [
      { id: 4, photo_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400', photo_order: 0 },
      { id: 5, photo_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400', photo_order: 1 }
    ]
  },
  {
    id: 3,
    name: 'Sneha Reddy',
    age: 23,
    city: 'Hyderabad',
    pronouns: 'she/her',
    bio: 'UI/UX designer with a passion for creating beautiful and functional designs. Love coffee and good conversations.',
    interests: ['Design', 'Art', 'Coffee', 'Photography'],
    username: 'sneha_design',
    photos: [
      { id: 6, photo_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400', photo_order: 0 },
      { id: 7, photo_url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400', photo_order: 1 },
      { id: 8, photo_url: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400', photo_order: 2 },
      { id: 9, photo_url: 'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=400', photo_order: 3 }
    ]
  },
  {
    id: 4,
    name: 'Rahul Kumar',
    age: 28,
    city: 'Delhi',
    pronouns: 'he/him',
    bio: 'Software engineer by day, musician by night. Love building things and meeting creative people.',
    interests: ['Music', 'Technology', 'Gaming', 'Cooking'],
    username: 'rahul_music',
    photos: [
      { id: 10, photo_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400', photo_order: 0 },
      { id: 11, photo_url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400', photo_order: 1 }
    ]
  },
  {
    id: 5,
    name: 'Kavya Nair',
    age: 25,
    city: 'Chennai',
    pronouns: 'she/her',
    bio: 'Marketing professional with a love for digital trends and social media. Always up for new adventures!',
    interests: ['Marketing', 'Social Media', 'Travel', 'Fashion'],
    username: 'kavya_marketing',
    photos: [
      { id: 12, photo_url: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=400', photo_order: 0 },
      { id: 13, photo_url: 'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=400', photo_order: 1 },
      { id: 14, photo_url: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=400', photo_order: 2 }
    ]
  }
];

export default function MatchingScreen({ navigation }) {
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [attendees, setAttendees] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [matchData, setMatchData] = useState(null);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [selectedAttendee, setSelectedAttendee] = useState(null);
  const [swipedAttendees, setSwipedAttendees] = useState(new Set());

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      setLoading(true);
      const accessToken = await AsyncStorage.getItem('accessToken');
      
      if (accessToken) {
        const response = await apiGet('/events/my-events', accessToken);
        setEvents(response.events || []);
      } else {
        // Use mock data if no token
        setEvents(mockEvents);
      }
    } catch (error) {
      console.error('Error loading events:', error);
      // Fallback to mock data
      setEvents(mockEvents);
    } finally {
      setLoading(false);
    }
  };

  const selectEvent = async (event) => {
    try {
      setSelectedEvent(event);
      setLoading(true);
      const accessToken = await AsyncStorage.getItem('accessToken');
      
      if (accessToken) {
        const response = await apiGet(`/events/${event.id}/attendees`, accessToken);
        setAttendees(response.attendees || []);
      } else {
        // Use mock data
        setAttendees(mockAttendees);
      }
      
      setCurrentIndex(0);
      setSwipedAttendees(new Set());
    } catch (error) {
      console.error('Error loading attendees:', error);
      // Fallback to mock data
      setAttendees(mockAttendees);
      setCurrentIndex(0);
      setSwipedAttendees(new Set());
    } finally {
      setLoading(false);
    }
  };

  const handleSwipeLeft = async () => {
    if (currentIndex >= attendees.length) return;

    const attendee = attendees[currentIndex];
    setSwipedAttendees(prev => new Set([...prev, attendee.id]));
    
    try {
      const accessToken = await AsyncStorage.getItem('accessToken');
      if (accessToken && selectedEvent) {
        await apiPost(`/events/${selectedEvent.id}/swipe`, {
          swiped_id: attendee.id,
          swipe_direction: 'left'
        }, accessToken);
      }
    } catch (error) {
      console.error('Error recording swipe:', error);
    }

    setCurrentIndex(prev => prev + 1);
  };

  const handleSwipeRight = async () => {
    if (currentIndex >= attendees.length) return;

    const attendee = attendees[currentIndex];
    setSwipedAttendees(prev => new Set([...prev, attendee.id]));
    
    try {
      const accessToken = await AsyncStorage.getItem('accessToken');
      let isMatch = false;
      let matchData = null;

      if (accessToken && selectedEvent) {
        const response = await apiPost(`/events/${selectedEvent.id}/swipe`, {
          swiped_id: attendee.id,
          swipe_direction: 'right'
        }, accessToken);
        
        isMatch = response.isMatch;
        matchData = response.matchData;
      } else {
        // Mock match logic - 30% chance of match
        isMatch = Math.random() < 0.3;
        if (isMatch) {
          matchData = {
            member1_name: 'You',
            member1_photo: 'https://via.placeholder.com/150',
            member2_name: attendee.name,
            member2_photo: attendee.photos[0]?.photo_url || 'https://via.placeholder.com/150'
          };
        }
      }

      if (isMatch && matchData) {
        setMatchData(matchData);
        setShowMatchModal(true);
      }

    } catch (error) {
      console.error('Error recording swipe:', error);
    }

    setCurrentIndex(prev => prev + 1);
  };

  const handleUndo = () => {
    if (currentIndex > 0) {
      const prevAttendee = attendees[currentIndex - 1];
      setSwipedAttendees(prev => {
        const newSet = new Set(prev);
        newSet.delete(prevAttendee.id);
        return newSet;
      });
      setCurrentIndex(prev => prev - 1);
    }
  };

  const handleRequestNextEvent = (attendee) => {
    setSelectedAttendee(attendee);
    setShowRequestModal(true);
  };

  const sendNextEventRequest = async (message) => {
    if (!selectedEvent || !selectedAttendee) return;

    try {
      const accessToken = await AsyncStorage.getItem('accessToken');
      if (accessToken) {
        await apiPost(`/events/${selectedEvent.id}/request-next`, {
          requested_id: selectedAttendee.id,
          message: message
        }, accessToken);
      }
      // Mock success - in real app, this would send the request
    } catch (error) {
      console.error('Error sending next event request:', error);
      throw error;
    }
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
        <View style={styles.eventHeader}>
          <Text style={styles.eventTitle}>{event.title}</Text>
          <View style={[
            styles.eventStatusBadge,
            event.is_past ? styles.pastEventBadge : styles.upcomingEventBadge
          ]}>
            <Text style={[
              styles.eventStatusText,
              event.is_past ? styles.pastEventText : styles.upcomingEventText
            ]}>
              {event.is_past ? 'Past' : 'Upcoming'}
            </Text>
          </View>
        </View>
        <Text style={styles.eventDate}>
          {new Date(event.event_date).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </Text>
        <Text style={styles.eventLocation}>
          <Ionicons name="location-outline" size={14} color={LIGHT_TEXT_COLOR} />
          {' '}{event.location}
        </Text>
        <Text style={styles.eventAttendees}>
          <Ionicons name="people-outline" size={14} color={PRIMARY_COLOR} />
          {' '}{event.attendee_count} attendees
        </Text>
      </View>
      <Ionicons 
        name="chevron-forward" 
        size={20} 
        color={LIGHT_TEXT_COLOR} 
      />
    </TouchableOpacity>
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
              style={styles.backToEventsButton}
              onPress={() => setSelectedEvent(null)}
            >
              <Text style={styles.backToEventsButtonText}>Back to Events</Text>
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
          <View style={styles.headerRight} />
        </View>

        <View style={styles.swipeContainer}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={PRIMARY_COLOR} />
              <Text style={styles.loadingText}>Loading attendees...</Text>
            </View>
          ) : (
            <AttendeeCard
              attendee={currentAttendee}
              onSwipeLeft={handleSwipeLeft}
              onSwipeRight={handleSwipeRight}
              onUndo={handleUndo}
              onRequestNextEvent={() => handleRequestNextEvent(currentAttendee)}
              canUndo={currentIndex > 0}
            />
          )}
        </View>

        <MatchModal
          visible={showMatchModal}
          matchData={matchData}
          onClose={() => setShowMatchModal(false)}
          onSendMessage={() => {
            setShowMatchModal(false);
            Alert.alert('Coming Soon', 'Messaging feature will be available soon!');
          }}
        />

        <NextEventRequestModal
          visible={showRequestModal}
          attendee={selectedAttendee}
          onClose={() => setShowRequestModal(false)}
          onSendRequest={sendNextEventRequest}
        />
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
            <ActivityIndicator size="large" color={PRIMARY_COLOR} />
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
  eventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: TEXT_COLOR,
    flex: 1,
  },
  eventStatusBadge: {
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
  eventDate: {
    fontSize: 14,
    color: LIGHT_TEXT_COLOR,
    marginBottom: 5,
  },
  eventLocation: {
    fontSize: 14,
    color: LIGHT_TEXT_COLOR,
    marginBottom: 3,
  },
  eventAttendees: {
    fontSize: 12,
    color: PRIMARY_COLOR,
    fontWeight: '500',
  },
  swipeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
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
    marginTop: 10,
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
  backToEventsButton: {
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 12,
    paddingHorizontal: 30,
    paddingVertical: 15,
  },
  backToEventsButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
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
});