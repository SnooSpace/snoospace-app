import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, FlatList, TouchableOpacity, Image, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { mockData } from '../../../data/mockData';
import SnooLoader from "../../../components/ui/SnooLoader";

const PRIMARY_COLOR = '#6A0DAD';
const TEXT_COLOR = '#1D1D1F';
const LIGHT_TEXT_COLOR = '#8E8E93';

export default function CommunityRequestsScreen({ navigation }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Received');

  useEffect(() => {
    loadRequests();
  }, [activeTab]);

  const loadRequests = async () => {
    try {
      setLoading(true);
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Use mock data based on active tab
      const filteredRequests = mockData.collaborationRequests.filter(
        request => request.type === activeTab.toLowerCase()
      );
      setRequests(filteredRequests);
    } catch (error) {
      console.error('Error loading requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptRequest = (request) => {
    Alert.alert(
      'Accept Request',
      `Accept collaboration request from ${request.requester_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept',
          onPress: () => {
            // In real app, this would be API call
            setRequests(prevRequests =>
              prevRequests.map(r =>
                r.id === request.id ? { ...r, status: 'accepted' } : r
              )
            );
          }
        }
      ]
    );
  };

  const handleDeclineRequest = (request) => {
    Alert.alert(
      'Decline Request',
      `Decline collaboration request from ${request.requester_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: () => {
            // In real app, this would be API call
            setRequests(prevRequests =>
              prevRequests.filter(r => r.id !== request.id)
            );
          }
        }
      ]
    );
  };

  const handleEditRequest = (request) => {
    console.log('Edit request:', request.id);
  };

  const handleWithdrawRequest = (request) => {
    Alert.alert(
      'Withdraw Request',
      'Are you sure you want to withdraw this collaboration request?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Withdraw',
          style: 'destructive',
          onPress: () => {
            // In real app, this would be API call
            setRequests(prevRequests =>
              prevRequests.filter(r => r.id !== request.id)
            );
          }
        }
      ]
    );
  };

  const getRequesterInfo = (request) => {
    if (activeTab === 'Received') {
      return {
        photo: request.requester_photo_url,
        name: request.requester_name,
        type: request.requester_type,
        message: request.message,
      };
    } else {
      return {
        photo: request.recipient_photo_url,
        name: request.recipient_name,
        type: request.recipient_type,
        message: request.message,
      };
    }
  };

  const renderRequest = ({ item }) => {
    const info = getRequesterInfo(item);

    return (
      <View style={styles.requestCard}>
        <View style={styles.requestHeader}>
          <Image
            source={{ uri: info.photo }}
            style={styles.requestPhoto}
          />
          <View style={styles.requestInfo}>
            <Text style={styles.requestName}>{info.name}</Text>
            <View style={styles.requestType}>
              <Text style={styles.requestTypeText}>
                {info.type.charAt(0).toUpperCase() + info.type.slice(1)}
              </Text>
            </View>
          </View>
          <View style={[
            styles.statusBadge,
            item.status === 'accepted' ? styles.acceptedBadge :
            item.status === 'pending' ? styles.pendingBadge : styles.declinedBadge
          ]}>
            <Text style={[
              styles.statusText,
              item.status === 'accepted' ? styles.acceptedText :
              item.status === 'pending' ? styles.pendingText : styles.declinedText
            ]}>
              {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
            </Text>
          </View>
        </View>

        <Text style={styles.requestMessage}>{info.message}</Text>

        <View style={styles.requestDetails}>
          <Ionicons name="time-outline" size={14} color={LIGHT_TEXT_COLOR} />
          <Text style={styles.requestDate}>
            {new Date(item.created_at).toLocaleDateString()}
          </Text>
        </View>

        {item.status === 'pending' && (
          <View style={styles.requestActions}>
            {activeTab === 'Received' ? (
              <>
                <TouchableOpacity
                  style={[styles.actionButton, styles.declineButton]}
                  onPress={() => handleDeclineRequest(item)}
                >
                  <Ionicons name="close" size={18} color="#FF3B30" />
                  <Text style={[styles.actionButtonText, { color: '#FF3B30' }]}>
                    Decline
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.acceptButton]}
                  onPress={() => handleAcceptRequest(item)}
                >
                  <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                  <Text style={[styles.actionButtonText, { color: '#FFFFFF' }]}>
                    Accept
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.actionButton, styles.editButton]}
                  onPress={() => handleEditRequest(item)}
                >
                  <Ionicons name="create-outline" size={18} color={PRIMARY_COLOR} />
                  <Text style={[styles.actionButtonText, { color: PRIMARY_COLOR }]}>
                    Edit
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.withdrawButton]}
                  onPress={() => handleWithdrawRequest(item)}
                >
                  <Ionicons name="close-outline" size={18} color="#FF3B30" />
                  <Text style={[styles.actionButtonText, { color: '#FF3B30' }]}>
                    Withdraw
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
      </View>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="mail-outline" size={60} color={LIGHT_TEXT_COLOR} />
      <Text style={styles.emptyTitle}>
        No {activeTab} Requests
      </Text>
      <Text style={styles.emptyText}>
        {activeTab === 'Received'
          ? 'No collaboration requests have been received yet'
          : 'No collaboration requests have been sent yet'}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Requests</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'Received' && styles.activeTab]}
          onPress={() => setActiveTab('Received')}
        >
          <Text style={[
            styles.tabText,
            activeTab === 'Received' && styles.activeTabText
          ]}>
            Received
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tab, activeTab === 'Sent' && styles.activeTab]}
          onPress={() => setActiveTab('Sent')}
        >
          <Text style={[
            styles.tabText,
            activeTab === 'Sent' && styles.activeTabText
          ]}>
            Sent
          </Text>
        </TouchableOpacity>
      </View>

      {/* Requests List */}
      <View style={styles.requestsContainer}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <SnooLoader size="large" color={PRIMARY_COLOR} />
            <Text style={styles.loadingText}>Loading requests...</Text>
          </View>
        ) : (
          <FlatList
            data={requests}
            renderItem={renderRequest}
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
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    marginRight: 10,
  },
  activeTab: {
    borderBottomColor: PRIMARY_COLOR,
  },
  tabText: {
    fontSize: 16,
    fontWeight: '500',
    color: LIGHT_TEXT_COLOR,
  },
  activeTabText: {
    color: PRIMARY_COLOR,
    fontWeight: '600',
  },
  requestsContainer: {
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
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  requestCard: {
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
  requestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  requestPhoto: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  requestInfo: {
    flex: 1,
  },
  requestName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: TEXT_COLOR,
    marginBottom: 4,
  },
  requestType: {
    alignSelf: 'flex-start',
  },
  requestTypeText: {
    fontSize: 12,
    color: LIGHT_TEXT_COLOR,
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  pendingBadge: {
    backgroundColor: '#FFF3CD',
  },
  acceptedBadge: {
    backgroundColor: '#D4EDDA',
  },
  declinedBadge: {
    backgroundColor: '#F8D7DA',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  pendingText: {
    color: '#856404',
  },
  acceptedText: {
    color: '#155724',
  },
  declinedText: {
    color: '#721C24',
  },
  requestMessage: {
    fontSize: 14,
    color: LIGHT_TEXT_COLOR,
    lineHeight: 20,
    marginBottom: 15,
  },
  requestDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  requestDate: {
    fontSize: 12,
    color: LIGHT_TEXT_COLOR,
    marginLeft: 5,
  },
  requestActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 15,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    flex: 1,
    justifyContent: 'center',
    marginHorizontal: 5,
  },
  acceptButton: {
    backgroundColor: PRIMARY_COLOR,
  },
  declineButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  editButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: PRIMARY_COLOR,
  },
  withdrawButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 5,
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
    lineHeight: 22,
  },
});

