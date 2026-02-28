import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, FlatList, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { mockData } from '../../../data/mockData';
import SnooLoader from "../../../components/ui/SnooLoader";

const PRIMARY_COLOR = '#6A0DAD';
const TEXT_COLOR = '#1D1D1F';
const LIGHT_TEXT_COLOR = '#8E8E93';

export default function VenueBookingsScreen({ navigation }) {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('All');

  const filters = ['All', 'Pending', 'Confirmed', 'Completed'];

  useEffect(() => {
    loadBookings();
  }, []);

  const loadBookings = async () => {
    try {
      setLoading(true);
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Use mock data - in real app, this would be API call
      setBookings(mockData.venueBookings);
    } catch (error) {
      console.error('Error loading bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredBookings = () => {
    if (activeFilter === 'All') {
      return bookings;
    }
    return bookings.filter(booking => booking.status === activeFilter.toLowerCase());
  };

  const handleBookingPress = (booking) => {
    // Navigate to booking details
    console.log('View booking details:', booking.id);
  };

  const handleAcceptBooking = (booking) => {
    Alert.alert(
      'Accept Booking',
      `Accept booking for ${booking.event_title}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept',
          onPress: () => {
            // In real app, this would be API call
            setBookings(prevBookings => 
              prevBookings.map(b => 
                b.id === booking.id 
                  ? { ...b, status: 'confirmed' }
                  : b
              )
            );
          }
        }
      ]
    );
  };

  const handleRejectBooking = (booking) => {
    Alert.alert(
      'Reject Booking',
      `Reject booking for ${booking.event_title}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: () => {
            // In real app, this would be API call
            setBookings(prevBookings => 
              prevBookings.filter(b => b.id !== booking.id)
            );
          }
        }
      ]
    );
  };

  const renderBooking = ({ item }) => (
    <TouchableOpacity
      style={styles.bookingCard}
      onPress={() => handleBookingPress(item)}
    >
      <View style={styles.bookingHeader}>
        <View style={styles.bookingInfo}>
          <Text style={styles.eventTitle}>{item.event_title}</Text>
          <Text style={styles.communityName}>{item.community_name}</Text>
        </View>
        <View style={[
          styles.statusBadge,
          item.status === 'confirmed' ? styles.confirmedBadge : 
          item.status === 'pending' ? styles.pendingBadge : styles.completedBadge
        ]}>
          <Text style={[
            styles.statusText,
            item.status === 'confirmed' ? styles.confirmedText : 
            item.status === 'pending' ? styles.pendingText : styles.completedText
          ]}>
            {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
          </Text>
        </View>
      </View>

      <View style={styles.bookingDetails}>
        <View style={styles.bookingDetailItem}>
          <Ionicons name="calendar-outline" size={16} color={LIGHT_TEXT_COLOR} />
          <Text style={styles.bookingDetailText}>
            {new Date(item.booking_date).toLocaleDateString()}
          </Text>
        </View>
        <View style={styles.bookingDetailItem}>
          <Ionicons name="time-outline" size={16} color={LIGHT_TEXT_COLOR} />
          <Text style={styles.bookingDetailText}>
            {item.duration_hours} hours
          </Text>
        </View>
        <View style={styles.bookingDetailItem}>
          <Ionicons name="cash-outline" size={16} color={PRIMARY_COLOR} />
          <Text style={[styles.bookingDetailText, { color: PRIMARY_COLOR }]}>
            ₹{item.total_cost.toLocaleString()}
          </Text>
        </View>
      </View>

      {item.special_requirements && (
        <View style={styles.requirementsContainer}>
          <Text style={styles.requirementsTitle}>Special Requirements:</Text>
          <Text style={styles.requirementsText}>{item.special_requirements}</Text>
        </View>
      )}

      {item.status === 'pending' && (
        <View style={styles.bookingActions}>
          <TouchableOpacity
            style={styles.rejectButton}
            onPress={() => handleRejectBooking(item)}
          >
            <Ionicons name="close-outline" size={16} color="#FF3B30" />
            <Text style={[styles.actionButtonText, { color: '#FF3B30' }]}>Reject</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.acceptButton}
            onPress={() => handleAcceptBooking(item)}
          >
            <Ionicons name="checkmark-outline" size={16} color="#FFFFFF" />
            <Text style={[styles.actionButtonText, { color: '#FFFFFF' }]}>Accept</Text>
          </TouchableOpacity>
        </View>
      )}
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
      <Text style={styles.emptyTitle}>No Bookings Yet</Text>
      <Text style={styles.emptyText}>
        Browse communities to find booking opportunities
      </Text>
      <TouchableOpacity 
        style={styles.browseButton}
        onPress={() => navigation.navigate('Browse')}
      >
        <Text style={styles.browseButtonText}>Browse Communities</Text>
      </TouchableOpacity>
    </View>
  );

  const filteredBookings = getFilteredBookings();

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Bookings</Text>
        <Text style={styles.headerSubtitle}>
          Manage your venue booking requests and confirmations
        </Text>
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

      {/* Bookings List */}
      <View style={styles.bookingsContainer}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <SnooLoader size="large" color={PRIMARY_COLOR} />
            <Text style={styles.loadingText}>Loading bookings...</Text>
          </View>
        ) : (
          <FlatList
            data={filteredBookings}
            renderItem={renderBooking}
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
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: TEXT_COLOR,
    marginBottom: 5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: LIGHT_TEXT_COLOR,
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
  bookingsContainer: {
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
    paddingHorizontal: 20,
  },
  bookingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 15,
  },
  bookingInfo: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: TEXT_COLOR,
    marginBottom: 4,
  },
  communityName: {
    fontSize: 14,
    color: LIGHT_TEXT_COLOR,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  pendingBadge: {
    backgroundColor: '#FFF3CD',
  },
  confirmedBadge: {
    backgroundColor: '#D4EDDA',
  },
  completedBadge: {
    backgroundColor: '#D1ECF1',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  pendingText: {
    color: '#856404',
  },
  confirmedText: {
    color: '#155724',
  },
  completedText: {
    color: '#0C5460',
  },
  bookingDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E5E5EA',
  },
  bookingDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bookingDetailText: {
    fontSize: 12,
    color: LIGHT_TEXT_COLOR,
    marginLeft: 4,
  },
  requirementsContainer: {
    marginBottom: 15,
  },
  requirementsTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: TEXT_COLOR,
    marginBottom: 5,
  },
  requirementsText: {
    fontSize: 12,
    color: LIGHT_TEXT_COLOR,
    lineHeight: 16,
  },
  bookingActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 10,
  },
  rejectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  acceptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PRIMARY_COLOR,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  actionButtonText: {
    fontSize: 14,
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
  browseButton: {
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 12,
    paddingHorizontal: 30,
    paddingVertical: 15,
  },
  browseButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
